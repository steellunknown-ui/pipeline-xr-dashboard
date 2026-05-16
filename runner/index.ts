/**
 * PRIORITY 10.2: Build Runner - Standalone CLI Entry Point
 *
 * Pure Node.js entry point for build execution.
 * Run via: node runner/dist/index.js <deploymentId>
 *
 * Key responsibilities:
 * 1. Clean up stuck builds on startup (>15 min timeout)
 * 2. Check DB-based build lock
 * 3. Execute build if no other build is running
 * 4. Handle all errors with proper cleanup
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { executeBuild } from "./build";

// Build timeout: 15 minutes
const BUILD_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Get Supabase admin client (service role)
 */
function getSupabaseAdmin(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
        );
    }

    return createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Clean up stuck builds that have been running for longer than BUILD_TIMEOUT_MS.
 * Runs on every runner startup before any new build begins.
 */
async function cleanupStuckBuilds(): Promise<number> {
    try {
        const supabase = getSupabaseAdmin();
        const cutoffTime = new Date(Date.now() - BUILD_TIMEOUT_MS).toISOString();

        // Find all stuck builds
        const { data: stuckBuilds, error: findError } = await supabase
            .from("deployments")
            .select("id, user_id, started_at")
            .eq("status", "building")
            .not("started_at", "is", null)
            .lt("started_at", cutoffTime);

        if (findError) {
            console.error("[runner] Error finding stuck builds:", findError.message);
            return 0;
        }

        if (!stuckBuilds || stuckBuilds.length === 0) {
            return 0;
        }

        // Mark each stuck build as failed
        for (const build of stuckBuilds) {
            const now = new Date().toISOString();

            // Update deployment status
            const { error: updateError } = await supabase
                .from("deployments")
                .update({
                    status: "failed",
                    completed_at: now,
                    error_message: "Build timed out or runner crashed",
                })
                .eq("id", build.id);

            if (updateError) {
                console.error(
                    `[runner] Failed to mark build ${build.id} as failed:`,
                    updateError.message
                );
                continue;
            }

            // Add final log entry
            await supabase.from("deployment_logs").insert({
                deployment_id: build.id,
                user_id: build.user_id,
                level: "error",
                message: "[system] Build automatically marked failed due to timeout",
            });

            console.log(`[runner] Cleaned up stuck build: ${build.id}`);
        }

        return stuckBuilds.length;
    } catch (err: any) {
        console.error("[runner] Exception during stuck build cleanup:", err.message);
        return 0;
    }
}

/**
 * Check if another build is currently running (DB-based lock)
 */
async function isAnotherBuildRunning(excludeId?: string): Promise<boolean> {
    try {
        const supabase = getSupabaseAdmin();

        let query = supabase
            .from("deployments")
            .select("id")
            .eq("status", "building");

        if (excludeId) {
            query = query.neq("id", excludeId);
        }

        const { data, error } = await query.limit(1);

        if (error) {
            console.error("[runner] Error checking for active builds:", error.message);
            return false; // Fail open - allow build to proceed
        }

        return data !== null && data.length > 0;
    } catch (err: any) {
        console.error("[runner] Exception checking for active builds:", err.message);
        return false; // Fail open
    }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // Handle help
    if (args.length === 0 || args[0] === "--help") {
        console.log("Pipeline XR Build Runner");
        console.log("");
        console.log("Usage:");
        console.log("  node runner/dist/index.js <deploymentId>  - Run a build");
        console.log("");
        console.log("Environment variables required:");
        console.log("  NEXT_PUBLIC_SUPABASE_URL     - Supabase project URL");
        console.log("  SUPABASE_SERVICE_ROLE_KEY    - Supabase service role key");
        process.exit(0);
    }

    // Validate environment
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.error("[runner] Error: NEXT_PUBLIC_SUPABASE_URL not set");
        process.exit(1);
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("[runner] Error: SUPABASE_SERVICE_ROLE_KEY not set");
        process.exit(1);
    }

    // STEP 1: Always clean up stuck builds first
    const cleanedCount = await cleanupStuckBuilds();
    if (cleanedCount > 0) {
        console.log(`[runner] Cleaned up ${cleanedCount} stuck build(s)`);
    }

    // Get deployment ID from args
    const deploymentId = args[0];

    if (!/^[0-9a-f-]{36}$/i.test(deploymentId)) {
        console.error("[runner] Error: Invalid deployment ID format");
        console.error("Expected UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
        process.exit(1);
    }

    // STEP 2: Check DB-based lock
    if (await isAnotherBuildRunning(deploymentId)) {
        console.log("[runner] Another build is in progress. Exiting.");
        process.exit(0); // Clean exit - not an error
    }

    // STEP 3: Execute the build
    console.log(`[runner] Starting build for deployment: ${deploymentId}`);
    console.log("");

    const result = await executeBuild(deploymentId);

    console.log("");
    console.log("=".repeat(50));

    if (result.success) {
        console.log(`✅ Build SUCCESSFUL`);
        console.log(`   Duration: ${Math.round((result.duration || 0) / 1000)}s`);
        process.exit(0);
    } else {
        console.log(`❌ Build FAILED`);
        console.log(`   Error: ${result.error}`);
        if (result.duration) {
            console.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
        }
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any) => {
    console.error("[runner] Unhandled rejection:", reason?.message || reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
    console.error("[runner] Uncaught exception:", err.message);
    process.exit(1);
});

// Run main
main().catch((err) => {
    console.error("[runner] Fatal error:", err.message || err);
    process.exit(1);
});
