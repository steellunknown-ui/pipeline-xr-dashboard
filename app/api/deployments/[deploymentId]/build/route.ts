import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { spawn } from "child_process";
import * as path from "path";
import { recordAuditEvent, AuditMessages } from "@/lib/audit-log";

/**
 * PRIORITY 10.2: API to Trigger Build Runner
 *
 * POST /api/deployments/[deploymentId]/build
 *
 * Spawns the build runner as a detached child process.
 * API never executes shell commands directly.
 * API never waits for build completion.
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
                { status: 200 } // Always return 200 as per requirements
            );
        }

        // Verify deployment belongs to user
        const { data: deployment, error: deploymentError } = await supabase
            .from("deployments")
            .select("id, status, project_id")
            .eq("id", deploymentId)
            .eq("user_id", user.id)
            .single();

        if (deploymentError || !deployment) {
            return NextResponse.json({
                success: false,
                error: "Deployment not found",
            });
        }

        // PRIORITY 10.6: Idempotent build trigger - handle all states appropriately
        const status = deployment.status;

        // Already completed successfully - deployment is frozen
        if (status === "success") {
            return NextResponse.json({
                success: true,
                message: "Deployment is frozen. Create a new deployment to proceed.",
                deploymentId,
            });
        }

        // Already building - return success without spawning another runner
        if (status === "building") {
            return NextResponse.json({
                success: true,
                message: "Build already in progress",
                deploymentId,
            });
        }

        // Cancelled - cannot build cancelled deployments
        if (status === "cancelled") {
            return NextResponse.json({
                success: false,
                error: "Deployment was cancelled. Create a new deployment to retry.",
            });
        }

        // Only allow builds for pending or failed deployments
        if (!["pending", "failed"].includes(status)) {
            return NextResponse.json({
                success: false,
                error: `Cannot build deployment in ${status} status`,
            });
        }

        // Check for another build in progress (DB-based lock)
        const { data: activeBuilds, error: lockError } = await supabase
            .from("deployments")
            .select("id")
            .eq("status", "building")
            .neq("id", deploymentId)
            .limit(1);

        if (lockError) {
            console.error("[API] Error checking for active builds:", lockError);
        }

        if (activeBuilds && activeBuilds.length > 0) {
            return NextResponse.json({
                success: true,
                queued: false,
                message: "Another build is in progress",
                activeBuild: activeBuilds[0].id,
            });
        }

        // Spawn runner as detached child process
        // Use path.resolve to avoid webpack analyzing the string as a static import
        const runnerPath = path.resolve("runner/dist/index.js");

        try {
            const child = spawn("node", [runnerPath, deploymentId], {
                detached: true,
                stdio: "ignore",
                cwd: process.cwd(),
                env: process.env as NodeJS.ProcessEnv,
            });

            child.unref(); // Allow API to exit without waiting for runner

            console.log(`[API] Spawned runner for deployment ${deploymentId} (pid: ${child.pid})`);

            // Record audit event (fire-and-forget)
            recordAuditEvent({
                eventType: "BUILD_STARTED",
                deploymentId: deploymentId,
                projectId: deployment.project_id,
                actorType: "user",
                actorUserId: user.id,
                actorLabel: "Manual action",
                message: AuditMessages.buildStarted(),
            });
        } catch (spawnError: any) {
            console.error("[API] Failed to spawn runner:", spawnError.message);
            return NextResponse.json({
                success: false,
                error: "Failed to start build runner",
            });
        }

        return NextResponse.json({
            success: true,
            message: "Build started",
            deploymentId,
        });
    } catch (error: any) {
        console.error("Build trigger error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to start build",
        });
    }
}

/**
 * GET /api/deployments/[deploymentId]/build
 *
 * Get build status for a deployment (read-only, DB-based).
 */
export async function GET(
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

        // Verify deployment belongs to user
        const { data: deployment, error: deploymentError } = await supabase
            .from("deployments")
            .select("id, status, error_message, started_at, completed_at")
            .eq("id", deploymentId)
            .eq("user_id", user.id)
            .single();

        if (deploymentError || !deployment) {
            return NextResponse.json({
                success: false,
                error: "Deployment not found",
            });
        }

        return NextResponse.json({
            success: true,
            deployment: {
                id: deployment.id,
                status: deployment.status,
                error_message: deployment.error_message,
                started_at: deployment.started_at,
                completed_at: deployment.completed_at,
                is_active: deployment.status === "building",
            },
        });
    } catch (error: any) {
        console.error("Build status error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to get build status",
        });
    }
}
