import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { pushFixToGithub, applyFixToContent } from '@/lib/ai-fix-engine';
import { getFileContent } from '@/lib/github-api';

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!user || !session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let githubToken = process.env.GITHUB_PAT || session.provider_token;
    if (!githubToken) {
      const githubIdentity = user.identities?.find((id: any) => id.provider === "github");
      githubToken = githubIdentity?.identity_data?.access_token;
    }

    if (!githubToken) {
      return NextResponse.json({ success: false, error: "Missing GitHub token" }, { status: 403 });
    }

    const { deploymentId, strategy, fixData } = await req.json();

    if (!deploymentId || !strategy || !fixData) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch deployment & project
    const { data: deployment } = await supabase
      .from("deployments")
      .select("*, projects(*)")
      .eq("id", deploymentId)
      .single();
      
    if (!deployment) throw new Error("Deployment not found");
    
    const project = Array.isArray(deployment.projects) ? deployment.projects[0] : deployment.projects;
    let owner = project.github_owner;
    let repoName = project.github_repo_full_name?.split('/')[1] || project.name;
    if (!owner && project.github_repo_url) {
      const urlParts = new URL(project.github_repo_url).pathname.split('/').filter(Boolean);
      owner = urlParts[0];
      repoName = urlParts[1];
    }
    const branch = deployment.branch || project.github_default_branch || "main";

    // 2. Fetch original file content again to ensure we apply it correctly
    const fileData = await getFileContent(githubToken, owner, repoName, fixData.file);
    const originalContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    // 3. Apply fix
    const newContent = applyFixToContent(originalContent, fixData);

    // 4. Push to GitHub
    const pushResult = await pushFixToGithub(
      githubToken,
      owner,
      repoName,
      branch,
      fixData.file,
      newContent,
      fixData.reason,
      strategy,
      fixData
    );

    // 5. Trigger Vercel Build (if Max Speed)
    if (strategy === 'direct_push') {
      const vercelToken = process.env.PIPELINE_XR_VERCEL_TOKEN;
      // Trigger new deployment on Vercel
      // Vercel webhook will handle the success/fail result
      const vercelRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: project.name,
          gitSource: {
            type: "github",
            repoId: project.github_repo_id,
            ref: branch,
            sha: pushResult.newCommitSha,
            org: owner
          }
        })
      });

      if (vercelRes.ok) {
        const newVercelDeploy = await vercelRes.json();
        
        // Update current deployment state to Fixing
        await supabase
          .from("deployments")
          .update({
            ai_fix_status: "fixing",
            ai_fix_attempt: (deployment.ai_fix_attempt || 0) + 1,
            ai_fix_diff: fixData, // save the diff applied
            ai_fix_branch: branch,
            // we could either link to new vercel deployment or rely on webhook matching this project's latest deploy
          })
          .eq("id", deploymentId);
      }
    }

    return NextResponse.json({ success: true, result: pushResult });
  } catch (error: any) {
    console.error("AI Fix Push API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
