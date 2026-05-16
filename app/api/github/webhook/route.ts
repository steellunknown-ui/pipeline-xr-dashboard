import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeDeploymentSource } from "@/lib/deployment-source";
import { recordAuditEvent, AuditMessages } from "@/lib/audit-log";

/**
 * GitHub Webhook Receiver
 * 
 * Hard rules:
 * - Always return JSON
 * - Always return HTTP 200
 * - Never redirect
 * - Never throw uncaught errors
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Read headers
    const event = request.headers.get("X-GitHub-Event");
    const signature = request.headers.get("X-Hub-Signature-256");

    // SAFETY: Only handle push events (ignore PRs, tags, etc.)
    if (event !== "push") {
      console.log(`[Webhook] Ignored event: ${event}`);
      return NextResponse.json({
        success: true,
        message: `Event ignored (type: ${event})`
      }, { status: 200 });
    }

    // Step 2: Parse JSON body safely
    let payload: any;
    let rawBody: string;

    try {
      rawBody = await request.text();
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("[Webhook] JSON parse error:", parseError);
      return NextResponse.json({
        success: false,
        error: "Invalid JSON payload"
      }, { status: 200 });
    }

    // Extract push data from GitHub payload
    const repoFullName = payload.repository?.full_name; // e.g., "user/repo"
    const ref = payload.ref; // e.g., "refs/heads/main"
    const commitSha = payload.after;
    const commitMessage = payload.head_commit?.message || "";
    const commitAuthor = payload.head_commit?.author?.name || payload.pusher?.name || "Unknown";

    if (!repoFullName || !ref || !commitSha) {
      console.error("[Webhook] Missing required fields:", { repoFullName, ref, commitSha });
      return NextResponse.json({
        success: false,
        error: "Missing required fields in payload"
      }, { status: 200 });
    }

    // SAFETY: Ignore tag pushes (refs/tags/*)
    if (ref.startsWith("refs/tags/")) {
      console.log(`[Webhook] Ignored tag push: ${ref}`);
      return NextResponse.json({
        success: true,
        message: "Tag pushes are ignored"
      }, { status: 200 });
    }

    // Extract branch from ref (refs/heads/main -> main)
    const branch = ref.replace("refs/heads/", "");

    // Step 3 & 4: Find project by matching repo URL and validate HMAC
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find projects with auto-deploy enabled matching this repository
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .eq("webhook_enabled", true);

    if (projectsError || !projects || projects.length === 0) {
      console.log("[Webhook] No webhook-enabled projects found");
      return NextResponse.json({
        success: true,
        message: "No webhook-enabled projects found"
      }, { status: 200 });
    }

    // Find matching project and validate signature
    let matchedProject: any = null;

    for (const project of projects) {
      // Check if repo URL matches
      if (!project.github_repo_url || !project.github_repo_url.includes(repoFullName)) {
        continue;
      }

      // Validate HMAC signature
      if (!signature || !project.webhook_secret) {
        continue; // Skip projects without proper webhook configuration
      }

      try {
        const hmac = crypto.createHmac("sha256", project.webhook_secret);
        hmac.update(rawBody);
        const expectedSignature = "sha256=" + hmac.digest("hex");

        // Timing-safe comparison
        const isValid = crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );

        if (isValid) {
          matchedProject = project;
          break;
        }
      } catch (hmacError) {
        // Continue to next project if HMAC validation fails
        console.error("[Webhook] HMAC validation error:", hmacError);
        continue;
      }
    }

    if (!matchedProject) {
      console.warn(`[Webhook] No matching project for repo: ${repoFullName}`);
      return NextResponse.json({
        success: false,
        error: "No matching project or invalid signature"
      }, { status: 200 });
    }

    // Step 5: ENFORCE - Only auto_deploy_branch triggers deployments
    if (matchedProject.auto_deploy_branch && matchedProject.auto_deploy_branch !== branch) {
      console.log(`[Webhook] Branch filtered: ${branch} (expected: ${matchedProject.auto_deploy_branch}) - project: ${matchedProject.id}`);
      return NextResponse.json({
        success: true,
        message: `Branch ${branch} does not match auto-deploy branch ${matchedProject.auto_deploy_branch}`
      }, { status: 200 });
    }

    // SAFETY: Validate commit_sha is present for GitHub deployments
    if (!commitSha || commitSha === '0000000000000000000000000000000000000000') {
      console.error("[Webhook] Missing or invalid commit_sha:", commitSha);
      return NextResponse.json({
        success: false,
        error: "GitHub deployments require a valid commit SHA"
      }, { status: 200 });
    }

    // Validate source
    const sourceResult = normalizeDeploymentSource('github');
    if (!sourceResult.success) {
      console.error("[Webhook] Source validation failed:", sourceResult.error);
      return NextResponse.json({
        success: false,
        error: sourceResult.error
      }, { status: 200 });
    }

    // DEDUPLICATION: Check if deployment already exists for this commit
    const { data: existingDeployment, error: checkError } = await supabase
      .from("deployments")
      .select("id, status, created_at")
      .eq("project_id", matchedProject.id)
      .eq("commit_sha", commitSha)
      .single();

    if (existingDeployment) {
      console.log(`[Webhook] Duplicate prevented: commit ${commitSha.substring(0, 7)} already exists (deployment: ${existingDeployment.id}) - project: ${matchedProject.id}`);
      return NextResponse.json({
        success: true,
        message: "Deployment already exists for this commit",
        deployment_id: existingDeployment.id,
        duplicate: true
      }, { status: 200 });
    }

    // Step 6: Insert deployment row
    const { data: deployment, error: deploymentError } = await supabase
      .from("deployments")
      .insert({
        project_id: matchedProject.id,
        user_id: matchedProject.user_id,
        commit_sha: commitSha,
        commit_message: commitMessage,
        commit_author: commitAuthor,
        branch: branch,
        status: "pending",
        environment: "production", // Default to production
        source: sourceResult.source, // Use validated source
      })
      .select()
      .single();

    if (deploymentError) {
      console.error("[Webhook] Deployment creation error:", deploymentError);
      return NextResponse.json({
        success: false,
        error: "Failed to create deployment record"
      }, { status: 200 });
    }

    console.log(`[Webhook] ✓ Deployment created: ${deployment.id} - commit: ${commitSha.substring(0, 7)} - branch: ${branch} - project: ${matchedProject.id}`);

    // Record audit event (fire-and-forget)
    recordAuditEvent({
      eventType: "DEPLOYMENT_CREATED",
      deploymentId: deployment.id,
      projectId: matchedProject.id,
      actorType: "system",
      actorLabel: "GitHub webhook",
      message: AuditMessages.deploymentCreated("github_webhook"),
      metadata: {
        commit_sha: commitSha,
        branch: branch,
        commit_author: commitAuthor,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Deployment created",
      deployment_id: deployment.id,
      commit_sha: commitSha.substring(0, 7),
      branch: branch
    }, { status: 200 });

  } catch (error: any) {
    // Catch all uncaught errors
    console.error("[Webhook] Unexpected error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 200 });
  }
}

// Optional GET handler for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "GitHub webhook endpoint is active"
  }, { status: 200 });
}
