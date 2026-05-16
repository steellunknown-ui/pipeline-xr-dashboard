import { QwenAI } from "./qwen-ai";

export interface ReplayExplanationInput {
  deploymentId: string;
  eventId: string;
  eventType: string;
  timestamp: string;
  message?: string;
  logsSnippet?: string[];
  auditContext?: {
    actor: string;
    action: string;
  };
}

export interface ReplayExplanationResult {
  summary: string;
  whyItMatters: string;
  whatToCheckNext?: string[];
}

export async function explainReplayEvent(
  input: ReplayExplanationInput
): Promise<ReplayExplanationResult | null> {
  try {
    const ai = new QwenAI();

    const systemPrompt = "You are a senior DevOps engineer explaining a specific deployment moment. Explain only what is known. Do not assume. Do not generalize.";

    const userPrompt = buildUserPrompt(input);

    const response = await ai.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    return parseAIResponse(content);
  } catch (error) {
    console.error("[replay-explanation] AI error:", error);
    return null;
  }
}

function buildUserPrompt(input: ReplayExplanationInput): string {
  let prompt = `Event: ${input.eventType}\nTimestamp: ${input.timestamp}\n`;

  if (input.message) {
    prompt += `Message: ${input.message}\n`;
  }

  if (input.auditContext) {
    prompt += `Actor: ${input.auditContext.actor}\nAction: ${input.auditContext.action}\n`;
  }

  if (input.logsSnippet && input.logsSnippet.length > 0) {
    prompt += `\nLog context:\n${input.logsSnippet.join("\n")}\n`;
  }

  prompt += "\nProvide:\n1. Summary (1 sentence)\n2. Why it matters (1 sentence)\n3. What to check next (optional, max 2 items)";

  return prompt;
}

function parseAIResponse(content: string): ReplayExplanationResult {
  const lines = content.split("\n").filter((l) => l.trim());

  let summary = "Event occurred during deployment.";
  let whyItMatters = "Part of the deployment process.";
  const whatToCheckNext: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("summary") || lines.indexOf(line) === 0) {
      summary = line.replace(/^(summary|1\.)\s*:?\s*/i, "").trim();
    } else if (lower.includes("matters") || lower.includes("why")) {
      whyItMatters = line.replace(/^(why it matters|2\.)\s*:?\s*/i, "").trim();
    } else if (lower.includes("check") || lower.includes("next")) {
      const item = line.replace(/^(what to check next|3\.)\s*:?\s*-?\s*/i, "").trim();
      if (item && whatToCheckNext.length < 2) {
        whatToCheckNext.push(item);
      }
    } else if (line.startsWith("-") && whatToCheckNext.length < 2) {
      whatToCheckNext.push(line.replace(/^-\s*/, "").trim());
    }
  }

  return {
    summary,
    whyItMatters,
    whatToCheckNext: whatToCheckNext.length > 0 ? whatToCheckNext : undefined,
  };
}
