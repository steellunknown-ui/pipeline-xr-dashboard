import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { generateSlug } from "@/lib/slug-utils";
import { createActivityLog } from "@/app/dashboard/actions/activity";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoUrl, name } = body;

    if (!repoUrl || !name) {
      return NextResponse.json({ success: false, error: "Missing required data" }, { status: 200 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 200 });
    }

    // Check if user has GitHub identity (primary or linked)
    const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
    if (!hasGitHubIdentity) {
      return NextResponse.json({
        success: false,
        error_code: 'PROVIDER_MISMATCH',
        error: 'To connect GitHub, please sign up or log in using a GitHub account.'
      }, { status: 403 });
    }

    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return NextResponse.json({ success: false, error: "Invalid GitHub URL" }, { status: 200 });
    }

    const projectSlug = generateSlug(name);
    const webhookSecret = crypto.randomBytes(16).toString("hex");
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/webhook`;

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name,
        github_repo_url: repoUrl,
        user_id: user.id,
        webhook_enabled: true,
        auto_deploy_branch: "main",
        default_branch: "main",
        framework: "Next.js",
        project_slug: projectSlug,
        webhook_secret: webhookSecret,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }

    await createActivityLog({
      event: "project_created_from_github",
      user_id: user.id,
      project_id: project.id,
      metadata: { name, github_repo_url: repoUrl },
    });

    return NextResponse.json({ success: true, project }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Creation failed" }, { status: 200 });
  }
}