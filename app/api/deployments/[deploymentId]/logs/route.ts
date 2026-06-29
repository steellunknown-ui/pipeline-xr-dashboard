import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get deployment to find vercel_deployment_id
    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("vercel_deployment_id, status")
      .eq("id", deploymentId)
      .single();

    if (error || !deployment || !deployment.vercel_deployment_id) {
      return new Response("Deployment not found or not a Vercel deployment", { status: 404 });
    }

    const vercelToken = process.env.PIPELINE_VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    
    if (!vercelToken) {
      return new Response("Vercel API token not configured", { status: 500 });
    }

    const url = new URL(`https://api.vercel.com/v2/deployments/${deployment.vercel_deployment_id}/events`);
    url.searchParams.set("direction", "forward");
    url.searchParams.set("follow", "1");
    if (teamId) {
      url.searchParams.set("teamId", teamId);
    }

    const vercelRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${vercelToken}`
      }
    });

    if (!vercelRes.ok || !vercelRes.body) {
      return new Response("Failed to connect to Vercel log stream", { status: vercelRes.status });
    }

    // Create a TransformStream to convert NDJSON from Vercel to SSE format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // chunk is a Uint8Array. We decode it, convert to SSE format
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            // It's JSON from Vercel
            const parsed = JSON.parse(line);
            // Vercel deployment events have a 'payload.text' for the log
            // Let's send the whole object as an SSE event
            const sseData = `data: ${JSON.stringify(parsed)}\n\n`;
            controller.enqueue(new TextEncoder().encode(sseData));
          } catch (e) {
            // Ignore non-JSON lines or parse errors
          }
        }
      }
    });

    const stream = vercelRes.body.pipeThrough(transformStream);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error) {
    console.error("Vercel Log Stream error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
