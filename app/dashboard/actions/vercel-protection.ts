"use server";

import { getSupabaseServer } from "@/lib/supabase-server";

export async function disableDeploymentProtection(vercelProjectId: string) {
  try {
    const supabase = await getSupabaseServer();
    const vercelToken = process.env.VERCEL_API_TOKEN;
    if (!vercelToken) {
      console.warn("VERCEL_API_TOKEN not found, skipping deployment protection disablement");
      return { success: false };
    }
    
    const teamIdStr = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
    
    const res = await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}${teamIdStr}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ssoProtection: null, passwordProtection: null })
    });
    
    if (!res.ok) {
       console.error("Vercel API error when disabling protection:", await res.text());
       return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to disable deployment protection:", err);
    return { success: false };
  }
}
