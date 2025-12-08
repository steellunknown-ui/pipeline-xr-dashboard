"use server";

import { createClient } from "@/lib/supabase-server";
import { z } from "zod";
import { createActivityLog } from "./activity";

const deploymentIdSchema = z.string().uuid("Invalid deployment ID");

const deploymentSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  environment: z.enum(["development", "staging", "production"]),
  branch: z.string().min(1, "Branch is required"),
  commit_hash: z.string().optional(),
});

async function insertDeploymentLog(
  deploymentId: string,
  message: string,
  level: "info" | "warn" | "error" | "success" = "info"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("deployment_logs").insert({
    deployment_id: deploymentId,
    user_id: user.id,
    level,
    message,
  });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runDeployment(deploymentId: string) {
  try {
    const validated = deploymentIdSchema.parse(deploymentId);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Load deployment with project
    const { data: deployment, error: fetchError } = await supabase
      .from("deployments")
      .select("*, projects(name, github_repo_url)")
      .eq("id", validated)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !deployment) {
      return { success: false, error: "Deployment not found" };
    }

    // Update status to queued
    await supabase
      .from("deployments")
      .update({ status: "queued" })
      .eq("id", validated)
      .eq("user_id", user.id);

    await createActivityLog({
      event: "deployment_queued",
      user_id: user.id,
      description: `Deployment queued for ${deployment.projects.name}`,
      deployment_id: validated,
      project_id: deployment.project_id,
      metadata: { project_name: deployment.projects.name, environment: deployment.environment, branch: deployment.branch, status: "queued" },
    });

    // Stage 1: Initialize
    await insertDeploymentLog(validated, "[1/4] Initializing deployment...", "info");
    await delay(800);

    // Update to in_progress
    await supabase
      .from("deployments")
      .update({ status: "in_progress" })
      .eq("id", validated)
      .eq("user_id", user.id);

    await createActivityLog({
      event: "deployment_building",
      user_id: user.id,
      description: `Building ${deployment.projects.name}`,
      deployment_id: validated,
      project_id: deployment.project_id,
      metadata: { project_name: deployment.projects.name, environment: deployment.environment, branch: deployment.branch, status: "building" },
    });

    // Stage 2: Connect to repo
    await insertDeploymentLog(validated, `[2/4] Connecting to GitHub repository ${deployment.projects.github_repo_url}...`, "info");
    await delay(1000);

    // Stage 3: Build
    await insertDeploymentLog(validated, `[3/4] Simulating build for branch ${deployment.branch}...`, "info");
    await insertDeploymentLog(validated, "📦 Installing dependencies...", "info");
    await delay(1200);
    await insertDeploymentLog(validated, "🔨 Building application...", "info");
    await delay(1000);

    await createActivityLog({
      event: "deployment_deploying",
      user_id: user.id,
      description: `Deploying ${deployment.projects.name} to ${deployment.environment}`,
      deployment_id: validated,
      project_id: deployment.project_id,
      metadata: { project_name: deployment.projects.name, environment: deployment.environment, branch: deployment.branch, status: "deploying" },
    });

    // Stage 4: Finalize
    await insertDeploymentLog(validated, `[4/4] Finalizing deployment to ${deployment.environment}...`, "info");
    await delay(800);

    // Randomly simulate success or failure (90% success)
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      await insertDeploymentLog(validated, "✅ Deployment completed successfully!", "success");
      await supabase
        .from("deployments")
        .update({ status: "completed" })
        .eq("id", validated)
        .eq("user_id", user.id);

      await createActivityLog({
        event: "deployment_completed",
        user_id: user.id,
        description: `Successfully deployed ${deployment.projects.name} to ${deployment.environment}`,
        deployment_id: validated,
        project_id: deployment.project_id,
        metadata: { project_name: deployment.projects.name, environment: deployment.environment, branch: deployment.branch, status: "completed" },
      });

      return { success: true };
    } else {
      await insertDeploymentLog(validated, "❌ Deployment failed: Build error", "error");
      await supabase
        .from("deployments")
        .update({ status: "failed" })
        .eq("id", validated)
        .eq("user_id", user.id);

      await createActivityLog({
        event: "deployment_failed",
        user_id: user.id,
        description: `Deployment failed for ${deployment.projects.name}`,
        deployment_id: validated,
        project_id: deployment.project_id,
        metadata: { project_name: deployment.projects.name, environment: deployment.environment, branch: deployment.branch, status: "failed", error: "Build error" },
      });

      return { success: false, error: "Deployment failed" };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Failed to run deployment" };
  }
}

export async function createDeployment(formData: {
  project_id: string;
  environment: "development" | "staging" | "production";
  branch: string;
  commit_hash?: string;
}) {
  try {
    const validated = deploymentSchema.parse(formData);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("deployments")
      .insert({
        project_id: validated.project_id,
        environment: validated.environment,
        branch: validated.branch,
        commit_hash: validated.commit_hash || null,
        status: "queued",
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "deployment_created",
      user_id: user.id,
      description: `Created deployment to ${validated.environment}`,
      deployment_id: data.id,
      project_id: validated.project_id,
      metadata: { environment: validated.environment, branch: validated.branch, commit_hash: validated.commit_hash },
    });

    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Failed to create deployment" };
  }
}

export async function getDeployments(projectId?: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    let query = supabase
      .from("deployments")
      .select("*, projects(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch deployments" };
  }
}
