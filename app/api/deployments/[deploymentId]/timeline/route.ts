import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
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
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;
    const supabase = await createClient();

    // Get deployment data
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("id, status, created_at, started_at, completed_at, source, user_id, project_id, rollback_from_deployment_id")
      .eq("id", deploymentId)
      .single();

    if (error || !deployment) {
      return NextResponse.json({
        success: false,
        error: "Deployment not found"
      }, { status: 200 });
    }

    // Calculate timeline stages
    const now = new Date();
    const createdAt = new Date(deployment.created_at);
    const startedAt = deployment.started_at ? new Date(deployment.started_at) : null;
    const completedAt = deployment.completed_at ? new Date(deployment.completed_at) : null;

    // Calculate elapsed time
    const endTime = completedAt || now;
    const elapsedSeconds = Math.floor((endTime.getTime() - createdAt.getTime()) / 1000);

    // Determine current stage
    let currentStage = "queued";
    if (deployment.status === "building" || deployment.status === "in_progress") {
      currentStage = "building";
    } else if (deployment.status === "success" || deployment.status === "completed") {
      currentStage = "completed";
    } else if (deployment.status === "failed") {
      currentStage = "failed";
    }

    // Build stages array
    const stages = [];

    // Queued stage
    const queuedDuration = startedAt
      ? Math.floor((startedAt.getTime() - createdAt.getTime()) / 1000)
      : (currentStage === "queued" ? elapsedSeconds : null);

    stages.push({
      name: "queued",
      status: currentStage === "queued" ? "active" : "completed",
      duration: queuedDuration
    });

    // Building stage
    if (startedAt || currentStage !== "queued") {
      const buildingStart = startedAt || createdAt;
      const buildingEnd = completedAt || (currentStage === "building" ? now : buildingStart);
      const buildingDuration = Math.floor((buildingEnd.getTime() - buildingStart.getTime()) / 1000);

      stages.push({
        name: "building",
        status: currentStage === "building" ? "active" :
          (currentStage === "queued" ? "pending" : "completed"),
        duration: currentStage === "queued" ? undefined : buildingDuration
      });
    }

    // Final stage (success/failed)
    if (completedAt) {
      const finalStage = deployment.status === "failed" ? "failed" : "completed";
      stages.push({
        name: finalStage,
        status: "completed",
        duration: 0
      });
    } else if (currentStage !== "queued" && currentStage !== "building") {
      stages.push({
        name: currentStage,
        status: "active"
      });
    }

    // STEP 6.3.2: Add decision intelligence for building/pending deployments
    const decisionOptions: DecisionOption[] = await analyzeDeploymentDecisions(deployment);

    // STEP 6.4: Add provenance analysis
    const provenance: Provenance | null = await analyzeProvenance(deployment);

    // PRIORITY 8.1: Add trust signals
    const trustSignals: TrustSignals | null = await analyzeDeploymentTrustSignals(deploymentId);

    // PRIORITY 8.2: Add benchmark analysis
    const { data: recentDeployments } = await supabase
      .from('deployments')
      .select('*')
      .eq('project_id', deployment.project_id)
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

    // PRIORITY 11.2: Add environment drift analysis
    const projectId = deployment.project_id;
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

    // Fetch project for auto_deploy_branch
    const { data: project } = await supabase
      .from('projects')
      .select('auto_deploy_branch')
      .eq('id', projectId)
      .single();

    const latestAudit = auditLogs?.[0] || null;
    const autoDeployEnabled = !!project?.auto_deploy_branch;
    const deploymentSource = deployment.source || inferSourceFromDeployment(deployment);

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
      deployment: { ...deployment, currentStage },
      attribution,
      lineage: deriveLineage(deployment),
      trustSignals,
      decisionOptions
    });

    const memory = deriveDeploymentMemory({
      deployments: [{ ...deployment, currentStage }, ...(recentDeployments || [])]
    });

    const prediction = deriveDeploymentPrediction({
      deployment: { ...deployment, currentStage },
      recentDeployments: recentDeployments || [],
      memory,
      trustSignals,
      envDrift,
      attribution
    });

    const confidenceCalibration = deriveDeploymentConfidence({
      deployment: { ...deployment, currentStage },
      recentDeployments: recentDeployments || [],
      memory,
      trustSignals,
      prediction
    });

    const operatorState = deriveOperatorState({
      deployment: { ...deployment, currentStage },
      prediction,
      confidence: confidenceCalibration,
      freeze: deriveFreezeStatus({ status: deployment.status }),
      lineage: deriveLineage(deployment)
    });

    const focusLevel = deriveDeploymentFocusLevel({
      deployment: { ...deployment, currentStage },
      prediction,
      trustSignals,
      confidenceCalibration,
      operatorState,
      envDrift,
      memory
    });

    const deploymentIntent = deriveDeploymentIntent({
      currentDeployment: { status: deployment.status, source: deployment.source },
      previousDeployment: previousDeployment ? { status: previousDeployment.status } : null,
      envOutdated: envDrift ? (envDrift.added.length > 0 || envDrift.removed.length > 0) : false,
      lineage: deriveLineage(deployment)
    });

    return NextResponse.json({
      success: true,
      deploymentId,
      status: deployment.status,
      currentStage,
      elapsedSeconds,
      stages,
      source: deployment.source || inferSourceFromDeployment(deployment),
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
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to get deployment timeline"
    }, { status: 200 });
  }
}