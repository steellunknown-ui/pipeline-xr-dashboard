import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deploymentId } = await params;
  const supabase = await getSupabaseServer();

  // 1. Fetch deployment
  const { data: deployment } = await supabase
    .from("deployments")
    .select("vercel_deployment_id")
    .eq("id", deploymentId)
    .single();

  if (!deployment || !deployment.vercel_deployment_id) {
    return new Response("Deployment not found or missing Vercel ID", { status: 404 });
  }

  const vercelId = deployment.vercel_deployment_id;
  const token = process.env.PIPELINE_VERCEL_TOKEN || process.env.PIPELINE_XR_VERCEL_TOKEN;
  const teamIdStr = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : "";

  // 2. Open SSE stream to Vercel
  const response = await fetch(`https://api.vercel.com/v2/deployments/${vercelId}/events${teamIdStr}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/x-ndjson",
    },
  });

  if (!response.ok) {
    return new Response("Failed to fetch logs from Vercel", { status: response.status });
  }

  // 3. Transform stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last incomplete line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const eventData = JSON.parse(line);
              
              if (eventData.type === "command" || eventData.type === "stdout" || eventData.type === "stderr") {
                const sseData = {
                  type: "log",
                  text: eventData.payload.text || "",
                  timestamp: eventData.payload.date || Date.now(),
                };
                controller.enqueue(`data: ${JSON.stringify(sseData)}\n\n`);
              }
              
              if (eventData.type === "state" && (eventData.payload.value === "READY" || eventData.payload.value === "ERROR")) {
                const sseData = {
                  type: "status",
                  state: eventData.payload.value,
                };
                controller.enqueue(`data: ${JSON.stringify(sseData)}\n\n`);
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      } catch (error) {
        console.error("Error reading log stream", error);
      } finally {
        controller.enqueue(`data: ${JSON.stringify({ type: "status", state: "ENDED" })}\n\n`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
