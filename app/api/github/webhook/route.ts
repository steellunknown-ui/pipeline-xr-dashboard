import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createActivityLog } from "@/app/dashboard/actions/activity";
import { createDeployment, runDeployment } from "@/app/dashboard/actions/deployments";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const event = request.headers.get("X-GitHub-Event");
    const signature = request.headers.get("X-Hub-Signature-256");
    
    // Only handle push events
    if (event !== "push") {
      return NextResponse.json({ message: "Event ignored" }, { status: 200 });
    }

    // Read raw body for signature verification
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // Skip signature verification in development if query param is set
    const skipSignature = process.env.NODE_ENV === "development" && 
      request.nextUrl.searchParams.get("skipSignature") === "true";

    if (!skipSignature && !signature) {
      return NextResponse.json({ error: "No signature" }, { status: 401 });
    }

    // Extract push data
    const repoFullName = payload.repository?.full_name; // "owner/repo"
    const ref = payload.ref; // "refs/heads/main"
    const commitHash = payload.after;

    if (!repoFullName || !ref || !commitHash) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 200 });
    }

    // Extract branch from ref
    const branch = ref.replace("refs/heads/", "");

    // Find matching project
    const supabase = await createClient();
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("auto_deploy_enabled", true);

    if (error || !projects || projects.length === 0) {
      return NextResponse.json({ message: "No projects configured" }, { status: 200 });
    }

    // Find project matching repo and branch
    let matchedProject = null;
    let validSignature = false;

    for (const project of projects) {
      // Check if repo URL contains the full name
      if (!project.github_repo_url.includes(repoFullName)) {
        continue;
      }

      // Check branch match (if auto_deploy_branch is set)
      if (project.auto_deploy_branch && project.auto_deploy_branch !== branch) {
        continue;
      }

      // Verify signature if not skipped
      if (!skipSignature && project.webhook_secret) {
        const hmac = crypto.createHmac("sha256", project.webhook_secret);
        hmac.update(rawBody);
        const expectedSignature = "sha256=" + hmac.digest("hex");
        
        // Timing-safe comparison
        if (crypto.timingSafeEqual(
          Buffer.from(signature || ""),
          Buffer.from(expectedSignature)
        )) {
          validSignature = true;
          matchedProject = project;
          break;
        }
      } else if (skipSignature) {
        matchedProject = project;
        break;
      }
    }

    if (!matchedProject) {
      return NextResponse.json({ message: "No matching project or invalid signature" }, { status: 200 });
    }

    // Determine environment based on branch
    let environment: "development" | "staging" | "production" = "development";
    if (branch === "main" || branch === "master") {
      environment = "production";
    } else if (branch === "develop" || branch === "dev" || branch === "staging") {
      environment = "staging";
    }

    // Create deployment
    const deploymentResult = await createDeployment({
      project_id: matchedProject.id,
      environment,
      branch,
      commit_hash: commitHash,
    });

    if (!deploymentResult.success || !deploymentResult.data) {
      return NextResponse.json({ error: "Failed to create deployment" }, { status: 500 });
    }

    const deployment = deploymentResult.data;

    // Create activity log
    const shortHash = commitHash.substring(0, 7);
    await createActivityLog({
      event: "auto_deploy_triggered",
      user_id: matchedProject.user_id,
      description: `Auto deployment triggered from GitHub for branch ${branch} and commit ${shortHash}`,
      project_id: matchedProject.id,
      deployment_id: deployment.id,
      metadata: {
        repo: repoFullName,
        branch,
        commit: commitHash,
        environment,
      },
    });

    // Run deployment asynchronously (don't await)
    runDeployment(deployment.id).catch(console.error);

    return NextResponse.json({
      message: "Deployment triggered",
      deployment_id: deployment.id,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "GitHub webhook endpoint" }, { status: 200 });
}
