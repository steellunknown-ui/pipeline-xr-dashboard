"use server";

import { getSupabaseServer } from "@/lib/supabase-server";
import { createActivityLog } from "./activity";
import { DeploymentEngine } from "@/lib/deployment-engine";
import { normalizeDeploymentSource } from "@/lib/deployment-source";
import { deriveEnvState } from "@/lib/env-state";
import { deriveEnvFingerprint, deriveEnvOutdatedState } from "@/lib/env-fingerprint";

export async function createDeployment(formData: {
  projectId: string;
  environment: string;
  branch: string;
  source?: string;
}) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate and normalize source
    const sourceResult = normalizeDeploymentSource(formData.source || 'manual');
    if (!sourceResult.success) {
      return { success: false, error: sourceResult.error };
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, github_repo_url, project_type, requires_env")
      .eq("id", formData.projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Project not found" };
    }

    // PRIORITY ENV-STATE MACHINE: Deployment Lifecycle Guardrail
    const { data: envVars, count: envCount, error: envError } = await supabase
      .from("environment_variables")
      .select("id, key", { count: 'exact' })
      .eq("project_id", project.id)
      .eq("environment", formData.environment);

    const envState = deriveEnvState({
      requiresEnv: project.requires_env,
      envCount: envCount || 0
    });

    if (envState.status === "REQUIRED_MISSING") {
      return {
        success: false,
        error_code: "ENV_REQUIRED",
        message: "Environment configuration required before deployment.",
        envState
      };
    }

    // Compute deployment footprint 
    const envFingerprint = deriveEnvFingerprint(envVars || []);

    // Create deployment record
    const { data: deployment, error } = await supabase
      .from("deployments")
      .insert({
        project_id: formData.projectId,
        environment: formData.environment,
        branch: formData.branch,
        status: "pending",
        user_id: user.id,
        source: sourceResult.source,
        env_fingerprint: envFingerprint
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Add initial deployment log
    await supabase.from("deployment_logs").insert({
      deployment_id: deployment.id,
      user_id: user.id,
      message: "📋 Deployment queued",
      level: "info"
    });

    // Start simulated deployment engine
    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    DeploymentEngine.startDeployment(deployment.id, projectSlug);

    await createActivityLog({
      event: "deployment_created",
      user_id: user.id,
      description: `Started deployment for ${project.name} (${formData.environment})`,
      project_id: formData.projectId,
      metadata: {
        deploymentId: deployment.id,
        environment: formData.environment,
        branch: formData.branch
      },
    });

    return { success: true, data: deployment };
  } catch (error) {
    return { success: false, error: "Failed to create deployment" };
  }
}


export async function triggerVercelDeploy(formData: {
  projectId: string;
  environment: string;
  branch: string;
}) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get project details (include vercel_project_id if already known)
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, github_repo_url, github_repo_full_name, project_type, requires_env, vercel_project_id, auto_deploy_branch")
      .eq("id", formData.projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Project not found" };
    }

    if (!project.github_repo_url) {
      return { success: false, error: "No GitHub repository connected. Please connect a repo in Project Settings first." };
    }

    // ENV guardrail
    const { data: envVars, count: envCount } = await supabase
      .from("environment_variables")
      .select("id, key", { count: "exact" })
      .eq("project_id", project.id)
      .eq("environment", formData.environment);

    const envState = deriveEnvState({
      requiresEnv: project.requires_env,
      envCount: envCount || 0
    });

    if (envState.status === "REQUIRED_MISSING") {
      return {
        success: false,
        error_code: "ENV_REQUIRED",
        message: "Environment variables required before deployment.",
        envState
      };
    }

    const envFingerprint = deriveEnvFingerprint(envVars || []);

    // Create deployment record in DB
    const { data: deployment, error: deploymentError } = await supabase
      .from("deployments")
      .insert({
        project_id: formData.projectId,
        environment: formData.environment,
        branch: formData.branch,
        status: "pending",
        user_id: user.id,
        source: "github",
        env_fingerprint: envFingerprint,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (deploymentError || !deployment) {
      return { success: false, error: deploymentError?.message || "Failed to create deployment record" };
    }

    // Add initial log
    await supabase.from("deployment_logs").insert({
      deployment_id: deployment.id,
      user_id: user.id,
      message: "📋 Deployment queued — contacting Vercel...",
      level: "info",
    });

    // ─── Vercel API Setup ───────────────────────────────────────────
    const vercelToken = process.env.VERCEL_API_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;

    if (!vercelToken) {
      await supabase.from("deployments").update({ status: "failed", error_message: "Vercel API token not configured." }).eq("id", deployment.id);
      return { success: false, error: "Vercel API token not configured." };
    }

    const vercelHeaders = {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    };

    const queryParams = new URLSearchParams();
    if (teamId) queryParams.append("teamId", teamId);
    queryParams.append("skipAutoDetectionConfirmation", "1");
    const queryString = `?${queryParams.toString()}`;

    // ─── Get GitHub token (needed for private repos) ─────────────────
    const { data: { session } } = await supabase.auth.getSession();
    const githubToken = session?.provider_token;

    // ─── Extract owner/repo from URL ─────────────────────────────────
    const repoMatch = project.github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    if (!repoMatch) {
      await supabase.from("deployments").update({ status: "failed", error_message: "Invalid GitHub repo URL." }).eq("id", deployment.id);
      return { success: false, error: "Invalid GitHub repository URL format." };
    }
    const [, owner, repo] = repoMatch;

    // ─── Get GitHub repo ID ───────────────────────────────────────────
    const ghFetchHeaders: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (githubToken) {
      ghFetchHeaders["Authorization"] = `token ${githubToken}`;
    }

    const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: ghFetchHeaders,
    });

    if (!ghRes.ok) {
      const ghErr = await ghRes.json().catch(() => ({}));
      const msg = ghRes.status === 404
        ? `GitHub repo "${owner}/${repo}" not found. Check the repo is connected and your GitHub session is fresh.`
        : `GitHub API error (${ghRes.status}): ${ghErr.message || ghRes.statusText}`;
      await supabase.from("deployments").update({ status: "failed", error_message: msg }).eq("id", deployment.id);
      await supabase.from("deployment_logs").insert({ deployment_id: deployment.id, user_id: user.id, message: `❌ ${msg}`, level: "error" });
      return { success: false, error: msg };
    }

    const ghData = await ghRes.json();
    const repoId = String(ghData.id);

    await supabase.from("deployment_logs").insert({
      deployment_id: deployment.id,
      user_id: user.id,
      message: `🔗 GitHub repo confirmed: ${owner}/${repo} (ID: ${repoId})`,
      level: "info",
    });

    // ─── Build Vercel project name (slug) ────────────────────────────
    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    // ─── Trigger Vercel Deployment ────────────────────────────────────
    const vercelRes = await fetch(`https://api.vercel.com/v13/deployments${queryString}`, {
      method: "POST",
      headers: vercelHeaders,
      body: JSON.stringify({
        name: projectSlug,
        gitSource: {
          type: "github",
          ref: formData.branch,
          repoId,
        },
        target: formData.environment === "production" ? "production" : undefined,
      }),
    });

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      const errMsg = vercelData.error?.message || vercelData.message || "Unknown Vercel error";
      await supabase.from("deployments").update({ status: "failed", error_message: errMsg, completed_at: new Date().toISOString() }).eq("id", deployment.id);
      await supabase.from("deployment_logs").insert({ deployment_id: deployment.id, user_id: user.id, message: `❌ Vercel error: ${errMsg}`, level: "error" });
      return { success: false, error: `Vercel Error: ${errMsg}` };
    }

    // ─── Save Vercel IDs back to DB ───────────────────────────────────
    await supabase
      .from("deployments")
      .update({ vercel_deployment_id: vercelData.id, status: "building" })
      .eq("id", deployment.id);

    // Save vercel_project_id to project if we got one
    if (vercelData.projectId && !project.vercel_project_id) {
      await supabase
        .from("projects")
        .update({ vercel_project_id: vercelData.projectId })
        .eq("id", project.id);
    }

    await supabase.from("deployment_logs").insert({
      deployment_id: deployment.id,
      user_id: user.id,
      message: `🚀 Deployment started on Vercel! ID: ${vercelData.id}`,
      level: "info",
    });

    await createActivityLog({
      event: "deployment_created",
      user_id: user.id,
      description: `Started Vercel deployment for ${project.name} (${formData.environment})`,
      project_id: formData.projectId,
      metadata: {
        deploymentId: deployment.id,
        vercelDeploymentId: vercelData.id,
        environment: formData.environment,
        branch: formData.branch,
      },
    });

    return { success: true, data: deployment };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to trigger Vercel deployment" };
  }
}




export async function getDeployments(projectId?: string) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    let query = supabase
      .from("deployments")
      .select(`
        *,
        projects (
          id,
          name,
          requires_env
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // Attach dynamic envState to each deployment's embedded project
    // and dynamic envOutdated state
    const { data: envCounts } = await supabase
      .from('environment_variables')
      .select('project_id, environment, key');

    const envCountMap = (envCounts || []).reduce((acc: any, curr: any) => {
      acc[curr.project_id] = (acc[curr.project_id] || 0) + 1;
      return acc;
    }, {});

    const currEnvMap: Record<string, { key: string }[]> = {};
    (envCounts || []).forEach((ev: any) => {
      const k = `${ev.project_id}-${ev.environment}`;
      if (!currEnvMap[k]) currEnvMap[k] = [];
      currEnvMap[k].push({ key: ev.key });
    });

    const enrichedData = data.map(deployment => {
      const k = `${deployment.project_id}-${deployment.environment}`;
      const currentFingerprint = deriveEnvFingerprint(currEnvMap[k] || []);
      const envOutdated = deriveEnvOutdatedState({
        deploymentFingerprint: deployment.env_fingerprint,
        currentFingerprint
      });

      return {
        ...deployment,
        envOutdated,
        projects: deployment.projects ? {
          ...deployment.projects,
          envState: deriveEnvState({
            requiresEnv: deployment.projects.requires_env || false,
            envCount: envCountMap[deployment.projects.id] || 0
          })
        } : null
      };
    });

    return { success: true, data: enrichedData };
  } catch (error) {
    return { success: false, error: "Failed to fetch deployments" };
  }
}

export async function getDeploymentById(id: string) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("deployments")
      .select(`
        *,
        projects (
          id,
          name,
          requires_env
        )
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    let envCount = 0;
    let currEnvVars: any[] = [];
    if (data.projects?.id) {
      const { data: envs, count } = await supabase
        .from("environment_variables")
        .select("id, key", { count: 'exact' })
        .eq("project_id", data.projects.id)
        .eq("environment", data.environment);

      envCount = count || 0;
      currEnvVars = envs || [];
    }

    const currentFingerprint = deriveEnvFingerprint(currEnvVars);
    const envOutdated = deriveEnvOutdatedState({
      deploymentFingerprint: data.env_fingerprint,
      currentFingerprint
    });

    const enrichedData = {
      ...data,
      envOutdated,
      projects: data.projects ? {
        ...data.projects,
        envState: deriveEnvState({
          requiresEnv: data.projects.requires_env || false,
          envCount
        })
      } : null
    };

    return { success: true, data: enrichedData };
  } catch (error) {
    return { success: false, error: "Failed to fetch deployment" };
  }
}