import { getSupabaseServer } from "@/lib/supabase-server";

export async function startDeploymentWatcher(userId: string, deploymentId: string) {
  const supabase = await getSupabaseServer();
  let lastStatus = 'queued';

  const checkStatus = async () => {
    try {
      const { data: deployment } = await supabase
        .from("deployments")
        .select("status")
        .eq("id", deploymentId)
        .single();

      if (deployment && deployment.status !== lastStatus) {
        await sendAutoUpdate(userId, deploymentId, deployment.status);
        lastStatus = deployment.status;

        if (deployment.status === "success" || deployment.status === "completed" || deployment.status === "failed" || deployment.status === "cancelled") {
          return; // Stop watching
        }
      }

      // Continue watching
      setTimeout(checkStatus, 3000);
    } catch (error) {
      console.error('Watcher error:', error);
    }
  };

  // Start watching after 2 seconds
  setTimeout(checkStatus, 2000);
}

async function sendAutoUpdate(userId: string, deploymentId: string, status: string) {
  const supabase = await getSupabaseServer();

  const messages = {
    building: "🔨 Build started! Installing dependencies...",
    installing: "📦 Installing packages and configuring environment...",
    finalizing: "🚀 Almost ready! Finalizing deployment...",
    success: "✅ Deployment successful! Your app is now live at https://your-app.pipelinexr.app",
    failed: "❌ Deployment failed. Checking logs and fixing automatically..."
  };

  const message = messages[status as keyof typeof messages] || `Status: ${status}`;

  // Get existing session and append message
  const { data: existing } = await supabase
    .from('ai_agent_sessions')
    .select('id, messages')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    const updatedMessages = [...(existing.messages as any[]), {
      role: 'assistant',
      content: message,
      timestamp: new Date().toISOString()
    }];
    await supabase
      .from('ai_agent_sessions')
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  }
}