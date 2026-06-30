"use server";

import { getSupabaseServer } from "@/lib/supabase-server";
import { disableDeploymentProtection } from "./vercel-protection";
import { pollForAliasWithRetries } from '@/lib/alias-resolver';

async function insertLogIfNew(deploymentId: string, userId: string, message: string, level: string) {
  const supabase = await getSupabaseServer();

  // Check if same message exists in last 10 seconds
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  const { data: recentLogs } = await supabase
    .from('deployment_logs')
    .select('message')
    .eq('deployment_id', deploymentId)
    .eq('message', message)
    .gte('created_at', tenSecondsAgo)
    .limit(1);

  if (recentLogs && recentLogs.length > 0) {
    return; // Skip duplicate message
  }

  await supabase.from('deployment_logs').insert({
    deployment_id: deploymentId,
    user_id: userId,
    message,
    level
  });
}

export async function runDeploymentPipeline(deploymentId: string) {
  const supabase = await getSupabaseServer();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // Get deployment
    const { data: deployment } = await supabase
      .from("deployments")
      .select("*, projects(id, name, github_repo_url)")
      .eq("id", deploymentId)
      .single();

    if (!deployment || !deployment.projects) return { success: false, error: "Deployment or Project not found" };

    if (!deployment.projects.github_repo_url) {
      return { success: false, error: "Project has no GitHub repository connected. Cannot deploy to Vercel." };
    }

    // Start deployment
    await supabase.from("deployments").update({ status: "building" }).eq("id", deploymentId);
    await insertLogIfNew(deploymentId, user.id, "🚀 Contacting Vercel...", "info");

    const vercelToken = process.env.PIPELINE_XR_VERCEL_TOKEN || process.env.PIPELINE_VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      return { success: false, error: "Vercel API token not configured." };
    }

    let repoId = deployment.projects.github_repo_id?.toString();
    const owner = deployment.projects.github_owner || deployment.projects.github_repo_full_name?.split('/')[0];
    
    if (!repoId) {
      // Extract owner/repo from URL
      const repoMatch = deployment.projects.github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) {
        return { success: false, error: "Invalid GitHub repository URL format." };
      }
      const repoOwner = repoMatch[1];
      const repoName = repoMatch[2];

      const ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`);
      if (!ghRes.ok) {
        return { success: false, error: "Failed to fetch repository details from GitHub API." };
      }
      const ghData = await ghRes.json();
      repoId = ghData.id.toString();
    }

    // Fetch env vars
    const { data: envVars } = await supabase
      .from("environment_variables")
      .select("*")
      .eq("project_id", deployment.projects.id);

    const vercelEnv: Record<string, string> = {};
    envVars?.forEach((e: any) => {
      if (e.key && e.value) {
        vercelEnv[e.key] = e.value;
      }
    });

    let vercelUrl = "https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1";
    if (teamId) {
      vercelUrl += `&teamId=${teamId}`;
    }

    const vercelRes = await fetch(vercelUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: deployment.projects.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        gitSource: {
          type: "github",
          ref: deployment.branch,
          repoId: repoId,
          org: owner || undefined
        },
        env: Object.keys(vercelEnv).length > 0 ? vercelEnv : undefined,
        projectSettings: deployment.projects.framework ? { framework: deployment.projects.framework } : undefined
      })
    });

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      await insertLogIfNew(deploymentId, user.id, `❌ Vercel error: ${vercelData.error?.message || 'Unknown error'}`, "error");
      await supabase.from("deployments").update({ status: "failed" }).eq("id", deploymentId);
      return { success: false, error: `Vercel Error: ${vercelData.error?.message || 'Unknown'}` };
    }

    await supabase
      .from("deployments")
      .update({ vercel_deployment_id: vercelData.id })
      .eq("id", deploymentId);

    if (vercelData.projectId) {
      // Disable Vercel Deployment Protection for smooth previews
      await disableDeploymentProtection(vercelData.projectId);
      
      // Store the Vercel project ID if we don't have it yet
      await supabase
        .from("projects")
        .update({ vercel_project_id: vercelData.projectId })
        .eq("id", deployment.projects.id);
        
      // Poll for alias asynchronously
      pollForAliasWithRetries(deploymentId, vercelData.id, deployment.projects.id, vercelToken).catch(e => console.error("Alias polling failed:", e));
    }

    await insertLogIfNew(deploymentId, user.id, "🚀 Deployment started on Vercel", "info");

    return { success: true, message: "Deployment triggered on Vercel" };
  } catch (error: any) {
    await supabase.from("deployments").update({ status: "failed" }).eq("id", deploymentId);
    console.error(`Deployment ${deploymentId} failed:`, error);
    return { success: false, error: "Deployment failed" };
  }
}

export async function getDeploymentLogs(deploymentId: string) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("deployment_logs")
      .select("*")
      .eq("deployment_id", deploymentId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch deployment logs" };
  }
}
