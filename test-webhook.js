/**
 * Test script for GitHub webhook endpoint
 * 
 * This script simulates a GitHub push webhook to test the endpoint locally.
 * 
 * Usage:
 * 1. Make sure your Next.js dev server is running (npm run dev)
 * 2. Update the project details below (projectId, webhook_secret, repo info)
 * 3. Run: node test-webhook.js
 */

const crypto = require('crypto');

// ============================================================
// CONFIGURATION - Update these values
// ============================================================
const WEBHOOK_URL = 'http://localhost:3000/api/github/webhook';
const WEBHOOK_SECRET = 'your-webhook-secret-here'; // Get from projects.webhook_secret in database
const REPO_FULL_NAME = 'username/repo'; // e.g., "johndoe/my-project"
const BRANCH = 'main';

// ============================================================
// GitHub Push Event Payload (Simulated)
// ============================================================
const payload = {
    ref: `refs/heads/${BRANCH}`,
    after: 'abc123def456789abc123def456789abc123def4', // Fake commit SHA
    repository: {
        full_name: REPO_FULL_NAME,
        name: REPO_FULL_NAME.split('/')[1],
    },
    head_commit: {
        id: 'abc123def456789abc123def456789abc123def4',
        message: 'Test commit from webhook test script',
        author: {
            name: 'Test User',
            email: 'test@example.com',
        },
    },
    pusher: {
        name: 'Test User',
    },
};

// ============================================================
// Generate HMAC Signature
// ============================================================
const payloadString = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmac.update(payloadString);
const signature = 'sha256=' + hmac.digest('hex');

console.log('🔧 Testing GitHub Webhook Endpoint');
console.log('================================');
console.log('URL:', WEBHOOK_URL);
console.log('Repo:', REPO_FULL_NAME);
console.log('Branch:', BRANCH);
console.log('Signature:', signature);
console.log('');

// ============================================================
// Send Request
// ============================================================
fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': signature,
    },
    body: payloadString,
})
    .then(async (response) => {
        const data = await response.json();
        console.log('📥 Response Status:', response.status);
        console.log('📥 Response Body:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('');
            console.log('✅ Webhook test successful!');
            if (data.deployment_id) {
                console.log('✅ Deployment created:', data.deployment_id);
            }
        } else {
            console.log('');
            console.log('❌ Webhook test failed');
            console.log('Error:', data.error);
        }
    })
    .catch((error) => {
        console.error('');
        console.error('❌ Request failed:', error.message);
    });
