// STEP 6.3.1: Decision Comparison Engine (Backend)
// READ-ONLY helper for deployment decision analysis

import { createClient } from "@/lib/supabase-server";
import { DecisionOption } from "@/lib/types/deployment-actions";

export async function analyzeDeploymentDecisions(deployment: any, analysis?: any): Promise<DecisionOption[]> {
  try {
    const supabase = await createClient();
    const decisions: DecisionOption[] = [];

    // Get deployment history for context
    const { data: recentDeployments } = await supabase
      .from('deployments')
      .select('id, status, commit_hash, created_at')
      .eq('project_id', deployment.project_id)
      .neq('id', deployment.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const lastSuccessful = recentDeployments?.find(d => d.status === 'success');
    const recentFailures = recentDeployments?.filter(d => d.status === 'failed').length || 0;
    const sameCommitFailed = recentDeployments?.some(d => 
      d.commit_hash === deployment.commit_hash && d.status === 'failed'
    );

    // Decision 1: Rollback (only for failed deployments)
    if (deployment.status === 'failed') {
      if (lastSuccessful) {
        decisions.push({
          action: "Rollback to last working version",
          description: `Restore to previous successful deployment from ${new Date(lastSuccessful.created_at).toLocaleDateString()}`,
          risk_level: "low",
          confidence: 0.9,
          reason: "Safer option - returns to known working state"
        });
      } else {
        decisions.push({
          action: "Rollback to last working version",
          description: "No previous successful deployment found",
          risk_level: "high",
          confidence: 0.3,
          reason: "No known working version available"
        });
      }
    }

    // Decision 2: Redeploy same commit
    if (deployment.status === 'failed') {
      if (sameCommitFailed) {
        decisions.push({
          action: "Redeploy same commit",
          description: "Retry deployment with identical code",
          risk_level: "high",
          confidence: 0.8,
          reason: "Higher risk - this commit already failed before"
        });
      } else {
        decisions.push({
          action: "Redeploy same commit",
          description: "Retry deployment with identical code",
          risk_level: "medium",
          confidence: 0.6,
          reason: "May succeed if failure was due to temporary issues"
        });
      }
    }

    // Decision 3: Fix and redeploy (based on analysis)
    if (deployment.status === 'failed' && analysis) {
      let riskLevel: "low" | "medium" | "high" = "medium";
      let confidence = 0.7;
      let reason = "Moderate risk - requires code or configuration changes";

      // Adjust risk based on failure type
      if (analysis.failure_type === 'ENV_ERROR') {
        riskLevel = "low";
        confidence = 0.8;
        reason = "Lower risk - environment variable fixes are usually straightforward";
      } else if (analysis.failure_type === 'SYNTAX_ERROR') {
        riskLevel = "medium";
        confidence = 0.9;
        reason = "Moderate risk - syntax errors are clear but require code changes";
      } else if (analysis.failure_type === 'UNKNOWN_ERROR') {
        riskLevel = "high";
        confidence = 0.4;
        reason = "Higher risk - unclear what needs to be fixed";
      }

      decisions.push({
        action: "Fix issues and redeploy",
        description: `Address ${analysis.failure_type.toLowerCase().replace('_', ' ')} and create new deployment`,
        risk_level: riskLevel,
        confidence,
        reason
      });
    }

    // Decision 4: Continue monitoring (for building deployments)
    if (deployment.status === 'building' || deployment.status === 'pending') {
      const avgBuildTime = 300; // 5 minutes default
      decisions.push({
        action: "Continue monitoring",
        description: "Wait for current deployment to complete",
        risk_level: "low",
        confidence: 0.9,
        reason: "Safest option - let the process finish naturally"
      });

      if (recentFailures > 2) {
        decisions.push({
          action: "Cancel and investigate",
          description: "Stop current deployment and review recent failures",
          risk_level: "medium",
          confidence: 0.7,
          reason: `Based on ${recentFailures} recent failures, investigation may be needed`
        });
      }
    }

    // Decision 5: Enable auto-deploy (for successful deployments)
    if (deployment.status === 'success') {
      const successRate = recentDeployments ? 
        (recentDeployments.filter(d => d.status === 'success').length / recentDeployments.length) : 0;

      if (successRate > 0.8) {
        decisions.push({
          action: "Enable auto-deploy",
          description: "Set up automatic deployments for future commits",
          risk_level: "low",
          confidence: 0.8,
          reason: "Lower risk - high success rate indicates stable deployment process"
        });
      } else {
        decisions.push({
          action: "Enable auto-deploy",
          description: "Set up automatic deployments for future commits",
          risk_level: "medium",
          confidence: 0.6,
          reason: "Moderate risk - consider improving deployment stability first"
        });
      }
    }

    // Return top 3 most relevant decisions
    return decisions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

  } catch (error) {
    console.error('Decision analysis error:', error);
    return [];
  }
}