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

        const { data: fixes, error } = await supabase
            .from("deployment_fix_history")
            .select("*")
            .eq("deployment_id", deploymentId)
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 200 });
        }

        return NextResponse.json({
            success: true,
            fixes
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 200 });
    }
}
