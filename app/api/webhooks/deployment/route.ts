import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { pollForAliasWithRetries } from "@/lib/alias-resolver";
import { createClient } from "@supabase/supabase-js";
import { getRepoTree, getFileContent, getLatestCommitSha, createBlob, createTree, createCommit, updateBranchRef } from "@/lib/github-api";
import { analyzeErrorWithOpenRouter } from "@/lib/ai-fix-engine";
import crypto from "crypto";

export const dynamic = "force-dynamic";

async function runAutoRetry(deployment: any, logsData: any, attempt: number) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Get user github token
    let githubToken = process.env.GITHUB_PAT;
    if (!githubToken) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const user = users.find(u => u.id === deployment.user_id);
      const identity = user?.identities?.find((id: any) => id.provider === "github");
      if (identity?.identity_data?.access_token) {
        githubToken = identity.identity_data.access_token;
      }
    }
    
    if (!githubToken) {
      console.error("No GitHub token available for auto-retry");
      return;
    }

    const fullLogs = logsData.map((e: any) => e.payload?.text || "").join("\n");
    
    // 1.5 SUB-STEP 1: ENV GUARDRAIL (Same as /api/ai-fix)
    const envPatterns = [
      "missing environment variable",
      "process.env.", "is undefined", "not defined",
      "next_public_ not found",
      "api key not found",
      "secret not configured",
      "unauthorized",
      "invalid api key"
    ];
    const logLower = fullLogs.toLowerCase();
    const hasEnvError = envPatterns.some(p => logLower.includes(p));

    if (hasEnvError) {
      console.log("ENV Error detected, aborting auto-retry.");
      await supabaseAdmin
        .from("deployments")
        .update({ ai_fix_status: "env_error" })
        .eq("id", deployment.id);
      return;
    }

    // 2. Fetch repo tree & extract broken file
    const owner = deployment.projects.github_owner;
    const repoName = deployment.projects.github_repo_full_name?.split('/')[1] || deployment.projects.name;
    const branch = deployment.branch || "main";
    
    const repoTree = await getRepoTree(githubToken, owner, repoName, branch);
    
    const { chatAI } = require("@/lib/ai-client");
    const extractPathRes = await chatAI([{
      role: "user", 
      content: `Extract the broken file path from these logs. Return ONLY the file path string.\n\n${fullLogs.substring(fullLogs.length - 2000)}`
    }]);
    const filePath = extractPathRes.trim();
    
    const fileData = await getFileContent(githubToken, owner, repoName, filePath);
    const fileContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // 3. Generate Patch
    const fixResult = await analyzeErrorWithOpenRouter(fullLogs, fileContent, filePath, repoTree);
    
    // 4. Push directly to branch
    const baseCommitSha = await getLatestCommitSha(githubToken, owner, repoName, branch);
    const oldCommit = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseCommitSha}`, {
      headers: { Authorization: `Bearer ${githubToken}` }
    }).then(res => res.json());

    const baseTreeSha = oldCommit.tree.sha;
    
    // Apply patch string replacement
    let newFileContent = fileContent;
    for (const line of fixResult.linesToReplace) {
       newFileContent = newFileContent.replace(line.oldContent, line.newContent);
    }

    const blobSha = await createBlob(githubToken, owner, repoName, newFileContent);
    const newTreeSha = await createTree(githubToken, owner, repoName, baseTreeSha, filePath, blobSha);
    const commitMessage = `fix: AI auto-fix by Pipeline XR (Attempt ${attempt + 1})`;
    const newCommitSha = await createCommit(githubToken, owner, repoName, commitMessage, newTreeSha, baseCommitSha);
    await updateBranchRef(githubToken, owner, repoName, branch, newCommitSha);

    // 5. Trigger new deploy
    await supabaseAdmin.from("deployments").update({ 
      ai_fix_attempts: attempt + 1,
      ai_fix_status: "investigating"
    }).eq("id", deployment.id);
    
    // Wait for Vercel to pick up the commit naturally (via Vercel Github integration)
    console.log(`Auto-retry attempt ${attempt + 1} pushed successfully!`);
  } catch (error) {
    console.error("Auto-retry loop failed:", error);
  }
}
export async function POST(req: Request) {
  try {
    console.log("=========================================");
    console.log("🔔 [WEBHOOK] Request received from Vercel!");
    const rawBody = await req.text();
    console.log(`🔔 [WEBHOOK] Raw Payload: ${rawBody.substring(0, 500)}...`);
    
    const signature = req.headers.get("x-vercel-signature");
    const secret = process.env.PIPELINE_WEBHOOK_SECRET;

    if (secret && signature) {
      const hmac = crypto.createHmac("sha1", secret);
      const digest = hmac.update(rawBody).digest("hex");
      if (digest !== signature) {
        console.error(`❌ Vercel webhook signature mismatch! Expected: ${digest}, Got: ${signature}`);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      console.log("✅ [WEBHOOK] Signature verified successfully.");
    } else if (secret) {
      console.error("❌ Missing x-vercel-signature header!");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    
    // Vercel deployment payload usually looks like:
    // { type: "deployment", payload: { deployment: { id, state, meta: { ... } } } }
    // Or sometimes just { deployment: { id, state, ... } }
    
    const deploymentData = body.payload?.deployment || body.deployment || body;

    if (!deploymentData || !deploymentData.id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const vercelId = deploymentData.id;
    let state = deploymentData.state || deploymentData.readyState; // e.g. "READY", "ERROR", "CANCELED"
    
    // If state is missing, derive it from the webhook event type
    if (!state && body.type) {
       if (body.type === "deployment.succeeded") state = "READY";
       else if (body.type === "deployment.error") state = "ERROR";
       else if (body.type === "deployment.canceled") state = "CANCELED";
       else if (body.type === "deployment.created") state = "BUILDING";
    }
    
    const commitMessage = deploymentData.meta?.githubCommitMessage || "";
    console.log(`🔔 [WEBHOOK] Deployment ${vercelId} changed state to: ${state}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Find the deployment in our DB
    const { data: deployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("vercel_deployment_id", vercelId)
      .single();

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    const projectId = deployment.project_id;
    const isAiFixRun = commitMessage.includes("AI auto-fix by Pipeline XR");

    if (state === "READY") {
      // 1. Mark as success
      await supabase
        .from("deployments")
        .update({ 
          status: "success",
          ai_fix_status: isAiFixRun ? "success" : deployment.ai_fix_status 
        })
        .eq("id", deployment.id);

      // 2. Trigger alias fetching and screenshot asynchronously (don't await)
      pollForAliasWithRetries(deployment.id, vercelId, projectId, process.env.PIPELINE_XR_VERCEL_TOKEN!);

    } else if (state === "ERROR" || state === "CANCELED") {
      // Fetch error logs to store locally
      let logsData = [];
      try {
        const logsRes = await fetch(`https://api.vercel.com/v2/deployments/${vercelId}/events`, {
          headers: { Authorization: `Bearer ${process.env.PIPELINE_XR_VERCEL_TOKEN}` }
        });
        if (logsRes.ok) {
          logsData = await logsRes.json();
          // Could store these logs in our DB for easier access later
        }
      } catch (err) {
        console.error("Failed to fetch logs for failed deployment", err);
      }

      if (isAiFixRun) {
        const attempt = deployment.ai_fix_attempts || 0;
        if (attempt < 3) {
          await supabase
            .from("deployments")
            .update({ status: "failed", ai_fix_status: "failed" })
            .eq("id", deployment.id);
            
          // Trigger the automatic AI Fix Retry Loop!
          // We fire and forget this so we don't hold up the webhook response.
          runAutoRetry(deployment, logsData, attempt).catch(console.error);
          
        } else {
          await supabase
            .from("deployments")
            .update({ status: "failed", ai_fix_status: "exhausted" })
            .eq("id", deployment.id);
        }
      } else {
        console.log(`🔔 [WEBHOOK] Standard deploy failed. Updating DB status to 'failed' for deployment ${deployment.id}...`);
        const { error: dbError } = await supabase
          .from("deployments")
          .update({ status: "failed" })
          .eq("id", deployment.id);
        
        if (dbError) {
           console.error("❌ Failed to update Supabase deployment status to 'failed':", dbError);
        } else {
           console.log("✅ Successfully updated Supabase deployment status to 'failed'");
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vercel webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
