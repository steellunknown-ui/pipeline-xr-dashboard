// STEP 6.4: Confidence & Provenance Layer
// Read-only analysis utility for deployment evidence

import { createClient } from "@/lib/supabase-server";

export interface Provenance {
  based_on: string[]; // max 3 human-readable facts
  evidence_count: number;
  confidence_level: "low" | "medium" | "high";
}

export async function analyzeProvenance(deployment: any): Promise<Provenance | null> {
  try {
    const supabase = await createClient();
    const evidence: string[] = [];

    // Get deployment history for the same project
    const { data: deployments } = await supabase
      .from('deployments')
      .select('id, status, commit_hash, created_at, source')
      .eq('project_id', deployment.project_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!deployments || deployments.length < 2) {
      return null; // Not enough data
    }

    const currentCommit = deployment.commit_hash;
    const sameCommitDeployments = deployments.filter(d => d.commit_hash === currentCommit);
    const successfulDeployments = deployments.filter(d => d.status === 'success');
    const failedDeployments = deployments.filter(d => d.status === 'failed');

    // Evidence Rule 1: Same commit failed ≥2 times
    if (sameCommitDeployments.filter(d => d.status === 'failed').length >= 2) {
      evidence.push(`This commit has failed ${sameCommitDeployments.filter(d => d.status === 'failed').length} times before`);
    }

    // Evidence Rule 2: Previous successful deployment exists
    if (successfulDeployments.length > 0) {
      const lastSuccess = successfulDeployments[0];
      const daysSince = Math.floor((new Date().getTime() - new Date(lastSuccess.created_at).getTime()) / (1000 * 60 * 60 * 24));
      evidence.push(`Last successful deployment was ${daysSince} days ago`);
    }

    // Evidence Rule 3: Rollback previously succeeded
    const rollbackPattern = deployments.some((d, i) => {
      const next = deployments[i + 1];
      return next && d.status === 'success' && next.status === 'failed' && d.created_at > next.created_at;
    });
    if (rollbackPattern) {
      evidence.push("Previous rollbacks have been successful for this project");
    }

    // Evidence Rule 4: Recent deployment pattern
    const recentDeployments = deployments.slice(0, 5);
    const recentSuccessRate = recentDeployments.filter(d => d.status === 'success').length / recentDeployments.length;
    if (recentSuccessRate >= 0.8) {
      evidence.push(`${Math.round(recentSuccessRate * 100)}% success rate in recent deployments`);
    } else if (recentSuccessRate <= 0.2) {
      evidence.push(`Only ${Math.round(recentSuccessRate * 100)}% success rate in recent deployments`);
    }

    // Evidence Rule 5: Source consistency
    const sourceCounts = deployments.reduce((acc, d) => {
      acc[d.source || 'unknown'] = (acc[d.source || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const primarySource = Object.keys(sourceCounts).reduce((a, b) => sourceCounts[a] > sourceCounts[b] ? a : b);
    if (deployment.source === primarySource && sourceCounts[primarySource] >= 3) {
      evidence.push(`Consistent deployment source (${primarySource}) used across deployments`);
    }

    // Determine confidence level
    let confidence_level: "low" | "medium" | "high" = "low";
    if (evidence.length >= 3) {
      confidence_level = "high";
    } else if (evidence.length >= 2) {
      confidence_level = "medium";
    }

    // Return top 3 evidence items
    return {
      based_on: evidence.slice(0, 3),
      evidence_count: evidence.length,
      confidence_level
    };

  } catch (error) {
    console.error('Provenance analysis error:', error);
    return null;
  }
}