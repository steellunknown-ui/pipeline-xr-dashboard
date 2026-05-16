import { QwenAI } from './lib/qwen-ai.js';

async function testAI() {
  try {
    console.log('Testing Qwen AI integration...');
    
    const ai = new QwenAI();
    const response = await ai.chat([
      { role: 'user', content: 'Hello! Can you help me with Next.js development?' }
    ]);

    console.log('✅ AI Integration Test Passed!');
    console.log('Response:', response.choices[0]?.message?.content || 'No response content');
    
    return true;
  } catch (error) {
    console.error('❌ AI Integration Test Failed:', error.message);
    return false;
  }
}

testAI().then(success => {
  process.exit(success ? 0 : 1);
});