import { getSupabaseServer } from "@/lib/supabase-server";
import { getRepoTree, getFileContent } from "@/lib/github-api";
import { analyzeErrorWithOpenRouter } from "@/lib/ai-fix-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deploymentId = searchParams.get("deploymentId");

  if (!deploymentId) {
    return new Response("Missing deploymentId", { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  if (!session || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let githubToken = process.env.GITHUB_PAT || session.provider_token;
  if (!githubToken) {
    const githubIdentity = user.identities?.find((id: any) => id.provider === "github");
    githubToken = githubIdentity?.identity_data?.access_token;
  }

  if (!githubToken) {
    return new Response("Missing GitHub token", { status: 403 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendStep = (step: string, text: string) => {
        controller.enqueue(`data: ${JSON.stringify({ type: "step", step, text })}\n\n`);
      };

      try {
        sendStep("analyze", "🔍 Analyzing crash logs...");
        
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
        } // fallback

        // Fetch logs
        let fullLogs = "";
        if (deployment.vercel_deployment_id) {
          try {
            const vercelToken = process.env.PIPELINE_XR_VERCEL_TOKEN || process.env.PIPELINE_VERCEL_TOKEN;
            const teamIdStr = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : "";
            const vRes = await fetch(`https://api.vercel.com/v2/deployments/${deployment.vercel_deployment_id}/events${teamIdStr}`, {
              headers: { Authorization: `Bearer ${vercelToken}` }
            });
            if (vRes.ok) {
              const events = await vRes.json();
              fullLogs = events.map((e: any) => e.text || e.payload?.text || "").filter(Boolean).join("\n");
            }
          } catch (e) {
            console.error("Failed to fetch Vercel logs", e);
          }
        }
        
        if (!fullLogs) {
          const { data: logs } = await supabase
            .from("deployment_logs")
            .select("log_text")
            .eq("deployment_id", deploymentId)
            .order("created_at", { ascending: true });
            
          fullLogs = logs?.map(l => l.log_text).join("\n") || "";
        }
        
        // SUB-STEP 1: ENV GUARDRAIL
        sendStep("env", "🛡️ Checking for ENV issues...");
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
          controller.enqueue(`data: ${JSON.stringify({ 
            type: "ENV_ERROR", 
            message: "These environment variables are missing or invalid. Please add them in Project Settings → Environment Variables and deploy again."
          })}\n\n`);
          controller.close();
          return;
        }

        // SUB-STEP 2: FETCH REPO FILE TREE
        sendStep("tree", "📁 Fetching repo structure...");
        const branch = deployment.branch || project.github_default_branch || "main";
        const repoTree = await getRepoTree(githubToken, owner, repoName, branch);
        
        // SUB-STEP 3: IDENTIFY & FETCH THE BROKEN FILE
        sendStep("file", "📂 Identifying broken file...");
        const { chatAI } = require("@/lib/ai-client");
        const extractPathRes = await chatAI([{
          role: "user",
          content: `You are a build log parser. Extract the single broken source file path from these build logs.
Rules:
- Return ONLY the relative file path (e.g. src/app/page.tsx)
- No explanation, no markdown, no quotes
- Must be a real file path with an extension
- If multiple files, return the FIRST one that caused the error

LOGS:
${fullLogs.substring(fullLogs.length - 3000)}`
        }]);

        const rawPath = extractPathRes.trim().replace(/[`"']/g, '');
        // Validate it looks like a file path (has an extension, no spaces)
        const isValidPath = /^[^\s]+\.[a-zA-Z]{1,10}$/.test(rawPath);
        if (!isValidPath) {
          throw new Error(`AI could not identify a broken file path. Got: "${rawPath}". Check that the build logs contain a compiler error with a file path.`);
        }

        // Try to match against the actual repo tree to avoid 404s
        const treeFiles: string[] = repoTree?.tree?.map((t: any) => t.path) || [];
        const exactMatch = treeFiles.find(p => p === rawPath);
        const fuzzyMatch = !exactMatch && treeFiles.find(p => p.endsWith(rawPath) || rawPath.endsWith(p.split('/').pop()!));
        const filePath = exactMatch || fuzzyMatch || rawPath;

        sendStep("file", `📂 Opening ${filePath}...`);
        const fileData = await getFileContent(githubToken, owner, repoName, filePath);
        const fileContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

        // SUB-STEP 4: AI GENERATES FIX
        sendStep("read", "👁️ Reading code...");
        sendStep("think", "🧠 AI generating fix...");
        
        const fixResult = await analyzeErrorWithOpenRouter(fullLogs, fileContent, filePath, repoTree);
        
        sendStep("write", "✏️ Writing new code...");
        
        // Finalize
        sendStep("ready", `✅ Fix ready! Confidence: ${fixResult.confidence}%`);
        
        controller.enqueue(`data: ${JSON.stringify({ 
          type: "FIX_READY", 
          fix: fixResult
        })}\n\n`);

      } catch (error: any) {
        console.error("AI Fix SSE Error:", error);
        controller.enqueue(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}
