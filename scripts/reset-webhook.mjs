const VERCEL_TOKEN = process.env.PIPELINE_VERCEL_TOKEN || process.env.PIPELINE_XR_VERCEL_TOKEN;
const WEBHOOK_URL = "https://pipeline-xr-dashboard.vercel.app/api/webhooks/deployment";
const EVENTS = ["deployment.created", "deployment.succeeded", "deployment.error", "deployment.canceled"];

// Step 1: List all existing webhooks
console.log("📋 Fetching existing webhooks...");
const listRes = await fetch("https://api.vercel.com/v1/webhooks", {
  headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
});
const { webhooks } = await listRes.json();
console.log(`Found ${webhooks?.length || 0} webhooks`);

// Step 2: Delete all existing webhooks
for (const wh of webhooks || []) {
  console.log(`🗑️  Deleting webhook ${wh.id} (${wh.url})...`);
  const delRes = await fetch(`https://api.vercel.com/v1/webhooks/${wh.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
  });
  console.log(`   Delete status: ${delRes.status}`);
}

// Step 3: Create fresh webhook
console.log("\n🔧 Creating new webhook...");
const createRes = await fetch("https://api.vercel.com/v1/webhooks", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ url: WEBHOOK_URL, events: EVENTS })
});

const data = await createRes.json();

if (!createRes.ok) {
  console.error("❌ Failed to create webhook:", data);
  process.exit(1);
}

console.log("\n✅ Webhook created successfully!");
console.log("ID:    ", data.id);
console.log("URL:   ", data.url);
console.log("Secret:", data.secret);
console.log("\n⚠️  COPY THIS SECRET → Add to Vercel Env Vars as PIPELINE_WEBHOOK_SECRET");
