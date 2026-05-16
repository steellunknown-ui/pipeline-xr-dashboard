import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { deriveDeploymentReplay } from "@/lib/deployment-replay";
import { explainReplayEvent } from "@/lib/replay-explanation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;
    const body = await request.json();
    const { eventIndex } = body;

    if (typeof eventIndex !== "number") {
      return NextResponse.json({ success: true, explanation: null }, { status: 200 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: true, explanation: null }, { status: 200 });
    }

    const [deploymentRes, logsRes, auditRes] = await Promise.all([
      supabase
        .from("deployments")
        .select("*")
        .eq("id", deploymentId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("deployment_logs")
        .select("*")
        .eq("deployment_id", deploymentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("deployment_audit_logs")
        .select("*")
        .eq("deployment_id", deploymentId)
        .order("created_at", { ascending: true }),
    ]);

    if (!deploymentRes.data) {
      return NextResponse.json({ success: true, explanation: null }, { status: 200 });
    }

    const replay = deriveDeploymentReplay(
      deploymentRes.data,
      logsRes.data || [],
      auditRes.data || []
    );

    if (eventIndex < 0 || eventIndex >= replay.length) {
      return NextResponse.json({ success: true, explanation: null }, { status: 200 });
    }

    const event = replay[eventIndex];
    const logs = logsRes.data || [];

    // Extract log window (±10 lines around event)
    const eventTime = new Date(event.timestamp).getTime();
    const relevantLogs = logs
      .filter((log) => {
        const logTime = new Date(log.created_at).getTime();
        const diff = Math.abs(logTime - eventTime);
        return diff < 30000; // Within 30 seconds
      })
      .slice(0, 20)
      .map((log) => log.message);

    // Find audit context
    const auditLogs = auditRes.data || [];
    const auditLog = auditLogs.find((a) => a.event_type === event.type);

    const explanation = await explainReplayEvent({
      deploymentId,
      eventId: `${eventIndex}`,
      eventType: event.type,
      timestamp: event.timestamp,
      message: event.message,
      logsSnippet: relevantLogs,
      auditContext: auditLog
        ? {
            actor: auditLog.actor_label,
            action: auditLog.message,
          }
        : undefined,
    });

    return NextResponse.json({ success: true, explanation }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: true, explanation: null }, { status: 200 });
  }
}
