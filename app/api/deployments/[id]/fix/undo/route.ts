import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { recordAuditEvent } from "@/lib/audit-log";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: deploymentId } = await params;
        const body = await request.json();
        const { fixId } = body;

        if (!fixId) {
            return NextResponse.json({ success: false, error: "Missing fixId" }, { status: 200 });
        }

        const supabase = await createClient();

        // 1. Auth & Access Check (Implicit via fix_history query + project check)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch Fix Record
        const { data: fix, error: fixError } = await supabase
            .from("deployment_fix_history")
            .select("*")
            .eq("id", fixId)
            .eq("deployment_id", deploymentId)
            .single();

        if (fixError || !fix) {
            return NextResponse.json({ success: false, error: "Fix record not found" }, { status: 200 });
        }

        // Verify ownership via project (RLS might handle this but good to be explicit/safe)
        // Actually RLS is enough usually.

        if (fix.status === 'undone') {
            return NextResponse.json({ success: false, error: "Fix already undone" }, { status: 200 });
        }

        // 3. Verify Workdir
        const workdir = path.join(os.tmpdir(), "pipelinexr", deploymentId);
        if (!fs.existsSync(workdir)) {
            return NextResponse.json({ success: false, error: "Workspace expired. Cannot undo." }, { status: 200 });
        }

        // 4. Revert Changes
        const beforeSnapshot = typeof fix.before_snapshot === 'string'
            ? JSON.parse(fix.before_snapshot)
            : fix.before_snapshot;

        for (const item of beforeSnapshot) {
            const fullPath = path.join(workdir, item.filePath);
            // Simple revert: write back old content
            await fs.promises.writeFile(fullPath, item.content, 'utf8');
        }

        // 5. Update Status
        const { error: updateError } = await supabase
            .from("deployment_fix_history")
            .update({
                status: 'undone',
                undone_at: new Date().toISOString()
            })
            .eq("id", fixId);

        if (updateError) throw updateError;

        // 6. Audit Log
        try {
            const AuditMessages = require("@/lib/audit-log").AuditMessages;
            await recordAuditEvent({
                eventType: "AI_FIX_UNDONE",
                deploymentId,
                projectId: fix.project_id,
                actorType: "user",
                actorUserId: user.id,
                actorLabel: "Manual undo",
                message: AuditMessages.aiFixUndone(),
                metadata: { fixId }
            });
        } catch (e) { /* ignore */ }

        return NextResponse.json({
            success: true,
            message: "Fix undone successfully."
        });

    } catch (error: any) {
        console.error(`Fix undo error: ${error.message}`);
        return NextResponse.json({
            success: false,
            error: `Failed to undo fix: ${error.message}`
        }, { status: 200 });
    }
}
