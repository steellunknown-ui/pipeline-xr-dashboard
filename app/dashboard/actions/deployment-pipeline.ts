"use server";

import { getSupabaseServer } from "@/lib/supabase-server";

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
      .select("*, projects(name)")
      .eq("id", deploymentId)
      .single();

    if (!deployment) return { success: false, error: "Deployment not found" };

    // Generate URL early
    const projectSlug = deployment.projects.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const deploymentUrl = `https://${projectSlug}-${deployment.environment}.pipelinexr.app`;

    // Start deployment
    await supabase.from("deployments").update({ status: "building" }).eq("id", deploymentId);
    await insertLogIfNew(deploymentId, user.id, "🚀 Build started", "info");

    await new Promise(resolve => setTimeout(resolve, 2000));

    await insertLogIfNew(deploymentId, user.id, "📦 Installing dependencies...", "info");
    await new Promise(resolve => setTimeout(resolve, 2000));

    await insertLogIfNew(deploymentId, user.id, "🔨 Building application...", "info");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Complete with URL stored
    await supabase.from("deployments").update({
      status: "success",
      deployment_url: deploymentUrl
    }).eq("id", deploymentId);

    await insertLogIfNew(deploymentId, user.id, `🌐 Live at: ${deploymentUrl}`, "success");
    await insertLogIfNew(deploymentId, user.id, "🎉 Deployment successful!", "success");

    return { success: true, message: "Deployment completed successfully" };
  } catch (error) {
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