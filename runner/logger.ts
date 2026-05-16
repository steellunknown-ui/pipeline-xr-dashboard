/**
 * PRIORITY 10.1: Build Runner - Logger
 * 
 * Appends logs to deployment_logs table in real-time.
 * Uses service role key to bypass RLS for runner operations.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type LogLevel = "info" | "warn" | "error" | "success";

// Create a service-role Supabase client for the runner
// This bypasses RLS so the runner can write logs for any user
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
    if (!supabaseAdmin) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !serviceKey) {
            throw new Error(
                "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
            );
        }

        supabaseAdmin = createClient(url, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }

    return supabaseAdmin;
}

/**
 * Logger class for a specific deployment.
 * Writes logs to deployment_logs table in real-time.
 */
export class DeploymentLogger {
    private deploymentId: string;
    private userId: string;
    private buffer: Array<{ level: LogLevel; message: string }> = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private flushIntervalMs = 500; // Flush every 500ms for real-time feel

    constructor(deploymentId: string, userId: string) {
        this.deploymentId = deploymentId;
        this.userId = userId;
    }

    /**
     * Log an info message
     */
    info(message: string): void {
        this.log("info", message);
    }

    /**
     * Log a warning message
     */
    warn(message: string): void {
        this.log("warn", message);
    }

    /**
     * Log an error message
     */
    error(message: string): void {
        this.log("error", message);
    }

    /**
     * Log a success message
     */
    success(message: string): void {
        this.log("success", message);
    }

    /**
     * Core log method - buffers and flushes to DB
     */
    private log(level: LogLevel, message: string): void {
        // Also log to console for debugging
        const prefix = `[${this.deploymentId.substring(0, 8)}]`;
        console.log(`${prefix} [${level.toUpperCase()}] ${message}`);

        // Add to buffer
        this.buffer.push({ level, message });

        // Schedule flush if not already scheduled
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
        }
    }

    /**
     * Flush buffered logs to database
     */
    async flush(): Promise<void> {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.buffer.length === 0) {
            return;
        }

        const logsToWrite = [...this.buffer];
        this.buffer = [];

        try {
            const supabase = getSupabaseAdmin();

            const rows = logsToWrite.map((log) => ({
                deployment_id: this.deploymentId,
                user_id: this.userId,
                level: log.level,
                message: log.message,
            }));

            const { error } = await supabase.from("deployment_logs").insert(rows);

            if (error) {
                console.error("Failed to write logs to DB:", error);
                // Re-add failed logs to buffer for retry
                this.buffer = [...logsToWrite, ...this.buffer];
            }
        } catch (err) {
            console.error("Exception writing logs to DB:", err);
            // Re-add failed logs to buffer for retry
            this.buffer = [...logsToWrite, ...this.buffer];
        }
    }

    /**
     * Force flush all remaining logs (call before build completes)
     */
    async finalize(): Promise<void> {
        await this.flush();
    }
}

/**
 * Update deployment status in the database
 */
export async function updateDeploymentStatus(
    deploymentId: string,
    status: "pending" | "building" | "success" | "failed" | "cancelled",
    extra?: {
        error_message?: string;
        deployment_url?: string;
        started_at?: string;
        completed_at?: string;
    }
): Promise<void> {
    try {
        const supabase = getSupabaseAdmin();

        const updateData: Record<string, unknown> = { status };

        if (extra?.error_message !== undefined) {
            updateData.error_message = extra.error_message;
        }
        if (extra?.deployment_url !== undefined) {
            updateData.deployment_url = extra.deployment_url;
        }
        if (extra?.started_at !== undefined) {
            updateData.started_at = extra.started_at;
        }
        if (extra?.completed_at !== undefined) {
            updateData.completed_at = extra.completed_at;
        }

        const { error } = await supabase
            .from("deployments")
            .update(updateData)
            .eq("id", deploymentId);

        if (error) {
            console.error("Failed to update deployment status:", error);
        }
    } catch (err) {
        console.error("Exception updating deployment status:", err);
    }
}

/**
 * Fetch deployment with project info
 */
export async function fetchDeployment(deploymentId: string): Promise<{
    id: string;
    user_id: string;
    project_id: string;
    status: string;
    source: string;
    branch: string;
    commit_sha: string | null;
    environment: string;
    projects: {
        id: string;
        name: string;
        github_repo_url: string;
        default_branch: string;
    };
} | null> {
    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from("deployments")
            .select(
                `
        id,
        user_id,
        project_id,
        status,
        source,
        branch,
        commit_sha,
        environment,
        projects (
          id,
          name,
          github_repo_url,
          default_branch
        )
      `
            )
            .eq("id", deploymentId)
            .single();

        if (error || !data) {
            console.error("Failed to fetch deployment:", error);
            return null;
        }

        // Normalize projects (Supabase returns array for joins)
        const projects = Array.isArray(data.projects)
            ? data.projects[0]
            : data.projects;

        return {
            ...data,
            projects,
        } as any;
    } catch (err) {
        console.error("Exception fetching deployment:", err);
        return null;
    }
}
