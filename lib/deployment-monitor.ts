interface DeploymentStatus {
  id: string;
  status: 'queued' | 'in_progress' | 'building' | 'completed' | 'success' | 'failed' | 'cancelled';
  created_at: string;
  deployment_url?: string;
}

export class DeploymentMonitor {
  private static instance: DeploymentMonitor;
  private activeMonitors = new Map<string, NodeJS.Timeout>();
  private lastStatus = new Map<string, string>();

  static getInstance(): DeploymentMonitor {
    if (!DeploymentMonitor.instance) {
      DeploymentMonitor.instance = new DeploymentMonitor();
    }
    return DeploymentMonitor.instance;
  }

  startMonitoring(userId: string, deploymentId: string, onStatusChange: (status: DeploymentStatus) => void): void {
    this.stopMonitoring(userId);

    const monitor = setInterval(async () => {
      try {
        const status = await this.checkDeploymentStatus(deploymentId);
        if (status) {
          const lastStatus = this.lastStatus.get(deploymentId);
          if (lastStatus !== status.status) {
            this.lastStatus.set(deploymentId, status.status);
            onStatusChange(status);
          }
          
          if (status.status === 'success' || status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            this.stopMonitoring(userId);
            this.lastStatus.delete(deploymentId);
          }
        }
      } catch (error) {
        console.error('Monitor error:', error);
      }
    }, 3000);

    this.activeMonitors.set(userId, monitor);

    setTimeout(() => {
      this.stopMonitoring(userId);
    }, 30 * 60 * 1000);
  }

  stopMonitoring(userId: string): void {
    const monitor = this.activeMonitors.get(userId);
    if (monitor) {
      clearInterval(monitor);
      this.activeMonitors.delete(userId);
    }
  }

  private async checkDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
      .from('deployments')
      .select('id, status, created_at, deployment_url')
      .eq('id', deploymentId)
      .single();

    return data;
  }

  isQueuedTooLong(createdAt: string): boolean {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
    return diffMinutes > 3;
  }
}

export const deploymentMonitor = DeploymentMonitor.getInstance();