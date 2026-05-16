const fs = require('fs');
const path = require('path');

// Simple test to verify environment variables and API endpoint
async function testAISetup() {
  try {
    console.log('Testing AI setup...');
    
    // Read .env.local file
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract API key
    const apiKeyMatch = envContent.match(/OPENROUTER_API_KEY=(.+)/);
    if (!apiKeyMatch) {
      throw new Error('OPENROUTER_API_KEY not found in .env.local');
    }
    
    const apiKey = apiKeyMatch[1].trim();
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

testAISetup().then(success => {
  console.log(success ? '🎉 AI Integration Test PASSED!' : '💥 AI Integration Test FAILED!');
  process.exit(success ? 0 : 1);
});