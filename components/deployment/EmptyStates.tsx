import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, Github, GitBranch } from "lucide-react";

interface DeploymentEmptyStateProps {
  projectName?: string;
  projectId?: string;
  hasGitHubConnection?: boolean;
  onDeploy?: () => void;
  onConnectGitHub?: () => void;
  onEnableAutoDeploy?: () => void;
}

export function DeploymentEmptyState({
  projectName,
  projectId,
  hasGitHubConnection = false,
  onDeploy,
  onConnectGitHub,
  onEnableAutoDeploy
}: DeploymentEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Rocket className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-2 mb-6">
          <h3 className="text-lg font-semibold text-foreground">
            No deployments yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {projectName 
              ? `${projectName} hasn't been deployed yet. Once you deploy, Pipeline XR will track, explain, and guide every deployment here.`
              : "This project hasn't been deployed yet. Once you deploy, Pipeline XR will track, explain, and guide every deployment here."
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onDeploy}>
            <Rocket className="h-4 w-4 mr-2" />
            Deploy this project
          </Button>
          {hasGitHubConnection && onEnableAutoDeploy && (
            <Button variant="outline" onClick={onEnableAutoDeploy}>
              <Github className="h-4 w-4 mr-2" />
              Enable auto-deploy
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface FirstDeploymentBannerProps {
  className?: string;
}

export function FirstDeploymentBanner({ className }: FirstDeploymentBannerProps) {
  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardContent className="py-4">
        <p className="text-sm text-blue-800">
          Your first deployment is the starting point. Pipeline XR will use it as a baseline for comparisons, explanations, and recommendations.
        </p>
      </CardContent>
    </Card>
  );
}

interface GitHubNotConnectedProps {
  onConnect?: () => void;
  className?: string;
}

export function GitHubNotConnected({ onConnect, className }: GitHubNotConnectedProps) {
  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="py-8 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Github className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-2 mb-4">
          <h4 className="font-medium text-foreground">GitHub isn't connected yet</h4>
          <p className="text-sm text-muted-foreground">
            Connect GitHub to enable repository imports, auto-deploy, and commit-level insights.
          </p>
        </div>
        <Button onClick={onConnect} size="sm">
          <Github className="h-4 w-4 mr-2" />
          Connect GitHub
        </Button>
      </CardContent>
    </Card>
  );
}

interface NoFailuresYetProps {
  className?: string;
}

export function NoFailuresYet({ className }: NoFailuresYetProps) {
  return (
    <Card className={`border-green-200 bg-green-50 ${className}`}>
      <CardContent className="py-3">
        <p className="text-sm text-green-800">
          Nice — no failed deployments so far. If something ever goes wrong, Pipeline XR will explain what happened and what to do next.
        </p>
      </CardContent>
    </Card>
  );
}