import { analyzeAI } from "./ai-client";

export interface DeploymentAnalysis {
  failure_type: string;
  short_reason: string;
  detailed_reason: string;
  probable_cause: string;
  fix_steps: string[];
  confidence: number;
  ai_powered: boolean;
}

const FAILURE_RULES = [
  {
    pattern: /module not found|cannot find module|cannot resolve/i,
    type: "BUILD_ERROR",
    confidence: 0.9,
    shortReason: "Missing dependency or module",
    detailedReason: "The build failed because a required module couldn't be found. Usually a missing npm package or wrong import path.",
    probableCause: "Missing npm package or incorrect import statement",
  },
  {
    pattern: /npm err!|yarn error|pnpm err/i,
    type: "INSTALL_ERROR",
    confidence: 0.85,
    shortReason: "Package installation failed",
    detailedReason: "The package manager hit an error while installing dependencies. Could be network issues, version conflicts, or corrupted packages.",
    probableCause: "Package manager installation failure",
  },
  {
    pattern: /missing environment variable|env.*not.*defined|undefined.*env/i,
    type: "ENV_ERROR",
    confidence: 0.9,
    shortReason: "Missing environment variables",
    detailedReason: "The app needs environment variables that aren't defined. These are usually API keys or database URLs.",
    probableCause: "Required environment variables not set",
  },
  {
    pattern: /permission denied|eacces|access denied/i,
    type: "PERMISSION_ERROR",
    confidence: 0.8,
    shortReason: "File permission error",
    detailedReason: "The deployment process doesn't have permission to read/write required files.",
    probableCause: "Insufficient file system permissions",
  },
  {
    pattern: /syntax error|unexpected token|parse error/i,
    type: "SYNTAX_ERROR",
    confidence: 0.85,
    shortReason: "Code syntax error",
    detailedReason: "The code contains syntax errors that prevent it from being parsed or compiled.",
    probableCause: "Invalid JavaScript/TypeScript syntax",
  },
  {
    pattern: /timeout|timed out|connection timeout/i,
    type: "TIMEOUT_ERROR",
    confidence: 0.7,
    shortReason: "Operation timed out",
    detailedReason: "A network operation or build process took too long and was killed.",
    probableCause: "Network connectivity or performance issues",
  },
  {
    pattern: /out of memory|heap out of memory|oom/i,
    type: "MEMORY_ERROR",
    confidence: 0.9,
    shortReason: "Out of memory",
    detailedReason: "The build process ran out of RAM. This usually happens with very large projects or memory leaks.",
    probableCause: "Insufficient memory during build",
  },
];

const FIX_STEPS: Record<string, string[]> = {
  BUILD_ERROR: [
    "Check all imports match installed package names exactly",
    "Run `npm install` locally and check for errors",
    "Verify import paths are correct and case-sensitive",
  ],
  INSTALL_ERROR: [
    "Delete `node_modules` and `package-lock.json`",
    "Run `npm install` again",
    "Check for conflicting dependency versions in package.json",
  ],
  ENV_ERROR: [
    "Go to your project settings → Environment tab",
    "Add the missing environment variables",
    "Redeploy after adding the variables",
  ],
  PERMISSION_ERROR: [
    "Check file permissions in your repository",
    "Ensure build scripts have execute permissions",
    "Verify deployment has write access to required directories",
  ],
  SYNTAX_ERROR: [
    "Review recent code changes for typos or missing brackets",
    "Run the code locally to identify the exact error",
    "Check all JSON config files are valid",
  ],
  TIMEOUT_ERROR: [
    "Check for infinite loops or blocking operations",
    "Optimize the build process to reduce time",
    "Check network connectivity for any external dependencies",
  ],
  MEMORY_ERROR: [
    "Add `NODE_OPTIONS=--max-old-space-size=4096` to your build command",
    "Check for memory leaks in your application",
    "Optimize imports to reduce bundle size",
  ],
  UNKNOWN_ERROR: [
    "Review the full deployment logs for specific error messages",
    "Test the build locally with `npm run build`",
    "Check recent code changes that might have caused the issue",
  ],
};

export async function analyzeFailure(
  logs: string[],
  source: string
): Promise<DeploymentAnalysis> {
  const logText = logs.join("\n");

  if (!logs.length || logText.trim() === "") {
    return {
      failure_type: "UNKNOWN_ERROR",
      short_reason: "No logs captured",
      detailed_reason: "The deployment failed but no logs were captured. This is usually a system-level failure.",
      probable_cause: "Missing or incomplete logging",
      fix_steps: FIX_STEPS.UNKNOWN_ERROR,
      confidence: 0.3,
      ai_powered: false,
    };
  }

  // 1. Try AI analysis first (Nemotron 3 Super — 1M context window eats logs whole)
  try {
    const recentLogs = logs.slice(-120).join("\n");

    const content = await analyzeAI(
      [
        {
          role: "system",
          content: `You are a senior DevOps engineer specializing in deployment failures. Analyze the logs and return ONLY a valid JSON object — no markdown, no extra text.

Schema:
{
  "failure_type": "BUILD_ERROR" | "INSTALL_ERROR" | "ENV_ERROR" | "PERMISSION_ERROR" | "SYNTAX_ERROR" | "TIMEOUT_ERROR" | "MEMORY_ERROR" | "UNKNOWN_ERROR",
  "short_reason": "3-6 word summary of what failed",
  "detailed_reason": "Clear plain-English explanation (explain like the user is a junior dev)",
  "probable_cause": "Exact root cause found in the logs",
  "fix_steps": ["Step 1", "Step 2", "Step 3"],
  "confidence": 0.95
}`,
        },
        {
          role: "user",
          content: `Deployment source: ${source}\n\nLogs:\n${recentLogs}`,
        },
      ],
      { jsonMode: true, maxTokens: 1024 }
    );

    const clean = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean);

    if (parsed.failure_type && parsed.short_reason && Array.isArray(parsed.fix_steps)) {
      return { ...parsed, confidence: parsed.confidence ?? 0.95, ai_powered: true };
    }
  } catch (err: any) {
    console.warn("[FailureAnalyzer] AI failed, using regex fallback:", err.message);
  }

  // 2. Regex fallback
  const lowerText = logText.toLowerCase();
  const sorted = [...FAILURE_RULES].sort((a, b) => b.confidence - a.confidence);

  for (const rule of sorted) {
    if (rule.pattern.test(lowerText)) {
      return {
        failure_type: rule.type,
        short_reason: rule.shortReason,
        detailed_reason: rule.detailedReason,
        probable_cause: rule.probableCause,
        fix_steps: [...(FIX_STEPS[rule.type] ?? FIX_STEPS.UNKNOWN_ERROR), ...getSourceSteps(source)],
        confidence: rule.confidence,
        ai_powered: false,
      };
    }
  }

  return {
    failure_type: "UNKNOWN_ERROR",
    short_reason: "Unrecognized error pattern",
    detailed_reason: "The failure didn't match known patterns. Check the logs manually.",
    probable_cause: "Unknown deployment issue",
    fix_steps: [...FIX_STEPS.UNKNOWN_ERROR, ...getSourceSteps(source)],
    confidence: 0.2,
    ai_powered: false,
  };
}

function getSourceSteps(source: string): string[] {
  if (source === "github") {
    return ["Push your fix to the repository and trigger a new deployment"];
  }
  if (source === "zip") {
    return ["Upload a new ZIP file with the corrected files"];
  }
  return [];
}