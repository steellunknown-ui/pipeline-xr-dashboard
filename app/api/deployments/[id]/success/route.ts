import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { analyzeSuccess } from "@/lib/success-analyzer";
import { inferSourceFromDeployment } from "@/lib/deployment-source";
import { analyzeDeploymentDecisions } from "@/lib/decision-intelligence";
import { DecisionOption } from "@/lib/types/deployment-actions";
import { analyzeProvenance, type Provenance } from "@/lib/provenance-analyzer";
import { analyzeDeploymentTrustSignals, type TrustSignals } from "@/lib/trust-signals";
import { analyzeDeploymentBenchmark, type BenchmarkResult } from "@/lib/deployment-benchmark";
import { analyzeDeploymentChangeImpact, type ChangeImpact } from "@/lib/change-impact";
import { deriveLineage } from "@/lib/deployment-lineage";
import { analyzeEnvDrift, getLastSuccessfulDeploymentDate } from "@/lib/env-drift";
import { deriveFreezeStatus } from "@/lib/deployment-freeze";
import { deriveDeploymentAttribution, type DeploymentAttribution } from "@/lib/deployment-attribution";
import { deriveDeploymentSummary } from "@/lib/deployment-summary";
import { deriveDeploymentMemory } from "@/lib/deployment-memory";
import { deriveDeploymentPrediction } from "@/lib/deployment-prediction";
import { deriveDeploymentConfidence } from "@/lib/deployment-confidence";
import { deriveOperatorState } from "@/lib/deployment-operator-state";
import { deriveDeploymentFocusLevel } from "@/lib/deployment-focus-level";
import { deriveDeploymentIntent } from "@/lib/deployment-intent";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deploymentId } = await params;
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, { status: 401 });
    }

    // Get deployment with project info
    const { data: deployment, error: deploymentError } = await supabase
      .from("deployments")
      .select(`
        *,
        projects (
          id,
          name,
          framework,
          github_repo_url,
          auto_deploy_branch
        )
      `)
      .eq("id", deploymentId)
      .eq("user_id", user.id)
      .single();

    if (deploymentError || !deployment) {
      return NextResponse.json({
        success: false,
        error: "Deployment not found"
      }, { status: 404 });
    }

    // Only analyze successful deployments
    if (deployment.status !== 'success' && deployment.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: "Success analysis only available for successful deployments"
      }, { status: 400 });
    }

    // Get deployment logs
    const { data: logs } = await supabase
      .from("deployment_logs")
      .select("message")
      .eq("deployment_id", deploymentId)
      .order("created_at", { ascending: true });

    const logMessages = logs?.map(log => log.message) || [];

    // Ensure deployment has a valid source
    const deploymentWithSource = {
      ...deployment,
      source: deployment.source || inferSourceFromDeployment(deployment)
    };

    // Analyze success
    const analysis = analyzeSuccess(deploymentWithSource, deployment.projects, logMessages);

    // STEP 6.3.2: Add decision intelligence for successful deployments
    const decisionOptions: DecisionOption[] = await analyzeDeploymentDecisions(deploymentWithSource);

    // STEP 6.4: Add provenance analysis
    const provenance: Provenance | null = await analyzeProvenance(deploymentWithSource);

    // PRIORITY 8.1: Add trust signals
    const trustSignals: TrustSignals | null = await analyzeDeploymentTrustSignals(deploymentId);

    // PRIORITY 8.2: Add benchmark analysis
    const { data: recentDeployments } = await supabase
      .from('deployments')
      .select('*')
      .eq('project_id', deployment.projects?.id)
      .neq('id', deploymentId)
      .order('created_at', { ascending: false })
      .limit(10);

    const benchmark: BenchmarkResult | null = analyzeDeploymentBenchmark(
      deploymentWithSource,
      recentDeployments || []
    );

    // PRIORITY 8.3: Add change impact analysis
    const previousDeployment = recentDeployments?.[0] || null;
    const changeImpact: ChangeImpact = analyzeDeploymentChangeImpact(
      deploymentWithSource,
      previousDeployment,
      recentDeployments || []
    );

    // PRIORITY 11.2: Add environment drift analysis
    const projectId = deployment.projects?.id;
    let envDrift = null;
    if (projectId) {
      const lastSuccessDate = await getLastSuccessfulDeploymentDate(projectId, deploymentId);
      envDrift = await analyzeEnvDrift(projectId, lastSuccessDate);
    }

    // PRIORITY 12.2: Add deployment attribution
    const { data: auditLogs } = await supabase
      .from('deployment_audit_logs')
      .select('actor_type, actor_label, metadata')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestAudit = auditLogs?.[0] || null;
    const autoDeployEnabled = !!deployment.projects?.auto_deploy_branch;

    const attribution: DeploymentAttribution | null = deriveDeploymentAttribution({
      deployment: {
        source: deploymentWithSource.source,
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
      deployment: deploymentWithSource,
      analysis,
      attribution,
      lineage: deriveLineage(deployment),
      replay: logs || [],
      trustSignals,
      decisionOptions
    });

    const memory = deriveDeploymentMemory({
      deployments: [deploymentWithSource, ...(recentDeployments || [])]
    });

    const prediction = deriveDeploymentPrediction({
      deployment: deploymentWithSource,
      recentDeployments: recentDeployments || [],
      memory,
      trustSignals,
      envDrift,
      attribution
    });

    const confidenceCalibration = deriveDeploymentConfidence({
      deployment: deploymentWithSource,
      recentDeployments: recentDeployments || [],
      memory,
      trustSignals,
      prediction
    });

    const operatorState = deriveOperatorState({
      deployment: deploymentWithSource,
      replay: logs || [],
      prediction,
      confidence: confidenceCalibration,
      freeze: deriveFreezeStatus({ status: deployment.status }),
      lineage: deriveLineage(deployment)
    });

    const focusLevel = deriveDeploymentFocusLevel({
      deployment: deploymentWithSource,
      prediction,
      trustSignals,
      confidenceCalibration,
      operatorState,
      envDrift,
      memory
    });

    const deploymentIntent = deriveDeploymentIntent({
      currentDeployment: { status: deployment.status, source: deploymentWithSource.source },
      previousDeployment: previousDeployment ? { status: previousDeployment.status } : null,
      envOutdated: envDrift ? (envDrift.added.length > 0 || envDrift.removed.length > 0) : false,
      lineage: deriveLineage(deployment)
    });

    return NextResponse.json({
      success: true,
      analysis,
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
    });

  } catch (error) {
    console.error("Success analysis error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to analyze deployment success"
    }, { status: 500 });
  }
}