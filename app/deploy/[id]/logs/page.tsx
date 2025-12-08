'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LogStream } from '@/components/logs/LogStream';
import { AiAnalysisPanel } from '@/components/ai/AiAnalysisPanel';
import { 
  ArrowLeft, 
  ExternalLink, 
  Clock, 
  GitBranch,
  Server,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeploymentInfo {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  branch: string;
  commit: string;
  environment: string;
  startedAt: string;
  duration?: string;
  url?: string;
}

const statusConfig = {
  pending: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    icon: Clock
  },
  running: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    icon: Activity
  },
  success: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    icon: Activity
  },
  failed: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    icon: Activity
  },
  cancelled: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    icon: Activity
  }
};

export default function DeploymentLogsPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Mock deployment info - replace with actual API call
    const mockDeployment: DeploymentInfo = {
      id: deploymentId,
      name: 'pipeline-xr-frontend',
      status: 'running',
      branch: 'main',
      commit: 'a1b2c3d',
      environment: 'production',
      startedAt: new Date().toISOString(),
      url: 'https://pipeline-xr.vercel.app'
    };

    setTimeout(() => {
      setDeploymentInfo(mockDeployment);
      setIsLoading(false);
    }, 500);
  }, [deploymentId]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (status: DeploymentInfo['status']) => {
    const IconComponent = statusConfig[status].icon;
    return <IconComponent className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!deploymentInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Deployment Not Found</h1>
        <p className="text-muted-foreground">The deployment you're looking for doesn't exist.</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Deployment Logs
              </h1>
              <p className="text-muted-foreground">
                Real-time logs for deployment {deploymentId}
              </p>
            </div>
          </div>

          {deploymentInfo.url && (
            <Button variant="outline" asChild>
              <a 
                href={deploymentInfo.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Live Site
              </a>
            </Button>
          )}
        </div>

        {/* Deployment Info Card */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Status</span>
              </div>
              <Badge 
                variant="outline" 
                className={cn('gap-1', statusConfig[deploymentInfo.status].color)}
              >
                {getStatusIcon(deploymentInfo.status)}
                {deploymentInfo.status}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Branch</span>
              </div>
              <div className="font-mono text-sm">{deploymentInfo.branch}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Started</span>
              </div>
              <div className="text-sm">{formatTime(deploymentInfo.startedAt)}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Environment</span>
              </div>
              <Badge variant="secondary">{deploymentInfo.environment}</Badge>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{deploymentInfo.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Commit: <span className="font-mono">{deploymentInfo.commit}</span>
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Logs and AI Analysis Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
          {/* Logs Stream - Left Column (70%) */}
          <div className="min-w-0">
            <Card className="min-h-[600px]">
              <LogStream 
                deploymentId={deploymentId}
                className="h-[600px]"
                onLogsUpdate={setLogs}
              />
            </Card>
          </div>

          {/* AI Analysis Panel - Right Column (30%) */}
          <div className="lg:w-[350px]">
            <div className="sticky top-6">
              <Card className="p-4 max-w-full">
                <AiAnalysisPanel logs={logs} className="w-full" />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}