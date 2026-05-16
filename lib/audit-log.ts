/**
 * PRIORITY 12.1: Deployment Audit Log
 *
 * Append-only audit logging for deployment actions.
 * Never throws - failures are swallowed safely.
 * Fire-and-forget pattern.
 */

import { createClient } from "@supabase/supabase-js";

// Audit event types
export type AuditEventType =
    | "DEPLOYMENT_CREATED"
    | "BUILD_STARTED"
    | "BUILD_COMPLETED"
    | "BUILD_FAILED"
    | "DEPLOYMENT_CANCELLED"
    | "REDEPLOY_TRIGGERED"
    | "ROLLBACK_TRIGGERED"
    | "AUTO_DEPLOY_ENABLED"
    | "AUTO_DEPLOY_DISABLED"
    | "AI_FIX_PREVIEWED"
    | "AI_FIX_APPLIED"
    | "AI_FIX_UNDONE";

// Audit log entry as stored in database
export interface AuditLogEntry {
    id: string;
    event_type: AuditEventType;
    deployment_id: string | null;
    project_id: string;
    actor_type: "user" | "system";
    actor_user_id: string | null;
    actor_label: string;
    message: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

// Input for recording an audit event
export interface AuditLogInput {
    eventType: AuditEventType;
    deploymentId?: string | null;
    projectId: string;
    actorType: "user" | "system";
    actorUserId?: string | null;
    actorLabel: string;
    message: string;
    metadata?: Record<string, unknown>;
}

/**
 * Get Supabase admin client for server-side operations
 */
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        return null;
    }

    return createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Record an audit event. Never throws.
 * Fire-and-forget - failures are logged but do not propagate.
 */
export async function recordAuditEvent(input: AuditLogInput): Promise<void> {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            console.warn("[audit-log] Supabase not configured, skipping audit");
            return;
        }

        const { error } = await supabase.from("deployment_audit_logs").insert({
            event_type: input.eventType,
            deployment_id: input.deploymentId || null,
            project_id: input.projectId,
            actor_type: input.actorType,
            actor_user_id: input.actorUserId || null,
            actor_label: input.actorLabel,
            message: input.message,
            metadata: input.metadata || null,
        });

        if (error) {
            console.error("[audit-log] Failed to record audit event:", error.message);
        }
    } catch (err) {
        // Never throw - swallow errors safely
        console.error("[audit-log] Unexpected error:", err);
    }
}

/**
 * Derive a human-readable actor label from context.
 */
export function deriveActorLabel(context: {
    source?: string | null;
    isWebhook?: boolean;
    userId?: string | null;
}): string {
    if (context.isWebhook || context.source === "github_webhook") {
        return "GitHub webhook";
    }

    if (context.source === "manual" || context.userId) {
        return "Manual action";
    }

    if (context.source === "runner" || context.source === "system") {
        return "System";
    }

    return "Unknown";
}

/**
 * Helper to create common audit messages
 */
export const AuditMessages = {
    deploymentCreated: (source: string) =>
        source === "github_webhook"
            ? "Deployment created from GitHub push"
            : "Deployment created manually",

    buildStarted: () => "Build process started",

    buildCompleted: () => "Build completed successfully",

    buildFailed: (reason?: string) =>
        reason ? `Build failed: ${reason}` : "Build failed",

    redeployTriggered: (fromDeploymentId: string) =>
        `Redeploy triggered from deployment ${fromDeploymentId.slice(0, 8)}`,

    rollbackTriggered: (toDeploymentId: string) =>
        `Rollback initiated to deployment ${toDeploymentId.slice(0, 8)}`,

    autoDeployEnabled: () => "Auto-deploy enabled for this project",

    autoDeployDisabled: () => "Auto-deploy disabled for this project",

    aiFixPreviewed: () => "AI fix preview generated for failed deployment",

    aiFixApplied: (fixTitle: string) => `AI fix applied: ${fixTitle}`,

    aiFixUndone: () => "AI fix was undone",
};
