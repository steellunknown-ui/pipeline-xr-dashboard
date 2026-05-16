import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { deriveDeploymentActivities, type DeploymentActivity } from "@/lib/deployment-activity";

/**
 * PRIORITY 9.3: Activity Feed API (READ-ONLY)
 * 
 * Fetches last 10 deployments and derives activity events.
 * Always returns HTTP 200 with JSON.
 */
export async function GET() {
    try {
        const supabase = await createClient();

        // Get current user (optional - graceful if not authenticated)
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Return empty activities for unauthenticated users
            return NextResponse.json({
                success: true,
                activities: [] as DeploymentActivity[],
            });
        }

        // Fetch last 10 deployments with project info
        const { data: deployments, error } = await supabase
            .from("deployments")
            .select(`
        id,
        status,
        source,
        project_id,
        commit_sha,
        commit_message,
        branch,
        created_at,
        projects (
          id,
          name
        )
      `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error("Activity fetch error:", error);
            // Return empty array on error - never break the UI
            return NextResponse.json({
                success: true,
                activities: [] as DeploymentActivity[],
            });
        }

        // Normalize deployments - Supabase joins can return array for projects
        const normalizedDeployments = (deployments || []).map(d => ({
            ...d,
            projects: Array.isArray(d.projects) ? d.projects[0] : d.projects
        }));

        // Derive activities from deployments
        const activities = deriveDeploymentActivities(normalizedDeployments);

        return NextResponse.json({
            success: true,
            activities,
        });

    } catch (error) {
        console.error("Activity API error:", error);
        // Always return valid JSON with empty array
        return NextResponse.json({
            success: true,
            activities: [] as DeploymentActivity[],
        });
    }
}
