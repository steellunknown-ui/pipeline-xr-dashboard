import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deploymentId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: deployment, error } = await supabase
      .from("deployments")
      .select("id, status, environment, branch, created_at, projects(name)")
      .eq("id", deploymentId)
      .eq("user_id", user.id)
      .single();

    if (error || !deployment) {
      return NextResponse.json({ success: false, error: "Deployment not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...deployment
    });

  } catch (error) {
    console.error("Get deployment error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch deployment" },
      { status: 500 }
    );
  }
}