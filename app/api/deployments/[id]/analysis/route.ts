import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { analyzeFailure, type DeploymentAnalysis } from '@/lib/failure-analyzer';
import { inferSourceFromDeployment } from '@/lib/deployment-source';
import { analyzeDeploymentDecisions } from '@/lib/decision-intelligence';
import { DecisionOption } from '@/lib/types/deployment-actions';
import { analyzeProvenance, type Provenance } from '@/lib/provenance-analyzer';
import { analyzeDeploymentTrustSignals, type TrustSignals } from '@/lib/trust-signals';
import { analyzeDeploymentBenchmark, type BenchmarkResult } from '@/lib/deployment-benchmark';
import { analyzeDeploymentChangeImpact, type ChangeImpact } from '@/lib/change-impact';
import { deriveLineage } from '@/lib/deployment-lineage';
import { analyzeEnvDrift, getLastSuccessfulDeploymentDate } from '@/lib/env-drift';
import { deriveFreezeStatus } from '@/lib/deployment-freeze';
import { deriveDeploymentAttribution, type DeploymentAttribution } from '@/lib/deployment-attribution';
import { deriveDeploymentSummary } from '@/lib/deployment-summary';
import { deriveDeploymentMemory } from '@/lib/deployment-memory';
import { deriveDeploymentPrediction } from '@/lib/deployment-prediction';
import { deriveDeploymentConfidence } from '@/lib/deployment-confidence';
import { deriveOperatorState } from '@/lib/deployment-operator-state';
import { deriveDeploymentFocusLevel } from '@/lib/deployment-focus-level';
import { deriveDeploymentIntent } from '@/lib/deployment-intent';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const { id: deploymentId } = await params;

    // Fetch deployment details
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select(`
        id,
        source,
        status,
        branch,
        commit_hash,
        created_at,
        rollback_from_deployment_id,
        projects (
          id,
          name,
          auto_deploy_branch
        )
      `)
      .eq('id', deploymentId)
      .eq('user_id', user.id)
      .single();

    if (deploymentError || !deployment) {
      return NextResponse.json({
        success: false,
        error: 'Deployment not found'
      }, { status: 404 });
    }

    // Fetch deployment logs
    const { data: logs, error: logsError } = await supabase
      .from('deployment_logs')
      .select('message, level, created_at')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: true });

    // Handle missing logs gracefully
    const logMessages = logs?.map(log => log.message) || [];
    const errorLogs = logs?.filter(log => log.level === 'error').map(log => log.message) || [];

    // Use error logs first, fall back to all logs
    const analysisLogs = errorLogs.length > 0 ? errorLogs : logMessages;

    // Ensure deployment has a valid source
    const deploymentSource = deployment.source || inferSourceFromDeployment(deployment);

    // Perform AI analysis with rule-based fallback
    const analysis: DeploymentAnalysis = await analyzeFailure(analysisLogs, deploymentSource);

    // STEP 6.3.2: Add decision intelligence
    const decisionOptions: DecisionOption[] = await analyzeDeploymentDecisions(deployment, analysis);

    // STEP 6.4: Add provenance analysis
    const provenance: Provenance | null = await analyzeProvenance(deployment);

    // PRIORITY 8.1: Add trust signals
    const trustSignals: TrustSignals | null = await analyzeDeploymentTrustSignals(deploymentId);

    // PRIORITY 8.2: Add benchmark analysis
    const { data: recentDeployments } = await supabase
      .from('deployments')
      .select('*')
      .eq('project_id', (deployment.projects as any)?.id || (Array.isArray(deployment.projects) ? (deployment.projects as any)[0]?.id : undefined))
      .neq('id', deploymentId)
      .order('created_at', { ascending: false })
      .limit(10);

    const benchmark: BenchmarkResult | null = analyzeDeploymentBenchmark(
      deployment,
      recentDeployments || []
    );

    // PRIORITY 8.3: Add change impact analysis
    const previousDeployment = recentDeployments?.[0] || null;
    const changeImpact: ChangeImpact = analyzeDeploymentChangeImpact(
      deployment,
      previousDeployment,
      recentDeployments || []
    );

    // Determine if AI was used (confidence >= 0.9 in our system implies AI was used successfully)
    const aiUsed = analysis.confidence >= 0.9;

    // If confidence is low and we have AI available, could enhance with AI here
    // For now, we'll stick with rule-based analysis

    // PRIORITY 11.2: Add environment drift analysis
    const projectId = (deployment.projects as any)?.id || (Array.isArray(deployment.projects) ? (deployment.projects as any)[0]?.id : undefined);
    let envDrift = null;
    if (projectId) {
      const lastSuccessDate = await getLastSuccessfulDeploymentDate(projectId, deploymentId);
      envDrift = await analyzeEnvDrift(projectId, lastSuccessDate);
    }

    // PRIORITY 12.2: Add deployment attribution
    // Fetch latest audit log for this deployment
    const { data: auditLogs } = await supabase
      .from('deployment_audit_logs')
      .select('actor_type, actor_label, metadata')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestAudit = auditLogs?.[0] || null;
    const autoDeployEnabled = !!(deployment.projects as any)?.auto_deploy_branch;

    const attribution: DeploymentAttribution | null = deriveDeploymentAttribution({
      deployment: {
        source: deploymentSource,
        rollback_from_deployment_id: deployment.rollback_from_deployment_id,
      },
      audit: latestAudit ? {
        actor_type: latestAudit.actor_type,
        actor_label: latestAudit.actor_label,
        metadata: latestAudit.metadata as Record<string, unknown> | null,
      } : null,
      autoDeployEnabled,
    });

    const summary = deriveDeploymentSummary({
      deployment,
      analysis,
      attribution,
      lineage: deriveLineage(deployment),
      replay: logs || [],
      trustSignals,
      decisionOptions
    });

    const memory = deriveDeploymentMemory({
      deployments: [deployment, ...(recentDeployments || [])]
    });

    const prediction = deriveDeploymentPrediction({
      deployment,
      recentDeployments: recentDeployments || [],
      memory,
      trustSignals,
      envDrift,
      attribution
    });

    const confidenceCalibration = deriveDeploymentConfidence({
      deployment,
      recentDeployments: recentDeployments || [],
      memory,
      trustSignals,
      prediction
    });

    const operatorState = deriveOperatorState({
      deployment,
      replay: logs || [],
      prediction,
      confidence: confidenceCalibration,
      freeze: deriveFreezeStatus({ status: deployment.status }),
      lineage: deriveLineage(deployment)
    });

    const focusLevel = deriveDeploymentFocusLevel({
      deployment,
      prediction,
      trustSignals,
      confidenceCalibration,
      operatorState,
      envDrift,
      memory
    });

    const deploymentIntent = deriveDeploymentIntent({
      currentDeployment: { status: deployment.status, source: deploymentSource },
      previousDeployment: previousDeployment ? { status: previousDeployment.status } : null,
      envOutdated: envDrift ? (envDrift.added.length > 0 || envDrift.removed.length > 0) : false,
      lineage: deriveLineage(deployment)
    });

    return NextResponse.json({
      success: true,
      deployment: {
        id: deployment.id,
        source: deploymentSource,
        status: deployment.status,
        branch: deployment.branch,
        commit_sha: deployment.commit_hash,
        project_name: (deployment.projects as any)?.name ?? (Array.isArray(deployment.projects) ? (deployment.projects as any)[0]?.name : undefined),
        project_id: (deployment.projects as any)?.id ?? (Array.isArray(deployment.projects) ? (deployment.projects as any)[0]?.id : undefined)
      },
      analysis: {
        failure_type: analysis.failure_type,
        short_reason: analysis.short_reason,
        detailed_reason: analysis.detailed_reason,
        probable_cause: analysis.probable_cause,
        fix_steps: analysis.fix_steps,
        confidence: analysis.confidence
      },
      decisionOptions,
      provenance,
      trustSignals,
      benchmark,
      changeImpact,
      lineage: deriveLineage(deployment),
      envDrift,
      freeze: deriveFreezeStatus({ status: deployment.status }),
      attribution,
      summary,
      memory,
      prediction,
      confidenceCalibration,
      operatorState,
      focusLevel,
      deploymentIntent,
      ai_used: aiUsed,
      logs_analyzed: analysisLogs.length,
      total_logs: logMessages.length
    });

  } catch (error: any) {
    console.error('Deployment analysis error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze deployment'
    }, { status: 500 });
  }
}