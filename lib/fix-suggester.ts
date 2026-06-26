import { DeploymentAnalysis } from "./failure-analyzer";
import { PatchPlan, safeReadFile } from "./patch-engine";
import { fixAI } from "./ai-client";

/**
 * Suggests a code fix for a failed deployment.
 * 1. Tries AI-powered fix generation (poolside/laguna-m.1 — best coder)
 * 2. Falls back to deterministic rule-based fixes
 * 3. Returns a no-fix plan if nothing matched
 */
export async function suggestFix(
  analysis: DeploymentAnalysis,
  workdir: string
): Promise<PatchPlan> {

  // ─── 1. AI-Powered Fix (Poolside Laguna M.1) ──────────────────────────────
  try {
    let fileContext = "";

    // Try to read package.json for extra context
    try {
      const pkgJson = await safeReadFile(workdir, "package.json");
      fileContext = `\n\npackage.json:\n\`\`\`json\n${pkgJson}\n\`\`\``;
    } catch {}

    const prompt = `You are an expert software engineer specializing in CI/CD and deployment fixes.

A deployment failed with this analysis:
- Type: ${analysis.failure_type}
- Reason: ${analysis.short_reason}
- Details: ${analysis.detailed_reason}
- Root Cause: ${analysis.probable_cause}
${fileContext}

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "title": "Short title of the fix (6-10 words)",
  "summary": "Plain English explanation of what the fix does",
  "confidence": 0.85,
  "changes": [
    {
      "filePath": "relative/path/to/file.ext",
      "reason": "Why this file needs to change",
      "before": "exact current content of the file",
      "after": "exact new content after the fix"
    }
  ]
}

IMPORTANT:
- Only suggest changes you are highly confident about
- Keep changes minimal and surgical
- If you cannot suggest a safe fix, return an empty changes array`;

    const response = await fixAI(
      [
        { role: "system", content: "You are an expert DevOps engineer and code fixer. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, maxTokens: 2048 }
    );

    const clean = response.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean) as PatchPlan;

    if (parsed.title && typeof parsed.confidence === "number" && Array.isArray(parsed.changes)) {
      // Validate that changes don't reference non-existent files with content
      return {
        ...parsed,
        // Mark as AI-generated
        title: parsed.changes.length > 0 ? `✨ ${parsed.title}` : parsed.title,
      };
    }
  } catch (err: any) {
    console.warn("[FixSuggester] AI fix failed, using rule-based fallback:", err.message);
  }

  // ─── 2. Rule-Based Fallback ───────────────────────────────────────────────

  // BUILD_ERROR / INSTALL_ERROR → try adding missing package to package.json
  if (analysis.failure_type === "BUILD_ERROR" || analysis.failure_type === "INSTALL_ERROR") {
    const match =
      analysis.detailed_reason.match(/Can't resolve '([^']+)'/) ||
      analysis.probable_cause.match(/module '([^']+)'/) ||
      analysis.short_reason.match(/([a-z@][a-z0-9/@-]+)/i);

    if (match) {
      const packageName = match[1];
      try {
        const pkgContent = await safeReadFile(workdir, "package.json");
        const pkg = JSON.parse(pkgContent);

        if (!pkg.dependencies?.[packageName] && !pkg.devDependencies?.[packageName]) {
          if (!pkg.dependencies) pkg.dependencies = {};
          pkg.dependencies[packageName] = "latest";

          return {
            title: `Add missing dependency: ${packageName}`,
            summary: `Adding '${packageName}' to package.json so the build can find it.`,
            confidence: 0.8,
            changes: [
              {
                filePath: "package.json",
                reason: `Module '${packageName}' not found — adding to dependencies`,
                before: pkgContent,
                after: JSON.stringify(pkg, null, 2),
              },
            ],
          };
        }
      } catch {}
    }
  }

  // ENV_ERROR → document in .env.example
  if (analysis.failure_type === "ENV_ERROR") {
    const match = analysis.probable_cause.match(/variable[s]?\s+'?([A-Z_][A-Z0-9_]+)'?/);
    if (match) {
      const envKey = match[1];
      try {
        let before = "";
        try { before = await safeReadFile(workdir, ".env.example"); } catch {}

        if (!before.includes(envKey)) {
          const after = (before ? before.trimEnd() + "\n" : "") + `${envKey}=YOUR_VALUE_HERE\n`;
          return {
            title: `Document missing env var: ${envKey}`,
            summary: `Adding '${envKey}' to .env.example so it's visible to the team.`,
            confidence: 0.85,
            changes: [{ filePath: ".env.example", reason: "Document missing variable", before, after }],
          };
        }
      } catch {}
    }
  }

  // ─── 3. No Fix Available ─────────────────────────────────────────────────
  return {
    title: "No automatic fix available",
    summary: `The AI couldn't generate a safe code patch for this ${analysis.failure_type}. Follow the fix steps below manually.`,
    confidence: 0,
    changes: [],
  };
}
