// PRIORITY 8.1: Deployment Trust Signals
// READ-ONLY explainability layer using ONLY real deployment history

import { createClient } from "@/lib/supabase-server";

export interface TrustSignals {
  success: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  signals: {
    successRatePercent: number | null;
    lastSuccessfulDeployment: string | null;
    failureCount: number;
    sourceConsistency: boolean;
  };
}

export async function analyzeDeploymentTrustSignals(deploymentId: string): Promise<TrustSignals | null> {
  try {
    const supabase = await createClient();

    // Get current deployment
    const { data: currentDeployment, error: currentError } = await supabase
      .from('deployments')
      .select('id, project_id, commit_hash, source, status')
      .eq('id', deploymentId)
      .single();

    if (currentError || !currentDeployment) {
      return null;
    }

    // Get deployment history for the same project (last 10)
    const { data: deployments, error: deploymentsError } = await supabase
      .from('deployments')
      .select('id, status, commit_hash, source, created_at')
      .eq('project_id', currentDeployment.project_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (deploymentsError || !deployments || deployments.length === 0) {
      return null;
    }

    // Calculate trust signals
    const signals = {
      successRatePercent: calculateSuccessRate(deployments),
      lastSuccessfulDeployment: getLastSuccessfulDeployment(deployments),
      failureCount: getFailureCount(deployments, currentDeployment.commit_hash),
      sourceConsistency: checkSourceConsistency(deployments)
    };

    // Calculate confidence based on positive signals
    const positiveSignals = countPositiveSignals(signals);
    const confidence = positiveSignals >= 3 ? "HIGH" : positiveSignals === 2 ? "MEDIUM" : "LOW";

    return {
      success: true,
      confidence,
      signals
    };

  } catch (error) {
    console.error('Trust signals analysis error:', error);
    return null;
  }
}

function calculateSuccessRate(deployments: any[]): number | null {
  if (deployments.length === 0) return null;
  
  const successCount = deployments.filter(d => d.status === 'success').length;
  return Math.round((successCount / deployments.length) * 100);
}

function getLastSuccessfulDeployment(deployments: any[]): string | null {
  const lastSuccess = deployments.find(d => d.status === 'success');
  if (!lastSuccess) return null;

  const now = new Date();
  const successDate = new Date(lastSuccess.created_at);
  const diffMs = now.getTime() - successDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else {
    return 'less than an hour ago';
  }
}

function getFailureCount(deployments: any[], commitHash: string | null): number {
  if (!commitHash) return 0;
  
  return deployments.filter(d => 
    d.commit_hash === commitHash && d.status === 'failed'
  ).length;
}

function checkSourceConsistency(deployments: any[]): boolean {
  if (deployments.length < 3) return false;
  
  const lastThree = deployments.slice(0, 3);
  const firstSource = lastThree[0]?.source;
  
  return lastThree.every(d => d.source === firstSource);
}

function countPositiveSignals(signals: any): number {
  let count = 0;
  
  // Success rate >= 70% is positive
  if (signals.successRatePercent && signals.successRatePercent >= 70) count++;
  
  // Recent successful deployment is positive
  if (signals.lastSuccessfulDeployment) count++;
  
  // Low failure count for same commit is positive
  if (signals.failureCount <= 1) count++;
  
  // Source consistency is positive
  if (signals.sourceConsistency) count++;
  
  return count;
}