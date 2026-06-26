import { NextResponse } from "next/server";
import { chatAI } from "@/lib/ai-client";

const SYSTEM_PROMPT = `You are XR — Pipeline XR's AI DevOps assistant.

Your job is to help developers understand their deployments and fix problems.

You can help with:
- Explaining deployment status (building, failed, success)
- Diagnosing build errors and failures
- Environment variable setup
- GitHub integration and auto-deploy setup
- Deployment best practices

Rules:
- Be concise and direct. No fluff.
- Use simple language. Developers are often stressed when deployments fail.
- Use emojis sparingly but effectively (✅ for success, ❌ for errors, 💡 for tips).
- Format steps as numbered lists when giving instructions.
- If you don't know something, say so and suggest where to look.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, userId, context } = body;

    if (!message?.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" });
    }

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Include optional context (deployment info, project name, etc.)
    if (context) {
      messages.push({
        role: "system",
        content: `Current context: ${JSON.stringify(context)}`,
      });
    }

    messages.push({ role: "user", content: message });

    const response = await chatAI(messages, { temperature: 0.3, maxTokens: 1024 });

    return NextResponse.json({ success: true, message: response });
  } catch (err: any) {
    console.error("[Assistant API]", err.message);

    if (err.message === "RATE_LIMIT") {
      return NextResponse.json({
        success: false,
        error: "XR AI is busy right now. Try again in a few seconds.",
        rateLimited: true,
      });
    }

    return NextResponse.json({
      success: false,
      error: "AI assistant is temporarily unavailable.",
    });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, status: "XR AI Assistant is online 🟢" });
}