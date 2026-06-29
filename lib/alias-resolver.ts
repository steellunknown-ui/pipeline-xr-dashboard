import { getSupabaseServer } from "@/lib/supabase-server";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function fetchProductionAlias(vercelDeploymentId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.vercel.com/v13/deployments/${vercelDeploymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    
    // Check if alias is assigned at all
    if (!data.aliasAssigned) return null;
    
    const aliases: string[] = data.alias || [];
    if (aliases.length === 0) return null;
    
    const rawUrl = data.url;

    // Logic Priority:
    // 1. Target === 'production' (if available in modern Vercel API responses)
    // 2. Not equal to raw URL
    // 3. Fallback to first alias

    let selectedAlias = aliases.find((a: any) => a !== rawUrl);
    
    if (!selectedAlias) {
      selectedAlias = aliases[0];
    }
    
    return `https://${selectedAlias}`;
  } catch (error) {
    console.error("Error fetching production alias:", error);
    return null;
  }
}

export async function verifyLiveUrl(url: string, maxAttempts = 6, delayMs = 5000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status === 200) {
        return true;
      }
    } catch (e) {
      // Ignore fetch errors during retry
    }
    await delay(delayMs);
  }
  return false;
}

export function generateScreenshotUrl(aliasUrl: string): string {
  return `https://api.microlink.io/?url=${encodeURIComponent(aliasUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
}

export async function pollForAliasWithRetries(
  deploymentId: string, 
  vercelDeploymentId: string, 
  projectId: string,
  token: string
) {
  const supabase = await getSupabaseServer();
  
  const delays = [5000, 10000, 15000, 20000, 30000];
  let aliasUrl: string | null = null;
  
  for (let i = 0; i < delays.length; i++) {
    await delay(delays[i]);
    aliasUrl = await fetchProductionAlias(vercelDeploymentId, token);
    
    if (aliasUrl) {
      break;
    }
  }
  
  if (!aliasUrl) {
    // Mark as failed
    await supabase.from("deployments").update({ 
      alias_status: "failed", 
      alias_url: null 
    }).eq("id", deploymentId);
    return;
  }
  
  // Alias found, verify it's live
  await supabase.from("deployments").update({ 
    alias_status: "assigned", 
    alias_url: aliasUrl 
  }).eq("id", deploymentId);

  // Update Project table production alias as well
  await supabase.from("projects").update({
    production_alias_url: aliasUrl
  }).eq("id", projectId);

  // Wait for 200 OK
  const isLive = await verifyLiveUrl(aliasUrl);
  
  if (isLive) {
    const screenshotUrl = generateScreenshotUrl(aliasUrl);
    await supabase.from("deployments").update({
      preview_image_url: screenshotUrl
    }).eq("id", deploymentId);
  }
}
