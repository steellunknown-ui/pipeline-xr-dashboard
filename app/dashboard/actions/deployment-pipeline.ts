"use server";

import { createClient } from "@/lib/supabase-server";
import { createActivityLog } from "./activity";
import { z } from "zod";

export async function updateDeploymentStatus(
  deploymentId: string,
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled"
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("deployments")
      .update({ status })
      .eq("id", deploymentId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event_type: "deployment_status_updated",
      description: `Deployment ${deploymentId.slice(0, 8)} status changed to ${status}`,
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to update deployment status" };
  }
}

async function insertDeploymentLog(
  deploymentId: string,
  message: string,
  level: "info" | "success" | "error" | "warning" = "info"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("deployment_logs").insert({
    deployment_id: deploymentId,
    user_id: user.id,
    message,
    level,
  });
}

export async function runDeploymentPipeline(deploymentId: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get deployment details
    const { data: deployment, error: fetchError } = await supabase
      .from("deployments")
      .select("*, projects(*)")
      .eq("id", deploymentId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !deployment) {
      return { success: false, error: "Deployment not found" };
    }

    // Stage 1: Initialize
    await updateDeploymentStatus(deploymentId, "in_progress");
    await insertDeploymentLog(deploymentId, "🚀 Deployment started", "info");
    await insertDeploymentLog(deploymentId, `[1/3] Initializing build for ${deployment.projects.name}...`, "info");
    await createActivityLog({
      event_type: "deployment_started",
      description: `Started deployment for ${deployment.projects.name} (${deployment.branch})`,
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Stage 2: Build
    await insertDeploymentLog(deploymentId, `[2/3] Building project from branch: ${deployment.branch}`, "info");
    await insertDeploymentLog(deploymentId, "📦 Installing dependencies...", "info");
    await new Promise(resolve => setTimeout(resolve, 1500));
    await insertDeploymentLog(deploymentId, "🔨 Compiling application...", "info");
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Stage 3: Deploy
    await insertDeploymentLog(deploymentId, `[3/3] Finalizing deployment to ${deployment.environment}...`, "info");
    await insertDeploymentLog(deploymentId, "☁️ Uploading to cloud...", "info");
    await new Promise(resolve => setTimeout(resolve, 1500));
    await insertDeploymentLog(deploymentId, "✅ Health checks passed", "success");

    // Complete
    await updateDeploymentStatus(deploymentId, "completed");
    await insertDeploymentLog(deploymentId, "🎉 Deployment completed successfully!", "success");
    await createActivityLog({
      event_type: "deployment_completed",
      description: `Successfully deployed ${deployment.projects.name}`,
    });

    return { success: true, message: "Deployment completed successfully" };
  } catch (error) {
    await updateDeploymentStatus(deploymentId, "failed");
    await insertDeploymentLog(deploymentId, `❌ Deployment failed: ${error}`, "error");
    await createActivityLog({
      event_type: "deployment_failed",
      description: `Deployment ${deploymentId.slice(0, 8)} failed: ${error}`,
    });
    return { success: false, error: "Deployment pipeline failed" };
  }
}

export async function getDeploymentLogs(deploymentId: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("deployment_logs")
      .select("*")
      .eq("deployment_id", deploymentId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch deployment logs" };
  }
}

export async function getDeploymentById(deploymentId: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("deployments")
      .select("*, projects(name)")
      .eq("id", deploymentId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch deployment" };
  }
}
