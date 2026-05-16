import { NextRequest, NextResponse } from 'next/server';
import { QwenAI } from '@/lib/qwen-ai';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Message is required' 
      }, { status: 400 });
    }
    
    const ai = new QwenAI();
    const response = await ai.chat([
      { role: 'user', content: message }
    ]);

    return NextResponse.json({ 
      success: true, 
      response: response.choices[0]?.message?.content 
    });
  } catch (error: any) {
    console.error('AI Test Error:', error.message);
    
    if (error.message.includes('Rate limit')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rate limit exceeded. Please wait before trying again.' 
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'AI service temporarily unavailable' 
    }, { status: 503 });
  }
}