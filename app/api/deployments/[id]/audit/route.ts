import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { type AuditLogEntry } from "@/lib/audit-log";

export const dynamic = 'force-dynamic';

/**
 * PRIORITY 12.1: Deployment Audit Log API
 *
 * GET /api/deployments/[deploymentId]/audit
 *
 * Returns audit log entries for a deployment.
 * Read-only, sorted by created_at DESC, limit 50.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: deploymentId } = await params;
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
            .select("id, project_id")
            .eq("id", deploymentId)
            .eq("user_id", user.id)
            .single();

        if (deploymentError || !deployment) {
            return NextResponse.json({
                success: false,
                error: "Deployment not found",
            });
        }

        // Fetch audit logs for this deployment
        const { data: auditLogs, error: auditError } = await supabase
            .from("deployment_audit_logs")
            .select("*")
            .eq("deployment_id", deploymentId)
            .order("created_at", { ascending: false })
            .limit(50);

        if (auditError) {
            console.error("[audit-api] Failed to fetch audit logs:", auditError);
            return NextResponse.json({
                success: true,
                audit: [],
            });
        }

        return NextResponse.json({
            success: true,
            audit: (auditLogs || []) as AuditLogEntry[],
        });
    } catch (error) {
        console.error("[audit-api] Error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to fetch audit logs",
        });
    }
}
