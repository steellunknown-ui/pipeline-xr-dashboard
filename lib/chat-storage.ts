import { createClient } from "@/lib/supabase-server";

export async function saveChatMessage(
  userId: string,
  deploymentId: string,
  message: string,
  sender: 'user' | 'assistant'
) {
  const supabase = await createClient();
  
  await supabase.from("chat_messages").insert({
    user_id: userId,
    deployment_id: deploymentId,
    message,
    sender,
    created_at: new Date().toISOString()
  });
}