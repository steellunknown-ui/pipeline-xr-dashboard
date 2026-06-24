'use server';

import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import crypto from 'crypto';
import { normalizeDeploymentSource } from '@/lib/deployment-source';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadZipForDeployment(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const userId = formData.get('userId') as string;

    if (!file || !projectId || !userId) {
      return { success: false, error: 'Missing required fields' };
    }

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `uploads/${userId}/${projectId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('deployments')
      .upload(filePath, buffer, {
        contentType: 'application/zip',
        upsert: false,
      });

    if (error) throw error;

    return { success: true, filePath: data.path, fileName };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function processZipBundle(filePath: string, userId: string) {
  try {
    const { data, error } = await supabase.storage
      .from('deployments')
      .download(filePath);

    if (error) throw error;

    const arrayBuffer = await data.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const fileTree: any[] = [];
    const configFiles: string[] = [];
    const dependencies: string[] = [];
    let framework = 'Unknown';
    let buildCommand = 'npm run build';
    let envVars: string[] = [];

    for (const [path, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      fileTree.push({
        path,
        name: path.split('/').pop(),
        size: 0, // Size will be calculated when needed
      });

      if (path.includes('package.json')) {
        configFiles.push(path);
        const content = await file.async('string');
        const pkg = JSON.parse(content);

        if (pkg.dependencies?.next) {
          framework = 'Next.js';
          buildCommand = 'npm run build';
        } else if (pkg.dependencies?.react) {
          framework = 'React';
          buildCommand = 'npm run build';
        } else if (pkg.dependencies?.express) {
          framework = 'Node.js/Express';
          buildCommand = 'npm start';
        }

        dependencies.push(...Object.keys(pkg.dependencies || {}));
      }

      if (path.includes('.env.example') || path.includes('.env.sample')) {
        configFiles.push(path);
        const content = await file.async('string');
        const vars = content.split('\n').filter(line => line.includes('='));
        envVars.push(...vars.map(v => v.split('=')[0].trim()));
      }

      if (path.includes('next.config') || path.includes('vite.config') || path.includes('webpack.config')) {
        configFiles.push(path);
      }
    }

    const analysis = {
      fileCount: fileTree.length,
      fileTree: fileTree.slice(0, 50),
      framework,
      buildCommand,
      configFiles,
      dependencies: dependencies.slice(0, 20),
      envVars,
      hasPackageJson: configFiles.some(f => f.includes('package.json')),
      hasNodeModules: fileTree.some(f => f.path.includes('node_modules')),
    };

    return { success: true, analysis };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function insertLogIfNew(deploymentId: string, userId: string, message: string, level: string) {
  // Simple check to avoid spamming the same log message
  await supabase.from('deployment_logs').insert({
    deployment_id: deploymentId,
    user_id: userId,
    message,
    level
  });
}

export async function runZipDeployment(projectId: string, filePath: string, userId: string, environment: string) {
  try {
    const vercelToken = process.env.VERCEL_API_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      return { success: false, error: "Vercel API token not configured." };
    }

    // Validate source
    const sourceResult = normalizeDeploymentSource('zip');
    if (!sourceResult.success) {
      return { success: false, error: sourceResult.error };
    }

    // 1. Create deployment row in Supabase
    const { data: deployment, error: deployError } = await supabase
      .from('deployments')
      .insert({
        project_id: projectId,
        user_id: userId,
        environment,
        branch: 'zip-upload',
        status: 'pending',
        source: sourceResult.source,
      })
      .select('*, projects(name)')
      .single();

    if (deployError || !deployment) throw new Error(deployError?.message || "Failed to create deployment record");

    await insertLogIfNew(deployment.id, userId, '📋 Deployment queued', 'info');
    await insertLogIfNew(deployment.id, userId, '📦 Downloading ZIP from storage...', 'info');

    // 2. Download and Extract ZIP
    const { data: zipBlob, error: downloadError } = await supabase.storage
      .from('deployments')
      .download(filePath);

    if (downloadError || !zipBlob) throw new Error(downloadError?.message || "Failed to download ZIP");

    const arrayBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    await insertLogIfNew(deployment.id, userId, '🔍 Preparing files for Vercel...', 'info');

    // 3. Process and Upload files to Vercel with concurrency limit
    const filesToDeploy: any[] = [];
    const zipEntries = Object.entries(zip.files).filter(([path, file]) => {
      return !file.dir && 
             !path.includes('node_modules/') && 
             !path.includes('.git/') && 
             !path.includes('.next/') &&
             !path.includes('dist/');
    });

    const totalFiles = zipEntries.length;
    let uploadedCount = 0;
    const CONCURRENCY_LIMIT = 10;

    // Helper for parallel upload with limit
    const uploadPool = async (entries: [string, any][]) => {
      const results = [];
      for (let i = 0; i < entries.length; i += CONCURRENCY_LIMIT) {
        const chunk = entries.slice(i, i + CONCURRENCY_LIMIT);
        const promises = chunk.map(async ([path, zipFile]) => {
          const buffer = await zipFile.async('nodebuffer');
          const sha = crypto.createHash('sha1').update(buffer).digest('hex');
          const size = buffer.length;

          let uploadUrl = "https://api.vercel.com/v2/files";
          if (teamId) uploadUrl += `?teamId=${teamId}`;

          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              "Content-Type": "application/octet-stream",
              "x-vercel-digest": sha,
            },
            body: buffer
          });

          if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            // 409 is fine (already exists)
            if (uploadRes.status !== 409) {
              console.error(`Failed to upload ${path}:`, errorData);
            }
          }

          return { file: path, sha, size };
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
        
        uploadedCount += chunk.length;
        await insertLogIfNew(deployment.id, userId, `📤 Uploaded ${uploadedCount}/${totalFiles} files...`, 'info');
      }
      return results;
    };

    const uploadedFiles = await uploadPool(zipEntries);
    filesToDeploy.push(...uploadedFiles);

    await insertLogIfNew(deployment.id, userId, '🚀 All files prepared. Triggering Vercel build...', 'info');

    // 4. Create Vercel Deployment
    let vercelUrl = "https://api.vercel.com/v13/deployments";
    if (teamId) vercelUrl += `?teamId=${teamId}`;

    const projectName = deployment.projects.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const vercelRes = await fetch(vercelUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: projectName,
        files: filesToDeploy,
        projectSettings: {
          framework: null, // Let Vercel auto-detect
        }
      })
    });

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      await insertLogIfNew(deployment.id, userId, `❌ Vercel error: ${vercelData.error?.message || 'Unknown error'}`, "error");
      await supabase.from("deployments").update({ status: "failed" }).eq("id", deployment.id);
      return { success: false, error: `Vercel Error: ${vercelData.error?.message || 'Unknown'}` };
    }

    // 5. Update deployment with Vercel ID
    await supabase
      .from("deployments")
      .update({ 
        vercel_deployment_id: vercelData.id,
        status: 'building'
      })
      .eq("id", deployment.id);

    await insertLogIfNew(deployment.id, userId, "🚀 Real Vercel deployment triggered!", "success");

    return { success: true, deploymentId: deployment.id };
  } catch (error: any) {
    console.error(`Deployment failed:`, error);
    return { success: false, error: error.message || "Unknown deployment error" };
  }
}
