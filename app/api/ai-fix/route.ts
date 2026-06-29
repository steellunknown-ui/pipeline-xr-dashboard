import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { startAiFixLoop } from '@/lib/ai-fix-engine';

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { deploymentId, strategy } = await req.json();

    if (!deploymentId || !strategy) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Trigger the background loop asynchronously so the API returns quickly
    // Note: In Vercel serverless, background tasks might get killed. 
    // WaitUntil is available in Next.js experimental, but for now we just fire it.
    startAiFixLoop(deploymentId, strategy).catch(err => {
      console.error("Background AI Fixer failed:", err);
    });

    return NextResponse.json({ success: true, message: "AI Fixer started in the background" });
  } catch (error: any) {
    console.error("AI Fix API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
