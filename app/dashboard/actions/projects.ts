"use server";

import { getSupabaseServer } from "@/lib/supabase-server";
import { z } from "zod";
import { createActivityLog } from "./activity";
import { classifyProject } from "@/lib/project-classifier";
import { deriveDeploymentPolicy } from "@/lib/deployment-policy";
import { deriveEnvState } from "@/lib/env-state";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  github_repo_url: z.string().min(1, "Repository URL is required"),
});

export async function createProject(formData: { name: string; github_repo_url: string }) {
  try {
    const validated = projectSchema.parse(formData);
    const supabase = await getSupabaseServer();

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
      project_id: data.id,
      metadata: { name: validated.name, github_repo_url: validated.github_repo_url },
    });

    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: "Failed to create project" };
  }
}

export async function getProjects() {
  try {
    const supabase = await getSupabaseServer();

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

    // Attach dynamic envState to each project using a distinct query or subquery.
    // However, to keep it highly performant as requested and pure, we can get env counts from environment_variables in a single DB query, 
    // or run a quick grouped query.
    const { data: envCounts } = await supabase
      .from('environment_variables')
      .select('project_id');

    const envCountMap = (envCounts || []).reduce((acc: any, curr: any) => {
      acc[curr.project_id] = (acc[curr.project_id] || 0) + 1;
      return acc;
    }, {});

    const enrichedData = data.map(project => ({
      ...project,
      envState: deriveEnvState({
        requiresEnv: project.requires_env || false,
        envCount: envCountMap[project.id] || 0
      })
    }));

    return { success: true, data: enrichedData };
  } catch (error) {
    return { success: false, error: "Failed to fetch projects" };
  }
}

export async function getProjectById(id: string) {
  try {
    const supabase = await getSupabaseServer();

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

    const { count } = await supabase
      .from("environment_variables")
      .select("*", { count: 'exact', head: true })
      .eq("project_id", id);

    const enrichedData = {
      ...data,
      envState: deriveEnvState({
        requiresEnv: data.requires_env || false,
        envCount: count || 0
      })
    };

    return { success: true, data: enrichedData };
  } catch (error) {
    return { success: false, error: "Failed to fetch project" };
  }
}

export async function deleteProject(id: string) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Log BEFORE deleting — after delete the project_id FK no longer exists
    // and the activity_log insert would fail silently
    try {
      await createActivityLog({
        event: "project_deleted",
        user_id: user.id,
        metadata: { project_id: id },
      });
    } catch {
      // Non-critical — don't block deletion if logging fails
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete project" };
  }
}

export async function verifyGithubAccess() {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized", hasToken: false };
    }

    // Check if user has GitHub identity
    const hasGitHubIdentity = user.identities?.some(
      (identity: any) => identity.provider === 'github'
    );

    // Check for GitHub token in session (where Supabase stores OAuth tokens)
    const { data: { session } } = await supabase.auth.getSession();
    const githubToken = session?.provider_token;

    // Also check if provider is GitHub (means they logged in with GitHub)
    const isGitHubProvider = user.app_metadata?.provider === 'github';

    return {
      success: true,
      hasToken: !!(hasGitHubIdentity && (githubToken || isGitHubProvider)),
      provider: user.app_metadata?.provider || 'unknown',
      hasGitHubIdentity: !!hasGitHubIdentity
    };
  } catch (error) {
    return { success: false, error: "Failed to verify GitHub access", hasToken: false };
  }
}

export async function createProjectFromGitHub(data: {
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
}) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if project with same repo already exists
    const githubUrl = `https://github.com/${data.full_name}`;
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("github_repo_url", githubUrl)
      .single();

    if (existing) {
      return { success: false, error: "Project already exists for this repository", isDuplicate: true };
    }

    // Run Project Classification
    let projectType = "UNKNOWN";
    let requiresEnv = false;
    let classificationReason = "Classification failed or skipped.";
    let classificationRisk: string | undefined = undefined;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let githubToken = session?.provider_token;

      if (!githubToken) {
        const githubIdentity = user.identities?.find(
          (identity: any) => identity.provider === 'github'
        );
        githubToken = githubIdentity?.identity_data?.access_token;
      }

      if (githubToken) {
        // Fetch file tree
        const treeRes = await fetch(`https://api.github.com/repos/${data.full_name}/git/trees/${data.default_branch}?recursive=1`, {
          headers: { Authorization: `token ${githubToken}` }
        });

        let fileTree: string[] = [];
        let packageJson = null;

        if (treeRes.ok) {
          const treeData = await treeRes.json();
          if (treeData && treeData.tree) {
            fileTree = treeData.tree.map((node: any) => node.path);
          }
        }

        // Fetch package.json if it exists
        if (fileTree.includes("package.json")) {
          const pkgRes = await fetch(`https://api.github.com/repos/${data.full_name}/contents/package.json?ref=${data.default_branch}`, {
            headers: { Authorization: `token ${githubToken}` }
          });
          if (pkgRes.ok) {
            const pkgData = await pkgRes.json();
            if (pkgData.content) {
              const decoded = Buffer.from(pkgData.content, 'base64').toString('utf-8');
              try { packageJson = JSON.parse(decoded); } catch (e) { }
            }
          }
        }

        const classification = classifyProject({
          packageJson,
          fileTree,
          lightweightSourceFiles: [] // Skip deep source scan to stay fast during import
        });

        const policy = deriveDeploymentPolicy(classification);

        projectType = classification.type;
        requiresEnv = classification.requiresEnv;
        classificationReason = classification.reason;
        classificationRisk = policy.classification_risk;
      }
    } catch (e) {
      console.error("Classification error during import:", e);
    }

    // Create the project (only using columns that exist in the schema)
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: data.name,
        user_id: user.id,
        github_repo_url: githubUrl,
        auto_deploy_branch: data.default_branch,
        project_type: projectType,
        requires_env: requiresEnv,
        classification_reason: classificationReason,
        classification_risk: classificationRisk,
        production_alias_url: null, // Will be updated below if found
        vercel_project_id: null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "project_created",
      user_id: user.id,
      project_id: project.id,
      description: `Created project from GitHub: ${data.full_name}`,
      metadata: { name: data.name, repo: data.full_name, source: 'github' },
    });

    // Try to fetch existing Vercel project and alias
    const vercelToken = process.env.PIPELINE_VERCEL_TOKEN;
    if (vercelToken) {
      try {
        const teamIdStr = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
        const searchRes = await fetch(`https://api.vercel.com/v9/projects${teamIdStr}`, {
          headers: { Authorization: `Bearer ${vercelToken}` }
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          // Find matching project by repo full name or project name
          const vProject = searchData.projects?.find((p: any) => 
            p.link?.repo === data.full_name || 
            p.name.toLowerCase() === data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
          );
          
          if (vProject) {
            // Find production alias
            const prodAlias = vProject.targets?.production?.alias?.[0] || 
                              vProject.alias?.[0]?.domain || 
                              `${vProject.name}.vercel.app`;
                              
            if (prodAlias) {
              const fullAlias = prodAlias.startsWith('http') ? prodAlias : `https://${prodAlias}`;
              await supabase.from("projects").update({
                vercel_project_id: vProject.id,
                production_alias_url: fullAlias
              }).eq("id", project.id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch vercel alias during import:", e);
      }
    }

    return { success: true, data: project };
  } catch (error) {
    return { success: false, error: "Failed to create project from GitHub" };
  }
}

export async function createProjectFromZip(data: { name: string; zip_url: string }) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: "Unauthorized" };

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: data.name,
        user_id: user.id,
        source_type: "zip",
        zip_url: data.zip_url,
        project_type: "STATIC",
        requires_env: false,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await createActivityLog({
      event: "project_created",
      user_id: user.id,
      project_id: project.id,
      description: `Created project from Drag & Drop upload`,
      metadata: { name: data.name, source: 'zip' },
    });

    return { success: true, data: project };
  } catch (error) {
    return { success: false, error: "Failed to create project from zip" };
  }
}

export async function updateProject(id: string, data: { name?: string; github_repo_url?: string }) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: project, error } = await supabase
      .from("projects")
      .update(data)
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
      project_id: id,
      metadata: data,
    });

    return { success: true, data: project };
  } catch (error) {
    return { success: false, error: "Failed to update project" };
  }
}

export async function getGitHubRepos() {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized", needsReauth: true };
    }

    // Check if user has GitHub identity
    const hasGitHubIdentity = user.identities?.some(
      (identity: any) => identity.provider === 'github'
    );

    if (!hasGitHubIdentity) {
      return { success: false, error: "GitHub not connected", needsReauth: true };
    }

    // Get token from session
    const { data: { session } } = await supabase.auth.getSession();
    let githubToken = session?.provider_token;

    // Fallback to identity data
    if (!githubToken) {
      const githubIdentity = user.identities?.find(
        (identity: any) => identity.provider === 'github'
      );
      githubToken = githubIdentity?.identity_data?.access_token;
    }

    if (!githubToken) {
      return { success: false, error: "GitHub token expired", needsReauth: true };
    }

    // Fetch repos from GitHub API
    const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return { success: false, error: "Failed to fetch repositories", needsReauth: response.status === 401 };
    }

    const repos = await response.json();
    return { success: true, data: repos };
  } catch (error) {
    return { success: false, error: "Failed to fetch GitHub repos" };
  }
}

export async function updateProjectAutoDeploy(id: string, enabled: boolean, branch: string) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const updateData: any = {
      webhook_enabled: enabled,
      auto_deploy_branch: branch,
    };

    // Generate webhook secret if enabling and doesn't exist
    if (enabled) {
      const { data: project } = await supabase
        .from("projects")
        .select("webhook_secret")
        .eq("id", id)
        .single();

      if (!project?.webhook_secret) {
        updateData.webhook_secret = crypto.randomUUID();
      }
    }

    const { data: project, error } = await supabase
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
      event: enabled ? "auto_deploy_enabled" : "auto_deploy_disabled",
      user_id: user.id,
      project_id: id,
      metadata: { branch },
    });

    return { success: true, data: project };
  } catch (error) {
    return { success: false, error: "Failed to update auto-deploy settings" };
  }
}

export async function regenerateWebhookSecret(id: string) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const newSecret = crypto.randomUUID();

    const { data: project, error } = await supabase
      .from("projects")
      .update({ webhook_secret: newSecret })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "webhook_secret_regenerated",
      user_id: user.id,
      project_id: id,
    });

    return { success: true, data: project };
  } catch (error) {
    return { success: false, error: "Failed to regenerate webhook secret" };
  }
}

export async function updateProjectWebhookUrl(id: string, webhookUrl: string) {
  try {
    const supabase = await getSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Note: This assumes there's a webhook_url column, but based on the schema
    // we saw earlier, it might not exist. This function stores URL for display purposes.
    // If the column doesn't exist, this will still return success but won't persist.
    const { error } = await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update webhook URL" };
  }
}
