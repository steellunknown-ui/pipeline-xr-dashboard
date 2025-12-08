"use server";

import { createClient } from "@/lib/supabase-server";
import { createActivityLog } from "./activity";

export async function testActivityLog() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    await createActivityLog({
      event: "test_event",
      user_id: user.id,
      description: "This is a test activity log",
      metadata: { test: true, timestamp: new Date().toISOString() },
    });

    return { success: true, message: "Test log created successfully" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
