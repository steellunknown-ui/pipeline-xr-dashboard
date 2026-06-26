/**
 * Pipeline XR — AI Client
 *
 * Three dedicated OpenRouter keys, each pinned to the right model:
 *   OPENROUTER_CHAT_KEY    → openai/gpt-oss-20b:free       (fast chat bot)
 *   OPENROUTER_ANALYZE_KEY → nvidia/nemotron-3-super-120b-a12b:free  (log analysis, 1M ctx)
 *   OPENROUTER_FIX_KEY     → poolside/laguna-m.1:free      (code fix suggestions)
 *
 * Each client automatically retries with exponential back-off on 429.
 */

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://pipeline-xr.com",
  "X-Title": "Pipeline XR",
};

export type AIRole = "system" | "user" | "assistant";
export interface AIMessage { role: AIRole; content: string; }

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

async function callWithRetry(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const { temperature = 0.1, maxTokens = 2000, jsonMode = false, maxRetries = 3 } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { ...DEFAULT_HEADERS, Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data: OpenRouterResponse = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI model");
      return content;
    }

    if (res.status === 429) {
      if (attempt === maxRetries) {
        throw new Error("RATE_LIMIT");
      }
      // Exponential back-off: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`AI request failed (${res.status}): ${errText}`);
  }

  throw new Error("AI request failed after retries");
}

// ─── Chat Client (openai/gpt-oss-20b — fast) ──────────────────────────────────
export async function chatAI(
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const key = process.env.OPENROUTER_CHAT_KEY;
  if (!key) throw new Error("OPENROUTER_CHAT_KEY is not set");
  return callWithRetry(key, "openai/gpt-oss-20b:free", messages, options);
}

// ─── Analyze Client (nvidia/nemotron-3-super — 1M ctx, deep reasoning) ────────
export async function analyzeAI(
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const key = process.env.OPENROUTER_ANALYZE_KEY;
  if (!key) throw new Error("OPENROUTER_ANALYZE_KEY is not set");
  return callWithRetry(key, "nvidia/nemotron-3-super-120b-a12b:free", messages, {
    maxTokens: 4096,
    ...options,
  });
}

// ─── Fix Client (poolside/laguna-m.1 — best coder on the list) ────────────────
export async function fixAI(
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const key = process.env.OPENROUTER_FIX_KEY;
  if (!key) throw new Error("OPENROUTER_FIX_KEY is not set");
  return callWithRetry(key, "poolside/laguna-m.1:free", messages, {
    maxTokens: 4096,
    ...options,
  });
}
