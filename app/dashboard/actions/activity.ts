"use server";

import { createClient } from "@/lib/supabase-server";

export async function createActivityLog(data: {
  event: string;
  user_id: string;
  description?: string;
  project_id?: string;
  deployment_id?: string;
  metadata?: any;
}): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase.from("activity_logs").insert({
    event: data.event,
    description: data.description || null,
    user_id: data.user_id,
    project_id: data.project_id || null,
    deployment_id: data.deployment_id || null,
    metadata: data.metadata || {},
  });

  if (error) {
    throw new Error(`Failed to create activity log: ${error.message}`);
  }
}

export async function getActivityLogs(limit: number = 50) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch activity logs" };
  }
}
