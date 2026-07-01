const OLD_WEBHOOK_ID = "account_hook_1ErCBVxEbxEWshhasudXegLe";
const VERCEL_TOKEN = process.env.PIPELINE_VERCEL_TOKEN;
const NEW_URL = "https://pipeline-xr-dashboard.vercel.app/api/webhooks/deployment";

// Step 1: Delete old webhook
const deleteRes = await fetch(
  `https://api.vercel.com/v1/webhooks/${OLD_WEBHOOK_ID}`,
  {
    method: "DELETE",
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
  }
);
console.log("Delete status:", deleteRes.status);

// Step 2: Create new webhook
const createRes = await fetch("https://api.vercel.com/v1/webhooks", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: NEW_URL,
    events: [
      "deployment.created",
      "deployment.succeeded", 
      "deployment.error",
      "deployment.canceled"
    ]
  })
});

const data = await createRes.json();
console.log("New webhook created:");
console.log("ID:", data.id);
console.log("URL:", data.url);
console.log("Secret:", data.secret);
