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