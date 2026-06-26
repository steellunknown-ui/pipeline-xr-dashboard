// ⚠️ HOMEPAGE AI ROUTE
// This route must NEVER depend on auth, session, DB, or redirects.
// Always return JSON with HTTP 200.

import { chatAI } from "@/lib/ai-client";

const SYSTEM_PROMPT = `You are PipelineBot, the friendly homepage assistant for Pipeline XR — a modern AI-powered deployment platform.

Your role:
- Explain what Pipeline XR is and how it works
- Help users understand deployment concepts (CI/CD, DevOps, etc.)
- Guide users to create accounts for real deployment help
- Compare Pipeline XR to Vercel, Netlify, Render, etc.
- Be warm, concise, and encouraging

For deployment requests ("deploy my project", "help me deploy", etc.):
Guide them to:
1. Create a free Pipeline XR account
2. Connect their GitHub repository
3. Use the DevOps XR AI in the dashboard for hands-on help

Pipeline XR key features:
🤖 AI Failure Analysis — understands why deployments fail
🔍 Smart Log Reader — real-time build log streaming  
🚀 One-Click Rollbacks — revert to any previous version
⚡ GitHub Auto-Deploy — push to deploy automatically
🛡️ Pre-Deploy Risk Check — catch issues before going live
💡 DevOps XR AI — personal deployment assistant

Keep responses under 3 sentences unless a numbered list is clearer.`;

const FALLBACKS: Array<[RegExp, string]> = [
  [/hello|hi|hey/i, "Hey! I'm PipelineBot 👋 I can explain how Pipeline XR works, compare it to other platforms, or help you get started with deployments."],
  [/deploy/i, "Pipeline XR makes deployments simple! Connect your GitHub repo, push your code, and our AI handles the rest — including catching failures before they go live. Create a free account to get started!"],
  [/feature|what can/i, "Pipeline XR has AI-powered failure analysis, real-time log streaming, one-click rollbacks, GitHub auto-deploy, and a DevOps AI assistant. It's everything Vercel does, plus intelligent failure recovery."],
  [/price|cost|free/i, "Pipeline XR has a generous free tier! You get full access to AI failure analysis, GitHub integration, and real-time deployments. Sign up and see for yourself."],
];

function getFallback(message: string): string {
  for (const [pattern, response] of FALLBACKS) {
    if (pattern.test(message)) return response;
  }
  return "I can explain how Pipeline XR works, what makes it different from Vercel/Netlify, and how to get started. What would you like to know?";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = (body.message || "").trim();

    if (!message) {
      return Response.json({ success: true, message: getFallback("") }, { status: 200 });
    }

    try {
      const reply = await chatAI(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        { temperature: 0.6, maxTokens: 512 }
      );

      return Response.json(
        { success: true, message: reply, data: { response: reply, mode: "ai" } },
        { status: 200 }
      );
    } catch {
      // Always respond even if AI fails — homepage must never break
      const fallback = getFallback(message);
      return Response.json(
        { success: true, message: fallback, data: { response: fallback, mode: "fallback" } },
        { status: 200 }
      );
    }
  } catch {
    const msg = "I can explain how Pipeline XR works and help you get started with smart deployments!";
    return Response.json({ success: true, message: msg, data: { response: msg, mode: "fallback" } }, { status: 200 });
  }
}