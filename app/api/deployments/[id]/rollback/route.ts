import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { recordAuditEvent, AuditMessages } from "@/lib/audit-log";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: deploymentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 200 });
    }

    const body = await request.json();
    const { confirm } = body;

    // Fetch current deployment
    const { data: currentDeployment, error: currentError } = await supabase
      .from("deployments")
      .select(`
        *,
        projects!inner(user_id, name)
      `)
      .eq("id", deploymentId)
      .eq("projects.user_id", user.id)
      .single();

    if (currentError || !currentDeployment) {
      return NextResponse.json({ success: false, error: "Deployment not found" }, { status: 200 });
    }

    // Fetch last successful deployment of same project
    const { data: successfulDeployment, error: successError } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", currentDeployment.project_id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (successError || !successfulDeployment) {
      return NextResponse.json({
        success: false,
        error: "No successful deployment available for rollback"
      }, { status: 200 });
    }

    // Generate rollback reason using comparison logic
    let reason = "Latest deployment failed";

    // Get comparison data to understand why rollback is needed
    try {
      const compareResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/deployments/${deploymentId}/compare`);
      if (compareResponse.ok) {
        const compareData = await compareResponse.json();
        if (compareData.success && compareData.summary) {
          reason = compareData.summary;
        }
      }
    } catch (error) {
      // Fallback to basic reason if comparison fails
    }

    // If not confirming, return preview
    if (!confirm) {
      return NextResponse.json({
        success: true,
        rollback_to: {
          deployment_id: successfulDeployment.id,
          commit_sha: successfulDeployment.commit_sha,
          source: successfulDeployment.source,
          created_at: successfulDeployment.created_at,
          deployment_url: successfulDeployment.deployment_url
        },
        reason
      }, { status: 200 });
    }

    // Execute rollback - create new deployment
    const { data: rollbackDeployment, error: rollbackError } = await supabase
      .from("deployments")
      .insert({
        project_id: currentDeployment.project_id,
        user_id: user.id,
        source: successfulDeployment.source,
        commit_sha: successfulDeployment.commit_sha,
        branch: successfulDeployment.branch,
        environment: currentDeployment.environment,
        framework: successfulDeployment.framework,
        status: "queued",
        rollback_from_deployment_id: deploymentId,
        rollback_reason: reason
      })
      .select()
      .single();

    if (rollbackError) {
      return NextResponse.json({
        success: false,
        error: "Failed to create rollback deployment"
      }, { status: 200 });
    }

    // Copy environment variables from successful deployment
    const { data: successfulEnvs } = await supabase
      .from("environment_variables")
      .select("key, value, is_secret")
      .eq("project_id", currentDeployment.project_id)
      .lte("created_at", successfulDeployment.created_at);

    if (successfulEnvs && successfulEnvs.length > 0) {
      const envInserts = successfulEnvs.map(env => ({
        project_id: currentDeployment.project_id,
        key: env.key,
        value: env.value,
        is_secret: env.is_secret,
        user_id: user.id
      }));

      await supabase.from("environment_variables").insert(envInserts);
    }

    // Record audit event (fire-and-forget)
    recordAuditEvent({
      eventType: "ROLLBACK_TRIGGERED",
      deploymentId: rollbackDeployment.id,
      projectId: currentDeployment.project_id,
      actorType: "user",
      actorUserId: user.id,
      actorLabel: "Manual action",
      message: AuditMessages.rollbackTriggered(successfulDeployment.id),
    });

    return NextResponse.json({
      success: true,
      deployment: {
        id: rollbackDeployment.id,
        status: "queued",
        rollback_from: deploymentId,
        reason
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Rollback error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to process rollback"
    }, { status: 200 });
  }
}