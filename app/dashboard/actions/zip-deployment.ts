'use server';

import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
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

export async function runZipDeployment(projectId: string, filePath: string, userId: string, environment: string) {
  try {
    // Validate source
    const sourceResult = normalizeDeploymentSource('zip');
    if (!sourceResult.success) {
      return { success: false, error: sourceResult.error };
    }

    const { data: deployment, error } = await supabase
      .from('deployments')
      .insert({
        project_id: projectId,
        user_id: userId,
        environment,
        branch: 'zip-upload',
        status: 'pending',
        source: sourceResult.source,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('deployment_logs').insert({
      deployment_id: deployment.id,
      user_id: userId,
      level: 'info',
      message: '📋 Deployment queued',
    });

    // Auto-run deployment after creation
    setTimeout(async () => {
      await supabase.from('deployments').update({ status: 'building' }).eq('id', deployment.id);

      await supabase.from('deployment_logs').insert([
        { deployment_id: deployment.id, user_id: userId, level: 'info', message: '🚀 Build started' },
        { deployment_id: deployment.id, user_id: userId, level: 'info', message: '📦 Extracting ZIP file...' },
        { deployment_id: deployment.id, user_id: userId, level: 'info', message: '🔧 Installing dependencies...' },
        { deployment_id: deployment.id, user_id: userId, level: 'info', message: '🔨 Running build command...' },
        { deployment_id: deployment.id, user_id: userId, level: 'success', message: '✅ Build completed successfully' },
      ]);

      // Generate deployment URL
      const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
      const projectSlug = project?.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'project';
      const deploymentUrl = `https://${projectSlug}-${environment}.pipelinexr.app`;

      await supabase.from('deployments').update({
        status: 'success',
        deployment_url: deploymentUrl
      }).eq('id', deployment.id);

      await supabase.from('deployment_logs').insert([
        { deployment_id: deployment.id, user_id: userId, level: 'success', message: `🌐 Live at: ${deploymentUrl}` },
        { deployment_id: deployment.id, user_id: userId, level: 'success', message: '🎉 Deployment successful!' }
      ]);
    }, 2000);

    return { success: true, deploymentId: deployment.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
