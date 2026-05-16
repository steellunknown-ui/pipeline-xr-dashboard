// Simple test to verify environment variables and API endpoint
async function testAISetup() {
  try {
    console.log('Testing AI setup...');
    
    // Check environment variable
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not found in environment');
    }
    
    console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
    
    // Test API endpoint
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ API connection successful!');
    console.log('Available models:', data.data?.length || 0);
    
    // Test specific model
    const qwenModel = data.data?.find(model => model.id.includes('qwen3-coder'));
    if (qwenModel) {
      console.log('✅ Qwen3 Coder model found:', qwenModel.id);
    } else {
      console.log('⚠️ Qwen3 Coder model not found, but API is working');
    }
    
    return true;
  } catch (error) {
    console.error('❌ AI Setup Test Failed:', error.message);
    return false;
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

testAISetup().then(success => {
  process.exit(success ? 0 : 1);
});