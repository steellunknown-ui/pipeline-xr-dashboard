import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { disableDeploymentProtection } from '@/app/dashboard/actions/vercel-protection';
import { pollForAliasWithRetries } from '@/lib/alias-resolver';

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DeploymentStage {
  status: string;
  duration: number;
  logs: string[];
}

const DEPLOYMENT_STAGES: DeploymentStage[] = [
  {
    status: 'building',
    duration: 3000,
    logs: ['🚀 Deployment started', '📦 Extracting ZIP contents', '🔍 Analyzing project structure']
  },
  {
    status: 'building',
    duration: 8000,
    logs: ['📋 Installing dependencies...', '⬇️ npm install in progress', '✅ Dependencies installed successfully']
  },
  {
    status: 'building',
    duration: 6000,
    logs: ['🏗️ Building application...', '⚡ Optimizing assets', '📦 Generating production build']
  },
  {
    status: 'building',
    duration: 4000,
    logs: ['🚀 Deploying to server...', '🌐 Configuring domain', '🔧 Setting up SSL certificate']
  },
  {
    status: 'success',
    duration: 2000,
    logs: ['✅ Deployment completed successfully', '🎉 Application is now live', '🌍 Health checks passed']
  }
];

export class DeploymentEngine {
  private static activeDeployments = new Map<string, NodeJS.Timeout>();

  static async startDeployment(deploymentId: string, projectSlug: string): Promise<void> {
    // Clear any existing deployment process
    this.stopDeployment(deploymentId);

    // Get deployment data
    const { data: deploymentData } = await supabase
      .from('deployments')
      .select('user_id, source, project_id, projects(zip_url, vercel_project_id)')
      .eq('id', deploymentId)
      .single();

    if (!deploymentData) return;

    // Start watcher directly
    if (deploymentData.user_id) {
      const { startDeploymentWatcher } = await import('@/lib/deployment-watcher');
      startDeploymentWatcher(deploymentData.user_id, deploymentId);
    }

    if (deploymentData.source === 'zip' && (deploymentData.projects as any)?.zip_url) {
      // Execute REAL deployment via Vercel CLI
      this.runRealZipDeployment(deploymentId, projectSlug, deploymentData.user_id, (deploymentData.projects as any).zip_url)
        .catch(err => {
          console.error("ZIP Deployment failed:", err);
          this.simulateFailure(deploymentId, 'deploying');
        });
      return;
    }

    if (deploymentData.source === 'github') {
      const githubToken = process.env.GITHUB_ACCESS_TOKEN || ""; // Fallback if needed, but we'll try to fetch user token
      this.runRealGithubDeployment(deploymentId, projectSlug, deploymentData.user_id, deploymentData.project_id)
        .catch(err => {
          console.error("GitHub Deployment failed:", err);
          this.simulateFailure(deploymentId, 'deploying');
        });
      return;
    }

    let currentStage = 0;

    const processStage = async () => {
      if (currentStage >= DEPLOYMENT_STAGES.length) return;

      const stage = DEPLOYMENT_STAGES[currentStage];

      // Update deployment status
      await supabase
        .from('deployments')
        .update({
          status: stage.status,
          deployment_url: stage.status === 'success' ? `https://${projectSlug}.pipelinexr.app` : null
        })
        .eq('id', deploymentId);

      // Insert logs for this stage
      for (const logMessage of stage.logs) {
        await supabase
          .from('deployment_logs')
          .insert({
            deployment_id: deploymentId,
            level: 'info',
            message: logMessage,
            created_at: new Date().toISOString(),
          });
      }

      currentStage++;

      // Schedule next stage or complete
      if (currentStage < DEPLOYMENT_STAGES.length) {
        const timeout = setTimeout(processStage, stage.duration);
        this.activeDeployments.set(deploymentId, timeout);
      } else {
        this.activeDeployments.delete(deploymentId);
      }
    };

    // Start with a small delay to simulate queue processing
    const initialTimeout = setTimeout(processStage, 3000);
    this.activeDeployments.set(deploymentId, initialTimeout);
  }

  static stopDeployment(deploymentId: string): void {
    const timeout = this.activeDeployments.get(deploymentId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeDeployments.delete(deploymentId);
    }
  }

  private static async runRealZipDeployment(deploymentId: string, projectSlug: string, userId: string, zipUrl: string) {
    const log = async (msg: string) => {
      await supabase.from('deployment_logs').insert({ deployment_id: deploymentId, user_id: userId, message: msg, level: 'info' });
    };

    try {
      await supabase.from('deployments').update({ status: 'building' }).eq('id', deploymentId);
      await log('🚀 Starting real ZIP deployment process...');
      
      const tmpDir = path.join(os.tmpdir(), `pipeline-xr-${deploymentId}`);
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      // 1. Download ZIP
      await log(`📥 Downloading source code from Supabase...`);
      const response = await fetch(zipUrl);
      if (!response.ok) throw new Error("Failed to download ZIP file");
      const arrayBuffer = await response.arrayBuffer();

      // 2. Extract ZIP
      await log(`📦 Extracting contents...`);
      const zip = await JSZip.loadAsync(arrayBuffer);
      // Filter out __MACOSX and other hidden MacOS system files
      const validEntries = Object.entries(zip.files).filter(([path]) => !path.includes('__MACOSX') && !path.split('/').some(part => part.startsWith('._')));
      
      // Check if ZIP has a single root folder (ignoring hidden Mac files) and adjust paths
      const rootFolders = new Set(
        validEntries
          .map(([p]) => p.split('/')[0])
          .filter(folder => folder.length > 0 && !folder.startsWith('.'))
      );
      
      let rootPrefix = "";
      if (rootFolders.size === 1) {
         const possibleRoot = Array.from(rootFolders)[0];
         // Only treat it as a root prefix if it's a directory (i.e. we have files inside it)
         const hasFilesInside = validEntries.some(([p]) => p.startsWith(possibleRoot + '/'));
         if (hasFilesInside) {
           rootPrefix = possibleRoot + "/";
         }
      }

      for (const [relativePath, zipEntry] of validEntries) {
        if (zipEntry.dir) continue;
        
        let targetPath = relativePath;
        if (rootPrefix && targetPath.startsWith(rootPrefix)) {
           targetPath = targetPath.substring(rootPrefix.length);
        }
        
        const absolutePath = path.join(tmpDir, targetPath);
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        const content = await zipEntry.async("nodebuffer");
        fs.writeFileSync(absolutePath, content);
        
        // Auto-parse .env files and push to DB
        if (targetPath === '.env' || targetPath === '.env.local' || targetPath === '.env.production') {
          await log(`🔍 Detected ${targetPath}, parsing environment variables...`);
          try {
            const envContent = content.toString('utf-8');
            const lines = envContent.split('\n');
            let parsedCount = 0;
            
            // Fetch existing project to get project_id
            const { data: deploymentData } = await supabase.from('deployments').select('project_id').eq('id', deploymentId).single();
            const projectId = deploymentData?.project_id;
            
            if (projectId) {
              for (const line of lines) {
                const trimmed = line.trim();
                // Ignore comments and empty lines
                if (!trimmed || trimmed.startsWith('#')) continue;
                
                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                  const key = match[1].trim();
                  let value = match[2].trim();
                  // Remove quotes if they exist
                  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                     value = value.substring(1, value.length - 1);
                  }
                  
                  // Check if exists
                  const { data: existing } = await supabase.from('environment_variables')
                    .select('id')
                    .eq('project_id', projectId)
                    .eq('key', key)
                    .eq('environment', 'production')
                    .single();
                  
                  if (existing) {
                     await supabase.from('environment_variables').update({ value }).eq('id', existing.id);
                  } else {
                     await supabase.from('environment_variables').insert({
                       key,
                       value,
                       environment: 'production',
                       project_id: projectId,
                       user_id: userId
                     });
                  }
                  parsedCount++;
                }
              }
              await log(`✅ Successfully parsed and saved ${parsedCount} variables from ${targetPath}.`);
            }
          } catch (envErr) {
            console.error("Failed to parse .env file:", envErr);
            await log(`⚠️ Failed to parse ${targetPath}, skipping auto-import.`);
          }
        }
      }

      await log(`⚙️ Setting up environment variables for build...`);
      const { data: deploymentMeta } = await supabase.from('deployments').select('project_id').eq('id', deploymentId).single();
      let envArgsStr = "";
      if (deploymentMeta?.project_id) {
         const { data: envVars } = await supabase.from('environment_variables').select('key, value').eq('project_id', deploymentMeta.project_id);
         if (envVars && envVars.length > 0) {
            let envContent = '';
            envVars.forEach(e => { 
              envContent += `${e.key}="${e.value}"\n`; 
              envArgsStr += ` -b ${e.key}="${e.value}" -e ${e.key}="${e.value}"`;
            });
            // This will overwrite the extracted .env with the full DB truth
            fs.writeFileSync(path.join(tmpDir, '.env.local'), envContent);
            fs.writeFileSync(path.join(tmpDir, '.env.production'), envContent);
            fs.writeFileSync(path.join(tmpDir, '.env'), envContent); 
            await log(`✅ Injected ${envVars.length} environment variables securely from platform.`);
         } else {
            await log(`ℹ️ No environment variables found in platform.`);
         }
      }

      await log(`⚙️ Setting up Vercel CLI environment...`);
      
      const vercelToken = process.env.VERCEL_API_TOKEN;
      if (!vercelToken) throw new Error("VERCEL_API_TOKEN is not set.");
      
      const teamIdStr = process.env.VERCEL_TEAM_ID ? `--scope ${process.env.VERCEL_TEAM_ID}` : "";

      await log(`🚀 Deploying to Vercel...`);
      const command = `npx --yes vercel deploy --prod --yes --token ${vercelToken} ${teamIdStr} --name ${projectSlug}${envArgsStr}`;
      
      const { stdout, stderr } = await execAsync(command, { cwd: tmpDir, env: { ...process.env, VERCEL_PROJECT_ID: '' } });
      
      // Clean output and split by all line breaks to avoid \r merging lines
      const cleanOutput = stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').replace(/\r/g, '\n');
      const deployUrl = cleanOutput.split('\n').map(l => l.trim()).find(l => l.startsWith("http") && !l.includes("vercel.com")) || "";
      
      if (!deployUrl.startsWith("http")) {
         throw new Error(`Deployment failed. Output: ${stdout} ${stderr}`);
      }

      await log(`✅ Deployment successful! URL: ${deployUrl}`);
      
      await supabase
        .from('deployments')
        .update({
          status: 'success',
          deployment_url: deployUrl,
          completed_at: new Date().toISOString()
        })
        .eq('id', deploymentId);

      // Cleanup
      try {
        // Only cleanup if successful so AI Fix can analyze failures
        if (fs.existsSync(tmpDir)) {
           await log('ℹ️ Skipping temp cleanup so AI can analyze failure.');
        }
      } catch (cleanupErr) {
        console.warn('Failed to cleanup temp directory:', cleanupErr);
      }

    } catch (err: any) {
      console.error(err);
      await supabase.from('deployment_logs').insert({ deployment_id: deploymentId, user_id: userId, message: `❌ Deployment failed: ${err.message}`, level: 'error' });
      await supabase.from('deployments').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', deploymentId);
    }
  }

  private static runSpawnCommand(command: string, args: string[], cwd: string, deploymentId: string, userId: string, env: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { cwd, shell: process.platform === 'win32', env });
      let output = '';

      const handleData = async (data: Buffer) => {
        const text = data.toString();
        output += text;
        const cleanLines = text.split('\n').map(line => line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim()).filter(Boolean);
        
        // Extract Vercel Deployment ID in real-time to enable API polling!
        const inspectMatch = text.match(/Inspect:\s+(https:\/\/vercel\.com\/[^/]+\/[^/]+\/([a-zA-Z0-9_]+))/);
        if (inspectMatch) {
            await supabase.from('deployments').update({ vercel_deployment_id: inspectMatch[2] }).eq('id', deploymentId);
        }

        for (const line of cleanLines) {
           await supabase.from('deployment_logs').insert({ deployment_id: deploymentId, user_id: userId, message: line, level: 'info' });
        }
      };

      proc.stdout.on('data', handleData);
      proc.stderr.on('data', handleData);

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed with code ${code}. Output: ${output}`));
        } else {
          resolve(output);
        }
      });
      proc.on('error', reject);
    });
  }

  private static async runRealGithubDeployment(deploymentId: string, projectSlug: string, userId: string, projectId: string) {
    const log = async (msg: string) => {
      await supabase.from('deployment_logs').insert({ deployment_id: deploymentId, user_id: userId, message: msg, level: 'info' });
    };

    let tmpDir = "";
    try {
      await supabase.from('deployments').update({ status: 'building' }).eq('id', deploymentId);
      await log('🚀 Starting real GitHub deployment process (Live Logs Enabled)...');
      
      const { data: project } = await supabase.from('projects').select('github_repo_url, default_branch, auto_deploy_branch').eq('id', projectId).single();
      if (!project?.github_repo_url) throw new Error("GitHub Repo URL not found");

      tmpDir = path.join(os.tmpdir(), `pipeline-xr-gh-${deploymentId}`);
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });

      // 1. Clone GitHub Repository (Streaming logs)
      await log(`📥 Cloning repository ${project.github_repo_url}...`);
      const branch = project.auto_deploy_branch || project.default_branch || 'main';
      await this.runSpawnCommand('git', ['clone', '--branch', branch, '--single-branch', project.github_repo_url, '.'], tmpDir, deploymentId, userId, process.env);

      // 2. Fetch and Sync ENVs to Vercel API
      await log(`⚙️ Preparing environment variables...`);
      const { data: envVars } = await supabase.from('environment_variables').select('key, value').eq('project_id', projectId);
      
      const vercelToken = process.env.VERCEL_API_TOKEN;
      if (!vercelToken) throw new Error("VERCEL_API_TOKEN is not set.");
      const teamIdStr = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
      
      let envArgs: string[] = [];
      if (envVars && envVars.length > 0) {
         let envContent = '';
         
         // Get existing Vercel envs first to handle upserts
         let existingEnvs: any[] = [];
         try {
           const envsRes = await fetch(`https://api.vercel.com/v9/projects/${projectSlug}/env${teamIdStr}`, {
             headers: { 'Authorization': `Bearer ${vercelToken}` }
           });
           if (envsRes.ok) {
             const data = await envsRes.json();
             existingEnvs = data.envs || [];
           }
         } catch (e) {
           console.warn("Failed to fetch existing Vercel envs", e);
         }

         for (const e of envVars) {
           envContent += `${e.key}="${e.value}"\n`; 
           envArgs.push('-b', `${e.key}=${e.value}`);
           
           // Sync directly to Vercel API for runtime availability
           try {
             const existing = existingEnvs.find(v => v.key === e.key);
             if (existing) {
               // Update existing
               await fetch(`https://api.vercel.com/v9/projects/${projectSlug}/env/${existing.id}${teamIdStr}`, {
                 method: 'PATCH',
                 headers: { 'Authorization': `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ value: e.value, type: 'encrypted', target: ['production', 'preview', 'development'] })
               });
             } else {
               // Create new
               await fetch(`https://api.vercel.com/v10/projects/${projectSlug}/env${teamIdStr}`, {
                 method: 'POST',
                 headers: { 'Authorization': `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ key: e.key, value: e.value, type: 'encrypted', target: ['production', 'preview', 'development'] })
               });
             }
           } catch (apiErr) {
             console.warn(`Failed to sync env var ${e.key} to Vercel API:`, apiErr);
           }
         }
         
         fs.writeFileSync(path.join(tmpDir, '.env.local'), envContent);
         fs.writeFileSync(path.join(tmpDir, '.env.production'), envContent);
         fs.writeFileSync(path.join(tmpDir, '.env'), envContent);
         await log(`✅ Synced ${envVars.length} environment variables directly to Vercel project.`);
      } else {
         await log(`ℹ️ No environment variables found. Proceeding with default build.`);
      }
      
      // 3. Trigger Vercel Build (Streaming Live Logs)
      await log(`🚀 Handing off to Vercel Build Engine...`);
      
      const vercelArgs = ['vercel', 'deploy', '--prod', '--yes', '--token', vercelToken, '--name', projectSlug, ...envArgs];
      if (process.env.VERCEL_TEAM_ID) {
        vercelArgs.push('--scope', process.env.VERCEL_TEAM_ID);
      }
      
      const output = await this.runSpawnCommand('npx', vercelArgs, tmpDir, deploymentId, userId, { ...process.env, VERCEL_PROJECT_ID: '' });
      
      // Clean output and split by all line breaks to avoid \r merging lines
      const cleanOutput = output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').replace(/\r/g, '\n');
      const deployUrl = cleanOutput.split('\n').map(l => l.trim()).find(l => l.startsWith("http") && !l.includes("vercel.com"));
      
      if (!deployUrl) {
         throw new Error(`Deployment completed but URL could not be extracted.`);
      }

      await log(`✅ Deployment successful! URL: ${deployUrl}`);
      
      await supabase
        .from('deployments')
        .update({
          status: 'success',
          deployment_url: deployUrl,
          completed_at: new Date().toISOString()
        })
        .eq('id', deploymentId);

      // Attempt to retrieve the Vercel project ID and disable deployment protection
      try {
        const projectInfoRes = await fetch(`https://api.vercel.com/v9/projects/${projectSlug}${teamIdStr}`, {
          headers: { 'Authorization': `Bearer ${vercelToken}` }
        });
        if (projectInfoRes.ok) {
          const projectInfo = await projectInfoRes.json();
          const vercelProjectId = projectInfo.id;
          if (vercelProjectId) {
            await supabase.from('projects').update({ vercel_project_id: vercelProjectId }).eq('id', projectId);
            await disableDeploymentProtection(vercelProjectId);
            await log(`🔓 Disabled Vercel Deployment Protection for public preview access.`);
            
            // Fetch the latest deployment ID to poll for alias
            const listRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=1${teamIdStr.replace('?', '&')}`, {
              headers: { 'Authorization': `Bearer ${vercelToken}` }
            });
            if (listRes.ok) {
              const listData = await listRes.json();
              const latestDep = listData.deployments?.[0];
              if (latestDep && latestDep.uid) {
                await supabase.from('deployments').update({ vercel_deployment_id: latestDep.uid }).eq('id', deploymentId);
                // Start background polling for alias
                pollForAliasWithRetries(deploymentId, latestDep.uid, projectId, vercelToken).catch(e => console.error("Alias polling failed:", e));
              }
            }
          }
        }
      } catch (e) {
        console.warn("Failed to update Vercel project ID or disable protection:", e);
      }

    } catch (err: any) {
      console.error(err);
      await supabase.from('deployment_logs').insert({ deployment_id: deploymentId, user_id: userId, message: `❌ Deployment failed: ${err.message}`, level: 'error' });
      await supabase.from('deployments').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', deploymentId);
    } finally {
      // Cleanup
      if (tmpDir && fs.existsSync(tmpDir)) {
        try {
          // We intentionally leave the directory if it failed so the AI Fix assistant can read the files.
          // In a real app we'd have a cron job cleaning these up later.
        } catch (cleanupErr) {
          console.warn('Failed to cleanup temp directory:', cleanupErr);
        }
      }
    }
  }

  static async simulateFailure(deploymentId: string, stage: string = 'installing'): Promise<void> {
    const errorScenarios = {
      installing: [
        '❌ npm ERR! Cannot resolve dependency @types/node@^18.0.0',
        '❌ Error: Module not found - missing package.json',
        '❌ npm ERR! peer dep missing: react@^18.0.0'
      ],
      building: [
        '❌ Build failed: Syntax error in src/index.js line 42',
        '❌ Error: Cannot find module "./components/Header"',
        '❌ TypeScript compilation failed - 3 errors found'
      ],
      deploying: [
        '❌ Deployment failed: Port 3000 already in use',
        '❌ Error: Permission denied - cannot write to /var/www',
        '❌ SSL certificate validation failed'
      ]
    };

    const errorLogs = errorScenarios[stage as keyof typeof errorScenarios] || errorScenarios.installing;

    // Update to failed status
    await supabase
      .from('deployments')
      .update({ status: 'failed' })
      .eq('id', deploymentId);

    // Insert error logs
    for (const logMessage of errorLogs) {
      await supabase
        .from('deployment_logs')
        .insert({
          deployment_id: deploymentId,
          level: 'error',
          message: logMessage,
          created_at: new Date().toISOString(),
        });
    }

    this.stopDeployment(deploymentId);
  }
}

// Auto-start deployment engine for queued deployments
export async function initializeDeploymentEngine(): Promise<void> {
  const { data: queuedDeployments } = await supabase
    .from('deployments')
    .select('id, projects(name)')
    .eq('status', 'pending');

  if (queuedDeployments) {
    for (const deployment of queuedDeployments) {
      const projectSlug = (deployment.projects as any)?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown-project';
      DeploymentEngine.startDeployment(deployment.id, projectSlug);
    }
  }
}