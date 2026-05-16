import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * GET /api/projects/[id]/deployments
 * Fetch recent deployments for a project
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const supabase = await createClient();

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({
                success: false,
                error: "Unauthorized"
            }, { status: 401 });
        }

        // Get limit from query params (default 5)
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "5");

        // Verify project ownership
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({
                success: false,
                error: "Project not found"
            }, { status: 404 });
        }

        // Fetch deployments
        const { data: deployments, error: deploymentsError } = await supabase
            .from("deployments")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (deploymentsError) {
            console.error("[Deployments API] Error:", deploymentsError);
            return NextResponse.json({
                success: false,
                error: "Failed to fetch deployments"
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            deployments: deployments || []
        }, { status: 200 });

    } catch (error: any) {
        console.error("[Deployments API] Unexpected error:", error);
        return NextResponse.json({
            success: false,
            error: "Internal server error"
        }, { status: 500 });
    }
}
