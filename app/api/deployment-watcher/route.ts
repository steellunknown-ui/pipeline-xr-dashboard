import { NextRequest, NextResponse } from "next/server";
import { startDeploymentWatcher } from "@/lib/deployment-watcher";

export async function POST(request: NextRequest) {
  try {
    const { action, deployment_id, user_id } = await request.json();

    if (action === "start" && deployment_id && user_id) {
      startDeploymentWatcher(user_id, deployment_id);
      return NextResponse.json({ success: true, message: "Auto-monitoring started" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to start watcher" }, { status: 500 });
  }
}