"use server";

import { createClient } from "@/lib/supabase-server";
import { z } from "zod";
import { createActivityLog } from "./activity";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  github_repo_url: z.string().min(1, "Repository URL is required"),
});

export async function createProject(formData: { name: string; github_repo_url: string }) {
  try {
    const validated = projectSchema.parse(formData);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: validated.name,
        github_repo_url: validated.github_repo_url,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "project_created",
      user_id: user.id,
      description: `Created project: ${validated.name}`,
      project_id: data.id,
      metadata: { name: validated.name, github_repo_url: validated.github_repo_url },
    });

    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Failed to create project" };
  }
}

export async function getProjects() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch projects" };
  }
}

export async function getProjectById(id: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch project" };
  }
}

export async function updateProject(id: string, formData: { name?: string; github_repo_url?: string }) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const updateData: any = {};
    if (formData.name) updateData.name = formData.name;
    if (formData.github_repo_url) updateData.github_repo_url = formData.github_repo_url;

    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "project_updated",
      user_id: user.id,
      description: `Updated project: ${data.name}`,
      project_id: id,
      metadata: updateData,
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to update project" };
  }
}

export async function deleteProject(id: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "project_deleted",
      user_id: user.id,
      description: `Deleted project: ${project?.name || id}`,
      project_id: id,
      metadata: { project_id: id, name: project?.name },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete project" };
  }
}

export async function getGitHubRepos() {
  try {
    const supabase = await createClient();

    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return { success: false, error: "Unauthorized", needsReauth: false };
    }

    const githubToken = session.provider_token;
    if (!githubToken) {
      return { success: false, error: "GitHub not connected", needsReauth: true };
    }

    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator", {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: "GitHub token expired. Please reconnect.", needsReauth: true };
    }

    if (!response.ok) {
      return { success: false, error: "Failed to fetch GitHub repos", needsReauth: false };
    }

    const repos = await response.json();
    return { success: true, data: repos, needsReauth: false };
  } catch (error) {
    return { success: false, error: "Failed to fetch GitHub repos", needsReauth: false };
  }
}

export async function updateProjectAutoDeploy(
  projectId: string,
  enabled: boolean,
  branch: string
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const updateData: any = {
      auto_deploy_enabled: enabled,
      auto_deploy_branch: branch,
    };

    // Generate webhook secret if enabling and no secret exists
    if (enabled) {
      const { data: project } = await supabase
        .from("projects")
        .select("webhook_secret")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

      if (!project?.webhook_secret) {
        updateData.webhook_secret = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
      }
    }

    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: enabled ? "auto_deploy_enabled" : "auto_deploy_disabled",
      user_id: user.id,
      description: `Auto-deploy ${enabled ? "enabled" : "disabled"} for branch ${branch}`,
      project_id: projectId,
      metadata: { enabled, branch },
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to update auto-deploy settings" };
  }
}

export async function regenerateWebhookSecret(projectId: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const newSecret = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

    const { data, error } = await supabase
      .from("projects")
      .update({ webhook_secret: newSecret })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "webhook_secret_regenerated",
      user_id: user.id,
      description: "Webhook secret regenerated",
      project_id: projectId,
      metadata: {},
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to regenerate webhook secret" };
  }
}
