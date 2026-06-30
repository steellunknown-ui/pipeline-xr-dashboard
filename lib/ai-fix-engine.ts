import { getSupabaseServer } from '@/lib/supabase-server';
import { fixAI } from '@/lib/ai-client';
import { 
  getLatestCommitSha, 
  getCommitDetails, 
  createBlob, 
  createTree, 
  createCommit, 
  updateBranchRef, 
  createBranch, 
  createPullRequest 
} from './github-api';

export type FixStrategy = 'direct_push' | 'pull_request';

export async function analyzeErrorWithOpenRouter(
  logs: string, 
  fileContent: string, 
  filePath: string, 
  repoTree: any
) {
  const prompt = `You are an expert DevOps AI agent.
The following build logs show a deployment failure.

ERROR LOGS:
"""
${logs.substring(logs.length - 4000)}
"""

BROKEN FILE PATH: ${filePath}

FILE CONTENT:
"""
${fileContent}
"""

REPO TREE CONTEXT:
${JSON.stringify(repoTree.tree.slice(0, 50).map((t: any) => t.path))}

Your goal is to fix this error. 
Return ONLY a valid JSON object matching this schema:
{
  "type": "CODE_FIX",
  "file": "${filePath}",
  "folder": string, // folder path
  "lineStart": number, // line number where issue starts
  "lineEnd": number, // line number where issue ends
  "oldCode": string, // snippet of old code
  "newCode": string, // exact new code to replace the old code block,
  "reason": string, // brief explanation
  "confidence": number // 0-100 score
}

Focus ONLY on fixing the error. Return the exact JSON block, no markdown formatting.`;

  try {
    const response = await fixAI([
      { role: "system", content: "You are an autonomous AI fixing code errors. Always reply in pure JSON matching the requested schema." },
      { role: "user", content: prompt }
    ], { jsonMode: true, temperature: 0.1 });
    
    const cleaned = response.replace(/^```json/g, '').replace(/```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("OpenRouter API Failed", err);
    throw new Error("Failed to get response from AI model.");
  }
}

export function applyFixToContent(originalContent: string, fixData: any): string {
  // Try string replacement first (be careful with formatting)
  if (originalContent.includes(fixData.oldCode)) {
    return originalContent.replace(fixData.oldCode, fixData.newCode);
  }
  
  // Fallback: replace specific lines
  const lines = originalContent.split('\n');
  const start = Math.max(0, fixData.lineStart - 1);
  const end = Math.min(lines.length, fixData.lineEnd);
  
  const before = lines.slice(0, start).join('\n');
  const after = lines.slice(end).join('\n');
  
  return [before, fixData.newCode, after].filter(Boolean).join('\n');
}

export async function pushFixToGithub(
  token: string, 
  owner: string, 
  repo: string, 
  branch: string, 
  filePath: string, 
  newContent: string, 
  reason: string,
  strategy: FixStrategy,
  originalDiff: any = null
) {
  // CALL 1: Get latest commit SHA
  const latestCommitSha = await getLatestCommitSha(token, owner, repo, branch);

  // CALL 2: Get tree SHA
  const commitDetails = await getCommitDetails(token, owner, repo, latestCommitSha);
  const currentTreeSha = commitDetails.tree.sha;

  // CALL 3: Create new blob (fixed file)
  const newBlobSha = await createBlob(token, owner, repo, newContent);

  // CALL 4: Create new tree
  const newTreeSha = await createTree(token, owner, repo, currentTreeSha, filePath, newBlobSha);

  // CALL 5: Create commit
  const commitMessage = `fix: AI auto-fix by Pipeline XR — ${reason}`;
  const newCommitSha = await createCommit(token, owner, repo, commitMessage, newTreeSha, latestCommitSha);

  if (strategy === 'direct_push') {
    // CALL 6: Update main branch pointer
    await updateBranchRef(token, owner, repo, branch, newCommitSha);
    return { newCommitSha, prUrl: null, fixBranch: branch };
  } else {
    // CALL 6: Create new branch
    const timestamp = Date.now();
    const fixBranch = `ai-fix-${timestamp}`;
    await createBranch(token, owner, repo, fixBranch, newCommitSha);

    // CALL 7: Create Pull Request
    const body = `**File:** ${filePath}\n**Lines:** ${originalDiff?.lineStart || '?'}–${originalDiff?.lineEnd || '?'}\n**Reason:** ${reason}\n\n**Old:**\n\`\`\`\n${originalDiff?.oldCode || '...'}\n\`\`\`\n\n**New:**\n\`\`\`\n${originalDiff?.newCode || '...'}\n\`\`\``;
    
    const prResponse = await createPullRequest(
      token, 
      owner, 
      repo, 
      "🤖 AI Auto-Fix by Pipeline XR", 
      body, 
      fixBranch, 
      branch
    );
    
    return { newCommitSha, prUrl: prResponse.html_url, fixBranch };
  }
}
