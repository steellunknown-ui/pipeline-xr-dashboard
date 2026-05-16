export interface DeploymentSuccessAnalysis {
  deployment_source: string;
  what_was_deployed: string;
  deployment_summary: string;
  live_url: string | null;
  next_actions: string[];
  performance_insights: string[];
  confidence: number;
}

export function analyzeSuccess(
  deployment: any,
  project: any,
  logs: string[]
): DeploymentSuccessAnalysis {
  const source = deployment.source || 'manual';
  const liveUrl = deployment.deployment_url || null;
  
  return {
    deployment_source: getSourceDescription(source),
    what_was_deployed: getDeploymentDescription(deployment, project, source),
    deployment_summary: getDeploymentSummary(deployment, project, logs),
    live_url: liveUrl,
    next_actions: generateNextActions(source, deployment, project, liveUrl),
    performance_insights: generatePerformanceInsights(logs, deployment),
    confidence: 0.9
  };
}

function getSourceDescription(source: string): string {
  switch (source) {
    case 'github':
      return 'GitHub Repository';
    case 'zip':
      return 'ZIP File Upload';
    case 'manual':
      return 'Manual Deployment';
    default:
      return 'Unknown Source';
  }
}

function getDeploymentDescription(deployment: any, project: any, source: string): string {
  const projectName = project?.name || 'Unknown Project';
  const branch = deployment.branch || 'main';
  const commitSha = deployment.commit_sha || deployment.commit_hash;
  
  switch (source) {
    case 'github':
      return `${projectName} from branch "${branch}"${commitSha ? ` (${commitSha.substring(0, 7)})` : ''}`;
    case 'zip':
      return `${projectName} from uploaded ZIP file`;
    case 'manual':
      return `${projectName} via manual deployment`;
    default:
      return `${projectName}`;
  }
}

function getDeploymentSummary(deployment: any, project: any, logs: string[]): string {
  const duration = deployment.completed_at && deployment.created_at 
    ? Math.round((new Date(deployment.completed_at).getTime() - new Date(deployment.created_at).getTime()) / 1000)
    : null;
  
  const environment = deployment.environment || 'production';
  const framework = project?.framework || 'web application';
  
  let summary = `Successfully deployed ${framework} to ${environment} environment`;
  
  if (duration) {
    summary += ` in ${duration} seconds`;
  }
  
  // Add build insights from logs
  const logText = logs.join(' ').toLowerCase();
  if (logText.includes('build completed') || logText.includes('build successful')) {
    summary += '. Build process completed without errors';
  }
  
  if (logText.includes('optimized') || logText.includes('minified')) {
    summary += ' with optimizations applied';
  }
  
  return summary + '.';
}

function generateNextActions(
  source: string, 
  deployment: any, 
  project: any, 
  liveUrl: string | null
): string[] {
  const baseActions = [];
  
  if (liveUrl) {
    baseActions.push('Visit your live application to verify functionality');
    baseActions.push('Test critical user flows and features');
  }
  
  baseActions.push('Monitor application performance and error rates');
  baseActions.push('Set up monitoring and alerting for production issues');
  
  // Source-specific actions
  if (source === 'github') {
    baseActions.push('Enable auto-deploy for automatic future deployments');
    baseActions.push('Create a pull request workflow for code reviews');
    baseActions.push('Set up branch protection rules for main branch');
  } else if (source === 'zip') {
    baseActions.push('Consider connecting a GitHub repository for easier updates');
    baseActions.push('Document your deployment process for team members');
  }
  
  // Environment-specific actions
  if (deployment.environment === 'development') {
    baseActions.push('Deploy to staging environment for further testing');
    baseActions.push('Run integration tests against the deployed application');
  } else if (deployment.environment === 'production') {
    baseActions.push('Update DNS records if this is a new domain');
    baseActions.push('Configure SSL certificates for secure connections');
    baseActions.push('Set up backup and disaster recovery procedures');
  }
  
  return baseActions;
}

function generatePerformanceInsights(logs: string[], deployment: any): string[] {
  const insights = [];
  const logText = logs.join(' ').toLowerCase();
  
  // Build time insights
  if (logText.includes('build completed in') || logText.includes('built in')) {
    const buildTimeMatch = logText.match(/(?:built in|completed in)\s+(\d+(?:\.\d+)?)\s*(s|seconds|ms|milliseconds)/);
    if (buildTimeMatch) {
      const time = parseFloat(buildTimeMatch[1]);
      const unit = buildTimeMatch[2];
      const timeInSeconds = unit.startsWith('ms') ? time / 1000 : time;
      
      if (timeInSeconds < 30) {
        insights.push('Fast build time indicates efficient build configuration');
      } else if (timeInSeconds > 120) {
        insights.push('Consider optimizing build process to reduce deployment time');
      }
    }
  }
  
  // Bundle size insights
  if (logText.includes('bundle size') || logText.includes('chunk size')) {
    insights.push('Monitor bundle sizes to maintain optimal loading performance');
  }
  
  // Optimization insights
  if (logText.includes('minified') || logText.includes('compressed')) {
    insights.push('Code optimization applied for better performance');
  }
  
  if (logText.includes('tree shaking') || logText.includes('dead code')) {
    insights.push('Unused code eliminated during build process');
  }
  
  // Default insights if no specific patterns found
  if (insights.length === 0) {
    insights.push('Deployment completed successfully with standard configuration');
    insights.push('Consider enabling build optimizations for better performance');
  }
  
  return insights;
}