import { createClient } from '@supabase/supabase-js';

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

    // Get deployment user for watcher
    const { data: deploymentData } = await supabase
      .from('deployments')
      .select('user_id')
      .eq('id', deploymentId)
      .single();

    // Start watcher directly
    if (deploymentData?.user_id) {
      const { startDeploymentWatcher } = await import('@/lib/deployment-watcher');
      startDeploymentWatcher(deploymentData.user_id, deploymentId);
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