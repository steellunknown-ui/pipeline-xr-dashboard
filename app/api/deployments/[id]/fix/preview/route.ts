import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { analyzeFailure } from "@/lib/failure-analyzer";
import { suggestFix } from "@/lib/fix-suggester";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: deploymentId } = await params;
        const supabase = await createClient();

        // 1. Auth & Deployment Check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { data: deployment, error: deployError } = await supabase
            .from("deployments")
            .select("*, projects(name)")
            .eq("id", deploymentId)
            .eq("user_id", user.id)
            .single();

        if (deployError || !deployment) {
            return NextResponse.json({ success: false, error: "Deployment not found" }, { status: 404 });
        }

        if (deployment.status !== "failed") {
            return NextResponse.json({
                success: false,
                error: "Fixes only available for failed deployments"
            }, { status: 400 });
        }

        // 2. Fetch Logs
        const { data: logs } = await supabase
            .from("deployment_logs")
            .select("message")
            .eq("deployment_id", deploymentId)
            .order("created_at", { ascending: true });

        const logMessages = logs?.map(l => l.message) || [];

        // 3. Analyze Failure
        // Helper to extract source (zip vs github)
        const source = deployment.source || "manual";
        const analysis = await analyzeFailure(logMessages, source);

        // 4. Construct Workdir Path
        let workdir = path.join(os.tmpdir(), `pipeline-xr-gh-${deploymentId}`);
        if (!fs.existsSync(workdir)) {
            workdir = path.join(os.tmpdir(), `pipeline-xr-${deploymentId}`);
        }

        // Verify workdir exists
        if (!fs.existsSync(workdir)) {
            // If workdir is gone, we can't patch files.
            // We return a plan saying "Workspace expired".
            return NextResponse.json({
                success: true,
                deploymentId,
                plan: {
                    title: "Workspace expired",
                    summary: "The build workspace is no longer available. Re-run the deployment to enable fixing.",
                    confidence: 0.0,
                    changes: [],
                    fix_steps: analysis.fix_steps || []
                }
            });
        }

        // 5. Generate Fix Suggestion
        const plan = await suggestFix(analysis, workdir);

        return NextResponse.json({
            success: true,
            deploymentId,
            plan
        });

    } catch (error: any) {
        console.error(`Fix preview error: ${error.message}`);
        return NextResponse.json({
            success: false,
            error: "Failed to generate fix preview"
        }, { status: 500 });
    }
}
