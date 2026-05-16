const VALID_SOURCES = ['github', 'zip', 'manual'] as const;
export type DeploymentSource = typeof VALID_SOURCES[number];

export function normalizeDeploymentSource(input: any): { 
  success: true; 
  source: DeploymentSource; 
} | { 
  success: false; 
  error: string; 
} {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Invalid deployment source' };
  }

  const normalized = input.toLowerCase().trim();
  
  if (!VALID_SOURCES.includes(normalized as DeploymentSource)) {
    return { success: false, error: 'Invalid deployment source' };
  }

  return { success: true, source: normalized as DeploymentSource };
}

export function inferSourceFromDeployment(deployment: any): DeploymentSource {
  // For existing deployments without source, infer safely
  if (deployment.commit_sha || deployment.commit_hash) {
    return 'github';
  }
  return 'manual';
}