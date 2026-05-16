import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { normalizeDeploymentSource } from "@/lib/deployment-source";

interface PreflightRequest {
  projectId: string;
  source: 'github' | 'zip' | 'manual';
  commit_sha?: string;
}

interface PreflightResponse {
  success: true;
  risk_level: "low" | "medium" | "high";
  reasons: string[];
  recommendation: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<PreflightResponse>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: true,
        risk_level: "high",
        reasons: ["Authentication required"],
        recommendation: "Please log in to analyze deployment risks"
      });
    }

    const body: PreflightRequest = await request.json();
    const { projectId, source, commit_sha } = body;

    const normalizedResult = normalizeDeploymentSource(source);
    const normalizedSource = normalizedResult.success ? normalizedResult.source : source;

    // Get project
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({
        success: true,
        risk_level: "high",
        reasons: ["Project not found"],
        recommendation: "Verify project exists and you have access"
      });
    }

    // Get recent deployments
    const { data: deployments } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    const lastDeployment = deployments?.[0];
    const lastSuccessful = deployments?.find(d => d.status === "success");
    const lastFailed = deployments?.find(d => d.status === "failed");

    const reasons: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    // HIGH RISK CHECKS

    // Missing required env vars from last failure
    if (lastFailed?.failure_reason?.includes("environment") ||
      lastFailed?.failure_reason?.includes("env") ||
      lastFailed?.failure_reason?.includes("variable")) {
      reasons.push("Last deployment failed due to environment variable issues");
      riskLevel = "high";
    }

    // Last deployment failed AND no config changes
    if (lastDeployment?.status === "failed" &&
      lastDeployment.commit_sha === commit_sha) {
      reasons.push("Same commit failed in last deployment");
      riskLevel = "high";
    }

    // Build time regression check
    if (lastSuccessful?.build_time && lastDeployment?.build_time) {
      const buildTimeRatio = lastDeployment.build_time / lastSuccessful.build_time;
      if (buildTimeRatio > 2) {
        reasons.push("Build time increased significantly compared to last success");
        riskLevel = "high";
      }
    }

    // MEDIUM RISK CHECKS (only if not already high risk)
    if (riskLevel !== "high") {

      // Non-default branch (GitHub only)
      if (normalizedSource === "github" &&
        lastDeployment?.commit_sha !== commit_sha &&
        !project.auto_deploy) {
        reasons.push("Deploying from non-default branch without auto-deploy");
        riskLevel = "medium";
      }

      // ZIP after GitHub
      if (normalizedSource === "zip" &&
        lastDeployment?.source === "github") {
        reasons.push("Switching from GitHub to ZIP deployment");
        riskLevel = "medium";
      }

      // Manual deployment without auto-deploy
      if (normalizedSource === "manual" && !project.auto_deploy) {
        reasons.push("Manual deployment without auto-deploy enabled");
        riskLevel = "medium";
      }
    }

    // LOW RISK INDICATORS (only if no other risks)
    if (reasons.length === 0) {

      // Same commit redeployed
      if (lastSuccessful?.commit_sha === commit_sha) {
        reasons.push("Redeploying previously successful commit");
      }

      // No recent failures
      if (!lastFailed || (lastSuccessful &&
        new Date(lastSuccessful.created_at) > new Date(lastFailed.created_at))) {
        reasons.push("No recent deployment failures detected");
      }

      if (reasons.length === 0) {
        reasons.push("Standard deployment configuration");
      }
    }

    // Generate recommendation
    let recommendation: string;
    switch (riskLevel) {
      case "high":
        recommendation = "Review recent failures and verify configuration before deploying";
        break;
      case "medium":
        recommendation = "Consider reviewing changes and deployment settings";
        break;
      default:
        recommendation = "Deployment appears safe to proceed";
    }

    return NextResponse.json({
      success: true,
      risk_level: riskLevel,
      reasons,
      recommendation
    });

  } catch (error) {
    console.error("Preflight check error:", error);
    return NextResponse.json({
      success: true,
      risk_level: "medium",
      reasons: ["Unable to analyze deployment risks"],
      recommendation: "Proceed with caution - risk analysis unavailable"
    });
  }
}