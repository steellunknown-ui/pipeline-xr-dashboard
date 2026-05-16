import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { tools, executeTool } from '@/lib/ai-tools';

export async function POST(req: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "AI is not configured. Missing API key."
      });
    }

    const body = await req.json();
    const { message, userId } = body;

    if (!message || !userId) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields"
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://pipeline-xr.com',
        'X-Title': 'Pipeline XR',
      },
    });

    let response = '';
    let toolCalls = 0;
    const maxIterations = 5; // Increased for tool usage

    const messages: any[] = [
      {
        role: 'system',
        content: `You are XR DevOps AI - Pipeline XR's helpful deployment assistant.

🎯 MISSION: Help users understand how to use Pipeline XR features and assess deployment risks.

Help users with:
- Deployment status and troubleshooting
- ZIP upload and auto-deploy guides
- Risk assessment for deployments
- Build errors and failure analysis

Be helpful, concise, and provide actionable guidance.`
      },
      {
        role: 'user',
        content: message
      }
    ];

    while (toolCalls < maxIterations) {
      const completion = await openai.chat.completions.create({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages,
        // Note: tools disabled - Gemma 3 free tier doesn't support tool calling
        temperature: 0.1,
        max_tokens: 2000,
      });

      const assistantMessage = completion.choices[0].message;

      if (!assistantMessage) {
        response = 'I encountered an issue. Let me try again.';
        break;
      }

      messages.push(assistantMessage);

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        toolCalls++;
        let toolResults: any[] = [];

        for (const toolCall of assistantMessage.tool_calls as any[]) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            args.userId = userId;

            const result = await executeTool(toolCall.function.name, args);
            toolResults.push(result);

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error: any) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: false, error: 'Tool failed' }),
            });
          }
        }

        // Check for risk analysis queries
        const riskQuery = message.toLowerCase();
        if ((riskQuery.includes('is it safe to deploy') ||
          riskQuery.includes('should i deploy now') ||
          riskQuery.includes('any risks') ||
          riskQuery.includes('deployment risks')) &&
          toolResults.length > 0) {

          const latestDeployment = toolResults.find(r => r.success && r.deployment);
          if (latestDeployment?.deployment?.projectId) {
            try {
              const riskResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/deployments/preflight-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  projectId: latestDeployment.deployment.projectId,
                  source: 'github',
                  commit_sha: undefined
                })
              });

              if (riskResponse.ok) {
                const riskData = await riskResponse.json();
                const riskEmoji: Record<string, string> = {
                  'high': '🔴',
                  'medium': '🟡',
                  'low': '🟢'
                };

                const riskMessage = `${riskEmoji[riskData.risk_level] || '⚪'} **${riskData.risk_level.toUpperCase()} RISK**\n\n**Factors:** ${riskData.reasons.join(', ')}\n**Recommendation:** ${riskData.recommendation}`;

                messages.push({
                  role: 'tool',
                  tool_call_id: 'risk_analysis',
                  content: JSON.stringify({ success: true, risk_analysis: riskMessage }),
                });
              }
            } catch (error) {
              // Silent fail - continue without risk data
            }
          }
        }
        const timelineQuery = message.toLowerCase();
        if ((timelineQuery.includes('what is happening') ||
          timelineQuery.includes('deployment status') ||
          timelineQuery.includes('is it stuck')) &&
          toolResults.length > 0) {

          const latestDeployment = toolResults.find(r => r.success && r.deployment);
          if (latestDeployment?.deployment?.id) {
            try {
              const timelineResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/deployments/${latestDeployment.deployment.id}/timeline`);
              const timelineData = await timelineResponse.json();

              if (timelineData.success) {
                const { currentStage, elapsedSeconds, status, source } = timelineData;
                const minutes = Math.floor(elapsedSeconds / 60);
                const seconds = elapsedSeconds % 60;
                const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

                let normalityCheck = '';
                if (currentStage === 'queued' && elapsedSeconds > 300) {
                  normalityCheck = ' (longer than usual - may be high traffic)';
                } else if (currentStage === 'building' && elapsedSeconds > 600) {
                  normalityCheck = ' (taking longer than typical 2-5 minutes)';
                } else if (elapsedSeconds < 120) {
                  normalityCheck = ' (normal duration)';
                }

                const timelineMessage = `🔍 **Current Status**: ${status}\n📍 **Stage**: ${currentStage}\n⏱️ **Elapsed**: ${timeStr}${normalityCheck}\n📦 **Source**: ${source}`;

                messages.push({
                  role: 'tool',
                  tool_call_id: 'timeline_check',
                  content: JSON.stringify({ success: true, timeline: timelineMessage }),
                });
              }
            } catch (error) {
              // Silent fail - continue without timeline data
            }
          }
        }

        // If tool returned a direct message, use it immediately
        const directMessage = toolResults.find(r => r.success && r.message && r.realTimeUpdate);
        if (directMessage) {
          response = directMessage.message;
          break;
        }
      } else {
        response = assistantMessage.content || '';
        break;
      }
    }

    if (!response && toolCalls >= maxIterations) {
      const finalCompletion = await openai.chat.completions.create({
        model: 'tngtech/tng-r1t-chimera:free',
        messages: [...messages, { role: 'user', content: 'Summarize what you found and provide next steps.' }],
        temperature: 0.2,
        max_tokens: 800,
      });
      response = finalCompletion.choices[0].message.content || 'Analysis complete. Check the details above.';
    }

    if (!response) {
      response = '🤖 I\'m ready to help with deployments. Try saying "auto-deploy" or "check status".';
    }

    return NextResponse.json({
      success: true,
      message: response,
      data: { response, mode: 'devops' }
    });
  } catch (error: any) {
    console.error('AI API Error:', error);
    return NextResponse.json({
      success: false,
      error: `AI service temporarily unavailable: ${error.message}`
    });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const message = searchParams.get('message');

    if (!message) {
      return NextResponse.json({
        success: false,
        error: 'Missing message'
      });
    }

    const mode = message.toLowerCase().includes('deploy') ||
      message.toLowerCase().includes('error') ||
      message.toLowerCase().includes('status') ? 'devops' : 'homepage';

    return NextResponse.json({
      success: true,
      data: { mode }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      data: { mode: 'homepage' }
    });
  }
}