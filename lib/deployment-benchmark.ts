export interface BenchmarkResult {
  relativeConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  successPercentile: number;
  buildTimeComparison: 'faster' | 'slower' | 'similar';
  failureFrequency: number;
  consistency: boolean;
  summary: string;
}

export function analyzeDeploymentBenchmark(
  deployment: any,
  recentDeployments: any[]
): BenchmarkResult | null {
  if (!recentDeployments || recentDeployments.length < 3) {
    return null;
  }

  const last10 = recentDeployments.slice(0, 10);
  const successCount = last10.filter(d => d.status === 'success').length;
  const successPercentile = Math.round((successCount / last10.length) * 100);

  // Build time comparison
  const lastSuccessful = recentDeployments.find(d => d.status === 'success');
  let buildTimeComparison: 'faster' | 'slower' | 'similar' = 'similar';
  
  if (lastSuccessful?.build_duration && deployment.build_duration) {
    const diff = deployment.build_duration - lastSuccessful.build_duration;
    const threshold = lastSuccessful.build_duration * 0.2;
    
    if (diff > threshold) buildTimeComparison = 'slower';
    else if (diff < -threshold) buildTimeComparison = 'faster';
  }

  // Failure frequency for same commit
  const failureFrequency = recentDeployments.filter(d => 
    d.commit_sha === deployment.commit_sha && d.status === 'failed'
  ).length;

  // Consistency check
  const recentSuccessful = recentDeployments.filter(d => d.status === 'success').slice(0, 5);
  const consistency = recentSuccessful.length > 0 && recentSuccessful.every(d => 
    d.source === deployment.source && d.branch === deployment.branch
  );

  // Calculate confidence
  let relativeConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  
  if (successPercentile >= 80 && failureFrequency === 0 && consistency) {
    relativeConfidence = 'HIGH';
  } else if (successPercentile < 50 || failureFrequency > 2) {
    relativeConfidence = 'LOW';
  }

  // Generate summary
  const parts = [];
  if (successPercentile >= 70) {
    parts.push(`${successPercentile}% recent success rate`);
  } else {
    parts.push(`${successPercentile}% recent success rate (below average)`);
  }
  
  if (buildTimeComparison !== 'similar') {
    parts.push(`build time ${buildTimeComparison} than recent`);
  }
  
  if (failureFrequency > 0) {
    parts.push(`${failureFrequency} previous failures for this commit`);
  }

  return {
    relativeConfidence,
    successPercentile,
    buildTimeComparison,
    failureFrequency,
    consistency,
    summary: parts.join(', ')
  };
}