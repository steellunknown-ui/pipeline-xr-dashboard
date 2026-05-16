// PRIORITY 7.1: First-Time User Guidance (FTUE)
// Deterministic "What should I do next?" Engine

export interface OnboardingAction {
  type: 'create_project' | 'deploy_project' | 'explain_failure' | 'enable_auto_deploy';
  title: string;
  description: string;
  primaryCTA: string;
  secondaryCTA?: string;
  route: string;
}

export interface OnboardingInputs {
  projects: any[];
  deployments: any[];
  lastDeployment?: any;
  autoDeployEnabled?: boolean;
}

export function getOnboardingAction(inputs: OnboardingInputs): OnboardingAction | null {
  const { projects, deployments, lastDeployment, autoDeployEnabled } = inputs;

  // Rule 1: No projects exist
  if (!projects || projects.length === 0) {
    return {
      type: 'create_project',
      title: 'Create your first project',
      description: 'Connect a GitHub repository to start deploying your applications.',
      primaryCTA: 'Create Project',
      route: '/dashboard/projects/github'
    };
  }

  // Rule 2: Has projects but no deployments
  if (!deployments || deployments.length === 0) {
    return {
      type: 'deploy_project',
      title: 'Deploy your first project',
      description: 'You haven\'t deployed anything yet. Let\'s deploy your first project.',
      primaryCTA: 'New Deployment',
      route: '/dashboard/deployments'
    };
  }

  // Rule 3: Last deployment failed
  if (lastDeployment && lastDeployment.status === 'failed') {
    return {
      type: 'explain_failure',
      title: 'Your last deployment failed',
      description: 'Get AI-powered insights on what went wrong and how to fix it.',
      primaryCTA: 'Explain Failure',
      route: `/dashboard/deployments/${lastDeployment.id}/logs`
    };
  }

  // Rule 4: Has successful deployments but auto-deploy not enabled
  if (deployments.some((d: any) => d.status === 'success') && !autoDeployEnabled) {
    const firstProject = projects[0];
    return {
      type: 'enable_auto_deploy',
      title: 'Enable automatic deployments',
      description: 'Save time by automatically deploying when you push to your main branch.',
      primaryCTA: 'Enable Auto-Deploy',
      secondaryCTA: 'Maybe Later',
      route: `/dashboard/projects/${firstProject.id}/settings`
    };
  }

  // No guidance needed
  return null;
}