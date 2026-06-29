import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { deploymentId } = await req.json();

    if (!deploymentId) {
      return NextResponse.json({ error: "Missing deploymentId" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();

    // Get deployment details
    const { data: deployment, error: fetchError } = await supabase
      .from("deployments")
      .select("*, projects(id, name)")
      .eq("id", deploymentId)
      .single();

    if (fetchError || !deployment || !deployment.vercel_deployment_id) {
      return NextResponse.json({ error: "Deployment not found or missing Vercel ID" }, { status: 404 });
    }

    const vercelToken = process.env.VERCEL_API_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    
    if (!vercelToken) {
      return NextResponse.json({ error: "Vercel API token not configured" }, { status: 500 });
    }

    const vercelId = deployment.vercel_deployment_id;
    // --- 1. Fetch deployment events (logs) from Vercel ---
    // Get the recent logs from our DB to avoid duplicates
    const { data: recentLogs } = await supabase
      .from("deployment_logs")
      .select("message, created_at")
      .eq("deployment_id", deploymentId)
      .order("created_at", { ascending: false })
      .limit(200);

    const existingMessages = new Set(recentLogs?.map(l => l.message) || []);
    const latestLog = recentLogs?.[0];

    // Overlap by 10 seconds to ensure no logs are missed
    const since = latestLog ? Math.max(0, new Date(latestLog.created_at).getTime() - 10000) : 0;
    
    // 1. Fetch deployment events using v13 which provides detailed stdout/stderr and delimiters
    let logsUrl = `https://api.vercel.com/v13/deployments/${vercelId}/events?direction=forward`;
    if (since > 0) logsUrl += `&since=${since}`;
    if (teamId) logsUrl += `&teamId=${teamId}`;

    const logsRes = await fetch(logsUrl, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });

    let fetchedLogCount = 0;

    if (logsRes.ok) {
      const text = await logsRes.text();
      let logsData: any[] = [];
      try {
        logsData = JSON.parse(text);
      } catch (e) {
        // If Vercel returns NDJSON streaming format
        logsData = text.split('\n').filter(Boolean).map(line => {
          try { return JSON.parse(line); } catch(err) { return null; }
        }).filter(Boolean);
      }

      if (Array.isArray(logsData)) {
        const newLogs = logsData
          .filter(event => {
            // Collect ALL requested event types
            const validTypes = ["command", "stdout", "stderr", "delimiter"];
            const hasText = event.payload?.text || event.text;
            if (!validTypes.includes(event.type) || !hasText) return false;
            
            const msg = event.payload?.text || event.text;
            return !existingMessages.has(msg);
          })
          .map(event => {
            const msg = event.payload?.text || event.text;
            return {
              deployment_id: deploymentId,
              user_id: deployment.user_id,
              message: msg,
              // Treat stderr or type 'error' as error level
              level: (event.type === "stderr" || event.type === "error" || msg.toLowerCase().includes("error")) ? "error" : "info",
              created_at: new Date(event.created || event.date || Date.now()).toISOString()
            };
          });

        if (newLogs.length > 0) {
          // Insert complete raw text logs in bulk without truncation
          await supabase.from("deployment_logs").insert(newLogs);
          fetchedLogCount = newLogs.length;
        }
      }
    }

    // --- 2. Check deployment status ---
    let url = `https://api.vercel.com/v13/deployments/${vercelId}`;
    if (teamId) url += `?teamId=${teamId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch from Vercel" }, { status: res.status });
    }

    const vercelData = await res.json();
    const state = vercelData.readyState; // QUEUED, BUILDING, READY, ERROR, CANCELED

    let newStatus = deployment.status;
    let logMessage = null;
    let level = "info";

    if (state === "READY") {
      newStatus = "success";
      logMessage = "✅ Deployment completed successfully";
      level = "success";
    } else if (state === "ERROR") {
      // Vercel can set readyState to ERROR but still stream typescript check failures.
      // We will only declare it failed if we received no new logs in this poll.
      // If logs are still streaming in, keep newStatus as 'building' so the frontend continues polling.
      if (fetchedLogCount > 0) {
        newStatus = "building";
      } else {
        newStatus = "failed";
        logMessage = `❌ Deployment failed: ${vercelData.errorMessage || 'Unknown error'}`;
        level = "error";
      }
    } else if (state === "CANCELED") {
      newStatus = "cancelled";
      logMessage = "⚠️ Deployment canceled";
      level = "warn";
    } else if (state === "BUILDING" && deployment.status !== "building") {
      newStatus = "building";
      logMessage = "⚙️ Deployment building...";
    }

    // Update deployment in DB
    const updateData: any = { status: newStatus };
    if (state === "READY" && vercelData.url) {
      updateData.deployment_url = `https://${vercelData.url}`;
    }

    await supabase
      .from("deployments")
      .update(updateData)
      .eq("id", deploymentId);

    // Insert status change log if status changed
    if (logMessage) {
      await supabase.from("deployment_logs").insert({
        deployment_id: deploymentId,
        user_id: deployment.user_id,
        message: logMessage,
        level: level
      });
    }

    return NextResponse.json({ 
      success: true, 
      state,
      status: newStatus,
      deployment_url: updateData.deployment_url 
    });

  } catch (error: any) {
    console.error("Polling error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
