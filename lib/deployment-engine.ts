import { createClient } from '@supabase/supabase-js';
import { disableDeploymentProtection } from '@/app/dashboard/actions/vercel-protection';
import { pollForAliasWithRetries } from '@/lib/alias-resolver';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class DeploymentEngine {
  
  static async startDeployment(deploymentId: string, projectSlug: string): Promise<void> {
    // Get deployment data
    const { data: deploymentData } = await supabase
      .from('deployments')
      .select('user_id, source, project_id, projects(vercel_project_id)')
      .eq('id', deploymentId)
      .single();

    if (!deploymentData) return;

    // Start watcher directly
    if (deploymentData.user_id) {
      const { startDeploymentWatcher } = await import('@/lib/deployment-watcher');
      startDeploymentWatcher(deploymentData.user_id, deploymentId);
    }

    if (deploymentData.source === 'zip') {
      await this.simulateFailure(deploymentId, 'deploying', 'ZIP deployments are deprecated. Please use GitHub deployments.');
      return;
    }

    if (deploymentData.source === 'github') {
      this.runRealGithubDeployment(deploymentId, projectSlug, deploymentData.user_id, deploymentData.project_id)
        .catch(err => {
          console.error("GitHub Deployment failed:", err);
          this.simulateFailure(deploymentId, 'deploying', err.message);
        });
      return;
    }
  }

  private static async runRealGithubDeployment(deploymentId: string, projectSlug: string, userId: string, projectId: string) {
    const log = async (msg: string) => {
      await supabase.from('deployment_logs').insert({ deployment_id: deploymentId, user_id: userId, message: msg, level: 'info' });
    };

    try {
      await supabase.from('deployments').update({ status: 'building' }).eq('id', deploymentId);
      await log('🚀 Initiating Vercel API deployment...');
      
      const { data: project } = await supabase
        .from('projects')
        .select('name, github_repo_id, github_repo_full_name, github_owner, github_default_branch, auto_deploy_branch, vercel_project_id')
        .eq('id', projectId)
        .single();
        
      if (!project?.github_repo_id || !project?.github_repo_full_name) {
         throw new Error("GitHub Repository ID or Full Name not found on project. Please re-import the project from GitHub.");
      }

      const branch = project.auto_deploy_branch || project.github_default_branch || 'main';
      const owner = project.github_owner || project.github_repo_full_name.split('/')[0];
      
      const vercelToken = process.env.PIPELINE_VERCEL_TOKEN;
      if (!vercelToken) throw new Error("PIPELINE_VERCEL_TOKEN is not set.");
      const teamIdStr = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';

      // 1. Fetch and Sync ENVs to Vercel API BEFORE triggering deployment
      await log(`⚙️ Syncing environment variables...`);
      const { data: envVars } = await supabase.from('environment_variables').select('key, value').eq('project_id', projectId);
      
      if (envVars && envVars.length > 0) {
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
           try {
             const existing = existingEnvs.find((v: any) => v.key === e.key);
             if (existing) {
               await fetch(`https://api.vercel.com/v9/projects/${projectSlug}/env/${existing.id}${teamIdStr}`, {
                 method: 'PATCH',
                 headers: { 'Authorization': `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ value: e.value, type: 'encrypted', target: ['production', 'preview', 'development'] })
               });
             } else {
               await fetch(`https://api.vercel.com/v10/projects/${projectSlug}/env${teamIdStr}`, {
                 method: 'POST',
                 headers: { 'Authorization': `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ key: e.key, value: e.value, type: 'encrypted', target: ['production', 'preview', 'development'] })
               });
             }
           } catch (apiErr) {
             console.warn(`Failed to sync env var ${e.key}:`, apiErr);
           }
         }
         await log(`✅ Synced ${envVars.length} environment variables to Vercel.`);
      }

      // 2. Trigger Vercel Build via API
      await log(`🚀 Triggering Vercel deployment on branch ${branch}...`);
      
      const deployRes = await fetch(`https://api.vercel.com/v13/deployments${teamIdStr ? teamIdStr + '&' : '?'}skipAutoDetectionConfirmation=1`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectSlug,
          gitSource: {
            type: "github",
            repoId: project.github_repo_id,
            ref: branch,
            org: owner
          }
        })
      });

      if (!deployRes.ok) {
         const errorText = await deployRes.text();
         throw new Error(`Vercel API returned ${deployRes.status}: ${errorText}`);
      }

      const deployData = await deployRes.json();
      const vercelDeploymentId = deployData.id;
      const deployUrl = deployData.url ? `https://${deployData.url}` : null;

      await log(`✅ Deployment initiated! Vercel ID: ${vercelDeploymentId}`);
      
      // Update DB with the deployment ID
      await supabase
        .from('deployments')
        .update({
          vercel_deployment_id: vercelDeploymentId,
          deployment_url: deployUrl
        })
        .eq('id', deploymentId);

      // Disable protection and start alias polling
      if (project.vercel_project_id) {
         disableDeploymentProtection(project.vercel_project_id).catch(e => console.error("Protection error:", e));
         pollForAliasWithRetries(deploymentId, vercelDeploymentId, projectId, vercelToken).catch(e => console.error("Alias polling failed:", e));
      } else {
         // Attempt to get project ID if not saved
         const projectInfoRes = await fetch(`https://api.vercel.com/v9/projects/${projectSlug}${teamIdStr}`, {
           headers: { 'Authorization': `Bearer ${vercelToken}` }
         });
         if (projectInfoRes.ok) {
           const projectInfo = await projectInfoRes.json();
           if (projectInfo.id) {
             await supabase.from('projects').update({ vercel_project_id: projectInfo.id }).eq('id', projectId);
             disableDeploymentProtection(projectInfo.id).catch(e => console.error(e));
             pollForAliasWithRetries(deploymentId, vercelDeploymentId, projectId, vercelToken).catch(e => console.error(e));
           }
         }
      }

      await log(`🔄 Handing off tracking to Vercel Webhooks...`);

    } catch (err: any) {
      console.error(err);
      await supabase.from('deployment_logs').insert({ deployment_id: deploymentId, user_id: userId, message: `❌ Deployment failed: ${err.message}`, level: 'error' });
      await supabase.from('deployments').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', deploymentId);
    }
  }

  static async simulateFailure(deploymentId: string, stage: string = 'installing', customError?: string): Promise<void> {
    const errorLogs = [
       customError ? `❌ ${customError}` : '❌ Deployment failed unexpectedly.'
    ];

    await supabase
      .from('deployments')
      .update({ status: 'failed', error_message: customError || 'Deployment failed' })
      .eq('id', deploymentId);

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
  }
}

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
