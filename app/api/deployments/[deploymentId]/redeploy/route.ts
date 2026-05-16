import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isTerminal } from "@/lib/deployment-state";
import { type DeploymentStatus } from "@/lib/deployment-state";
import { recordAuditEvent, AuditMessages } from "@/lib/audit-log";

/**
 * PRIORITY 10.7: Safe Re-Deploy API
 *
 * POST /api/deployments/[deploymentId]/redeploy
 *
 * Creates a NEW deployment from an existing one.
 * NEVER mutates the original deployment.
 * Preserves immutability guarantees.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ deploymentId: string }> }
) {
    try {
        const { deploymentId } = await params;
        const supabase = await createClient();

        // Authenticate user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 200 }
            );
        }

        // Fetch original deployment via project ownership
        const { data: original, error: fetchError } = await supabase
            .from("deployments")
            .select(`
        id,
        project_id,
        user_id,
        source,
        branch,
        commit_sha,
        environment,
        status,
        projects!inner(user_id)
      `)
            .eq("id", deploymentId)
            .eq("projects.user_id", user.id)
            .single();

        if (fetchError || !original) {
            console.error("[redeploy] Fetch error:", fetchError?.message, "deploymentId:", deploymentId, "userId:", user.id);
            return NextResponse.json({
                success: false,
                error: "Deployment not found",
            });
        }

        const status = original.status as DeploymentStatus;

        // Only allow redeploy from terminal states
        if (!isTerminal(status)) {
            if (status === "building") {
                return NextResponse.json({
                    success: false,
                    error: "Cannot redeploy: build is currently in progress",
                    currentStatus: status,
                });
            }

            if (status === "pending") {
                return NextResponse.json({
                    success: false,
                    error: "Cannot redeploy: deployment is still pending. Trigger build first.",
                    currentStatus: status,
                });
            }

            return NextResponse.json({
                success: false,
                error: `Cannot redeploy from status: ${status}`,
                currentStatus: status,
            });
        }

        // Create NEW deployment (immutable - original never touched)
        const { data: newDeployment, error: insertError } = await supabase
            .from("deployments")
            .insert({
                project_id: original.project_id,
                user_id: user.id,
                source: original.source,
                branch: original.branch,
                commit_sha: original.commit_sha,
                environment: original.environment,
                status: "pending",
            })
            .select("id")
            .single();

        if (insertError || !newDeployment) {
            console.error("[redeploy] Failed to create deployment:", insertError);
            return NextResponse.json({
                success: false,
                error: "Failed to create new deployment",
            });
        }

        // Record audit event (fire-and-forget)
        recordAuditEvent({
            eventType: "REDEPLOY_TRIGGERED",
            deploymentId: newDeployment.id,
            projectId: original.project_id,
            actorType: "user",
            actorUserId: user.id,
            actorLabel: "Manual action",
            message: AuditMessages.redeployTriggered(deploymentId),
        });

        return NextResponse.json({
            success: true,
            newDeploymentId: newDeployment.id,
            message: "Created new deployment from existing version",
            originalDeploymentId: deploymentId,
        });
    } catch (error: any) {
        console.error("[redeploy] Error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to process redeploy request",
        });
    }
}
