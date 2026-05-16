import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { deriveDeploymentReplay } from "@/lib/deployment-replay";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: true, replay: [] }, { status: 200 });
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
      return NextResponse.json({ success: true, replay: [] }, { status: 200 });
    }

    const replay = deriveDeploymentReplay(
      deploymentRes.data,
      logsRes.data || [],
      auditRes.data || []
    );

    return NextResponse.json({ success: true, replay }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: true, replay: [] }, { status: 200 });
  }
}
