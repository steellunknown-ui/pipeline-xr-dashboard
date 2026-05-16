// ⚠️ HOMEPAGE AI ROUTE
// This route must NEVER depend on auth, session, DB, or redirects.
// Always return JSON with HTTP 200.

import OpenAI from 'openai';

async function callHomepageAI(message: string): Promise<string> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return getFallbackResponse(message);
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://pipeline-xr.com',
        'X-Title': 'Pipeline XR Homepage AI',
      },
    });

    const completion = await openai.chat.completions.create({
      model: 'qwen/qwen3-coder:free',
      messages: [
        {
          role: 'system',
          content: `You are PipelineBot, the friendly homepage assistant for Pipeline XR.

Your role:
- Explain what Pipeline XR is and how it works
- Help users understand deployment concepts (CI/CD, DevOps, etc.)
- Guide users to create accounts for real deployment help
- Compare Pipeline XR to other platforms (Vercel, Netlify)
- Be warm, helpful, and encouraging

For deployment requests ("deploy my project", "create deployment", etc.):
Respond warmly and guide them to:
1. Create a free Pipeline XR account
2. Connect their GitHub repository  
3. Access DevOps XR AI in their dashboard for real deployment help

Pipeline XR Features:
🤖 AI-Powered Analysis - Intelligent deployment insights
🔍 Smart Failure Detection - Automatic issue identification
📊 Deployment Intelligence - Pattern learning
🚀 One-Click Rollbacks - Safe version reverting
⚡ Real-Time Monitoring - Detailed progress tracking
🔗 GitHub Integration - Seamless repository connection
💡 DevOps XR AI - Personal deployment assistant
🛡️ Risk Assessment - Proactive issue prevention

Be conversational, helpful, and encourage users to sign up for the full experience.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0]?.message?.content || getFallbackResponse(message);
  } catch (error) {
    console.error('Homepage AI error:', error);
    return getFallbackResponse(message);
  }
}

function getFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hello! I'm PipelineBot, your deployment guide. I can explain how Pipeline XR works and help you get started with smart deployments!";
  }

  if (lowerMessage.includes('deploy') || lowerMessage.includes('deployment')) {
    return "I'd love to help you deploy your project! To get started with real deployments, create a free Pipeline XR account and connect your GitHub repository. Our DevOps XR AI will then guide you through everything!";
  }

  if (lowerMessage.includes('features')) {
    return "Pipeline XR offers AI-powered deployment analysis, smart failure detection, one-click rollbacks, real-time monitoring, and much more. Create an account to experience the full power of intelligent deployments!";
  }

  return "I can explain how Pipeline XR works, what makes it different, and how deployments behave at a high level. What would you like to know?";
}

// Add artificial delay to make it feel natural
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message || '';

    // Add thinking delay (800-1500ms)
    const thinkingTime = 800 + Math.random() * 700;
    await delay(thinkingTime);

    const reply = await callHomepageAI(message);

    return Response.json({
      success: true,
      message: reply,
      data: { response: reply, mode: 'ai' }
    }, { status: 200 });

  } catch (error) {
    console.error('Homepage AI error:', error);

    return Response.json({
      success: true,
      message: "I can explain how Pipeline XR works, what makes it different, and how deployments behave at a high level.",
      data: { response: "I can explain how Pipeline XR works, what makes it different, and how deployments behave at a high level.", mode: 'fallback' }
    }, { status: 200 });
  }
}