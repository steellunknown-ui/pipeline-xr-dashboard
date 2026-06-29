import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import { getSupabaseServer } from '@/lib/supabase-server';
import { fixAI } from '@/lib/ai-client';

const execAsync = util.promisify(exec);

export type FixStrategy = 'direct_push' | 'pull_request';

async function logToDeployment(supabase: any, deploymentId: string, userId: string, message: string) {
  await supabase.from('deployment_logs').insert({
    deployment_id: deploymentId,
    user_id: userId,
    log_text: message
  });
}

export async function startAiFixLoop(deploymentId: string, fixStrategy: FixStrategy) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch deployment & project info
  const { data: deployment } = await supabase
    .from('deployments')
    .select('*, projects(*)')
    .eq('id', deploymentId)
    .single();

  if (!deployment || !deployment.projects) {
    throw new Error("Deployment or Project not found");
  }

  const project = Array.isArray(deployment.projects) ? deployment.projects[0] : deployment.projects;
  const githubUrl = project.github_repo_url;
  const branch = project.auto_deploy_branch || project.default_branch || 'main';
  const attempts = deployment.ai_fix_attempts || 0;

  if (attempts >= 3) {
    await supabase.from('deployments').update({ ai_fix_status: 'failed_max_attempts' }).eq('id', deploymentId);
    await logToDeployment(supabase, deploymentId, user.id, '❌ AI Fixer reached maximum attempts (3). Halting.');
    return;
  }

  // Update status
  await supabase.from('deployments').update({ 
    ai_fix_status: 'analyzing', 
    ai_fix_attempts: attempts + 1 
  }).eq('id', deploymentId);

  await logToDeployment(supabase, deploymentId, user.id, `🤖 AI Fixer Attempt ${attempts + 1}/3 started...`);

  // Fetch failed logs
  const { data: logs } = await supabase
    .from('deployment_logs')
    .select('log_text')
    .eq('deployment_id', deploymentId)
    .order('created_at', { ascending: true });

  const fullLog = logs?.map(l => l.log_text).join('\n') || '';

  // ENV Guardrail
  if (
    fullLog.includes('process.env') || 
    fullLog.includes('NEXT_PUBLIC_') || 
    fullLog.toLowerCase().includes('missing environment variable') ||
    fullLog.includes('is not defined') && fullLog.includes('.env')
  ) {
    await supabase.from('deployments').update({ ai_fix_status: 'failed_env' }).eq('id', deploymentId);
    await logToDeployment(supabase, deploymentId, user.id, `🚨 AI Guardrail Triggered: The build error seems to be caused by missing Environment Variables. Please add your variables in the Settings and trigger a deploy manually. AI will not attempt to rewrite code to fix missing ENVs.`);
    return;
  }

  // Setup temp workspace
  const tmpDir = path.join(os.tmpdir(), `ai-fix-${Date.now()}`);
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    
    // Get Github Token
    const { data: { session } } = await supabase.auth.getSession();
    let githubToken = session?.provider_token;
    if (!githubToken) {
      const githubIdentity = user.identities?.find((id: any) => id.provider === 'github');
      githubToken = githubIdentity?.identity_data?.access_token;
    }

    // Clone the repo
    await logToDeployment(supabase, deploymentId, user.id, `📥 AI Cloning repository to local workspace...`);
    let cloneUrl = githubUrl;
    if (githubToken) {
      cloneUrl = cloneUrl.replace('https://', `https://${githubToken}@`);
    }
    
    await execAsync(`git clone --branch ${branch} --single-branch ${cloneUrl} .`, { cwd: tmpDir });

    // AI Analysis (Placeholder for OpenRouter integration)
    await logToDeployment(supabase, deploymentId, user.id, `🧠 Analyzing logs with OpenRouter...`);
    
    const aiResponse = await analyzeErrorWithOpenRouter(fullLog);
    
    // Apply the fix
    if (aiResponse.cli_command) {
       await logToDeployment(supabase, deploymentId, user.id, `⚙️ AI executing command: ${aiResponse.cli_command}`);
       await execAsync(aiResponse.cli_command, { cwd: tmpDir });
    }
    
    if (aiResponse.file_path && aiResponse.new_content) {
      const targetFilePath = path.join(tmpDir, aiResponse.file_path);
      if (fs.existsSync(targetFilePath)) {
         await logToDeployment(supabase, deploymentId, user.id, `✏️ AI modifying file: ${aiResponse.file_path}`);
         fs.writeFileSync(targetFilePath, aiResponse.new_content);
      } else {
         // Create the file if it doesn't exist, might be a missing component
         await logToDeployment(supabase, deploymentId, user.id, `✏️ AI creating file: ${aiResponse.file_path}`);
         fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
         fs.writeFileSync(targetFilePath, aiResponse.new_content);
      }
    }

    if (!aiResponse.cli_command && !aiResponse.file_path) {
      throw new Error("AI failed to provide a valid fix structure (no command or file).");
    }

    // Test the fix
    await logToDeployment(supabase, deploymentId, user.id, `🔨 AI running test build (npm i && npm run build)...`);
    try {
      await execAsync('npm install', { cwd: tmpDir });
      await execAsync('npm run build', { cwd: tmpDir });
      
      // If we reach here, build passed!
      await logToDeployment(supabase, deploymentId, user.id, `✅ AI Build passed successfully!`);
      
      // Push the fix
      if (fixStrategy === 'direct_push') {
        await logToDeployment(supabase, deploymentId, user.id, `🚀 AI pushing fix directly to ${branch}...`);
        await execAsync(`git config user.name "Pipeline AI"`, { cwd: tmpDir });
        await execAsync(`git config user.email "ai@pipeline-xr.com"`, { cwd: tmpDir });
        await execAsync(`git add .`, { cwd: tmpDir });
        await execAsync(`git commit -m "🤖 fix(pipeline-ai): resolved build failure in ${aiResponse.file_path}"`, { cwd: tmpDir });
        await execAsync(`git push origin ${branch}`, { cwd: tmpDir });
      } else {
        // Handle PR logic (create branch, push, create PR via API)
        const fixBranch = `pipeline-ai-fix-${Date.now()}`;
        await logToDeployment(supabase, deploymentId, user.id, `🔀 AI pushing to new branch ${fixBranch} and creating PR...`);
        await execAsync(`git checkout -b ${fixBranch}`, { cwd: tmpDir });
        await execAsync(`git config user.name "Pipeline AI"`, { cwd: tmpDir });
        await execAsync(`git config user.email "ai@pipeline-xr.com"`, { cwd: tmpDir });
        await execAsync(`git add .`, { cwd: tmpDir });
        await execAsync(`git commit -m "🤖 fix(pipeline-ai): resolved build failure in ${aiResponse.file_path}"`, { cwd: tmpDir });
        await execAsync(`git push origin ${fixBranch}`, { cwd: tmpDir });
        // Create PR using fetch to Github API...
      }

      await supabase.from('deployments').update({ ai_fix_status: 'success' }).eq('id', deploymentId);
      
    } catch (buildError: any) {
      await logToDeployment(supabase, deploymentId, user.id, `❌ AI Build failed: ${buildError.message.substring(0, 500)}`);
      // Recursively loop
      startAiFixLoop(deploymentId, fixStrategy);
    }

  } catch (error: any) {
    console.error("AI Fixer Error:", error);
    await logToDeployment(supabase, deploymentId, user.id, `⚠️ AI Fixer internal error: ${error.message}`);
    await supabase.from('deployments').update({ ai_fix_status: 'failed_internal' }).eq('id', deploymentId);
  } finally {
    // Cleanup
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

async function analyzeErrorWithOpenRouter(logs: string) {
  const prompt = `You are an expert DevOps AI agent.
The following build logs show a Next.js / Node.js deployment failure.

LOGS:
"""
${logs.substring(logs.length - 8000)}
"""

Your goal is to fix this error. 
You can either provide a CLI command to run (like installing a missing package), OR provide the exact full file path and the complete new file content to fix a code error, or both.

Return ONLY a valid JSON object matching this schema:
{
  "cli_command": string | null, // e.g. "npx shadcn@latest add radio-group --yes" or "npm install foo"
  "file_path": string | null, // e.g. "app/page.tsx"
  "new_content": string | null // The full new source code of the file if replacing
}

If no file needs to be modified, set file_path and new_content to null.`;

  try {
    const response = await fixAI([
      { role: "system", content: "You are an autonomous AI fixing code errors. Always reply in pure JSON matching the requested schema." },
      { role: "user", content: prompt }
    ], { jsonMode: true, temperature: 0.1 });
    
    // Strip markdown formatting if any
    const cleaned = response.replace(/^```json/g, '').replace(/```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("OpenRouter API Failed", err);
    throw new Error("Failed to get response from AI model.");
  }
}
