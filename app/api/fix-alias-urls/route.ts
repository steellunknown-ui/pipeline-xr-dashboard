import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { fetchProductionAlias, verifyLiveUrl, generateScreenshotUrl } from "@/lib/alias-resolver";

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServer();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    const vercelToken = process.env.PIPELINE_VERCEL_TOKEN;
    if (!vercelToken) {
      return NextResponse.json({ error: "Vercel API token missing" }, { status: 500 });
    }

    // Get all deployments missing alias_url
    const { data: deployments } = await supabase
      .from("deployments")
      .select("id, project_id, vercel_deployment_id, projects(id, name, vercel_project_id)")
      .is("alias_url", null)
      .eq("user_id", user.id);

    if (!deployments || deployments.length === 0) {
      return NextResponse.json({ fixed: 0, pending: 0, failed: 0 });
    }

    let fixed = 0;
    let failed = 0;

    for (const dep of deployments) {
      let aliasUrl: string | null = null;
      
      if (dep.vercel_deployment_id) {
        aliasUrl = await fetchProductionAlias(dep.vercel_deployment_id, vercelToken);
      } else if (dep.projects) {
        // Fallback: try to find the project alias directly via Vercel API
        try {
          const projectName = Array.isArray(dep.projects) ? dep.projects[0]?.name : (dep.projects as any)?.name;
          const vProjectId = Array.isArray(dep.projects) ? dep.projects[0]?.vercel_project_id : (dep.projects as any)?.vercel_project_id;
          
          const teamIdStr = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
          
          if (vProjectId) {
             const projRes = await fetch(`https://api.vercel.com/v9/projects/${vProjectId}${teamIdStr}`, {
               headers: { Authorization: `Bearer ${vercelToken}` }
             });
             if (projRes.ok) {
                const vProject = await projRes.json();
                const prodAlias = vProject.targets?.production?.alias?.[0] || vProject.alias?.[0]?.domain || `${vProject.name}.vercel.app`;
                if (prodAlias) {
                  aliasUrl = prodAlias.startsWith('http') ? prodAlias : `https://${prodAlias}`;
                }
             }
          }
          
          if (!aliasUrl && projectName) {
            const searchRes = await fetch(`https://api.vercel.com/v9/projects${teamIdStr}`, {
              headers: { Authorization: `Bearer ${vercelToken}` }
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const vProject = searchData.projects?.find((p: any) => p.name.toLowerCase() === projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
              if (vProject) {
                const prodAlias = vProject.targets?.production?.alias?.[0] || vProject.alias?.[0]?.domain || `${vProject.name}.vercel.app`;
                if (prodAlias) {
                  aliasUrl = prodAlias.startsWith('http') ? prodAlias : `https://${prodAlias}`;
                }
              }
            }
          }
        } catch (e) {
          console.error("Error finding alias via project fallback", e);
        }
      }

      if (aliasUrl) {
        const isLive = await verifyLiveUrl(aliasUrl);
        const screenshotUrl = isLive ? generateScreenshotUrl(aliasUrl) : null;
        
        await supabase.from("deployments").update({
          alias_url: aliasUrl,
          alias_status: 'assigned',
          preview_image_url: screenshotUrl
        }).eq("id", dep.id);

        await supabase.from("projects").update({
          production_alias_url: aliasUrl
        }).eq("id", dep.project_id);

        fixed++;
      } else {
        await supabase.from("deployments").update({ alias_status: 'failed' }).eq("id", dep.id);
        failed++;
      }
    }

    return NextResponse.json({ fixed, pending: 0, failed });
  } catch (error: any) {
    console.error("Backfill error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
