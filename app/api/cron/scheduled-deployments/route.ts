import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    
    // Find scheduled deployments that are due
    const { data: dueDeployments, error: fetchError } = await supabase
      .from("deployments")
      .select(`
        *,
        projects (
          id,
          name,
          github_repo_url,
          auto_deploy_branch,
          project_type,
          requires_env,
          vercel_project_id
        )
      `)
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString());

    if (fetchError) {
      console.error("Cron fetch error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!dueDeployments || dueDeployments.length === 0) {
      return NextResponse.json({ message: "No scheduled deployments due." });
    }

    const vercelToken = process.env.VERCEL_API_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    
    let processedCount = 0;

    for (const deployment of dueDeployments) {
      const project = deployment.projects;
      if (!project) continue;

      if (deployment.source === "github" && vercelToken) {
        try {
          const repoMatch = project.github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
          if (!repoMatch) throw new Error("Invalid GitHub repo URL");
          
          const [, owner, repo] = repoMatch;
          
          // Get GitHub repo ID
          // Note: In a cron, we might not have the user's GitHub token unless we saved it. 
          // But Vercel API needs repoId. If Vercel project is already linked, we might not need repoId.
          // Since PipelineXR creates fresh deployments via gitSource, we will use a fallback or fetch it publicly.
          const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
          const ghData = await ghRes.json();
          const repoId = ghData.id ? String(ghData.id) : null;
          
          if (!repoId) throw new Error("Could not find GitHub Repo ID");

          const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
          const queryString = teamId ? `?teamId=${teamId}` : "";
          
          const vercelRes = await fetch(`https://api.vercel.com/v13/deployments${queryString}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: projectSlug,
              gitSource: {
                type: "github",
                ref: deployment.branch,
                repoId,
              },
              target: deployment.environment === "production" ? "production" : undefined,
            }),
          });

          const vercelData = await vercelRes.json();
          if (!vercelRes.ok) throw new Error(vercelData.error?.message || "Vercel API error");

          // Update DB
          await supabase
            .from("deployments")
            .update({ 
              status: "building", 
              vercel_deployment_id: vercelData.id,
              started_at: new Date().toISOString()
            })
            .eq("id", deployment.id);
            
          await supabase.from("deployment_logs").insert({
            deployment_id: deployment.id,
            user_id: deployment.user_id,
            message: `⏰ Scheduled deployment started automatically! (Vercel ID: ${vercelData.id})`,
            level: "success",
          });
          
          processedCount++;
        } catch (err: any) {
          await supabase
            .from("deployments")
            .update({ status: "failed", error_message: err.message })
            .eq("id", deployment.id);
            
          await supabase.from("deployment_logs").insert({
            deployment_id: deployment.id,
            user_id: deployment.user_id,
            message: `❌ Scheduled deployment failed to start: ${err.message}`,
            level: "error",
          });
        }
      } else if (deployment.source === "zip") {
        // Handle ZIP local deployments (PipelineXR build runner)
        await supabase
          .from("deployments")
          .update({ 
            status: "queued",
            started_at: new Date().toISOString()
          })
          .eq("id", deployment.id);
          
        await supabase.from("deployment_logs").insert({
          deployment_id: deployment.id,
          user_id: deployment.user_id,
          message: `⏰ Scheduled ZIP deployment queued automatically!`,
          level: "success",
        });
        
        processedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: processedCount 
    });

  } catch (error: any) {
    console.error("Cron handler error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
