# Auto-Deploy Quick Start

## Step 1: Run SQL Migration

In Supabase SQL Editor:

```sql
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS auto_deploy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_deploy_branch TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS webhook_secret TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_auto_deploy ON projects(auto_deploy_enabled) WHERE auto_deploy_enabled = true;
```

## Step 2: Install Dependencies

```bash
npm install @radix-ui/react-switch
```

## Step 3: Restart Server

```bash
npm run dev
```

## Step 4: Enable Auto-Deploy

1. Go to project settings
2. Toggle "Enable auto-deploy on Git push"
3. Set branch (e.g., "main")
4. Copy webhook URL and secret

## Step 5: Configure GitHub Webhook

In GitHub repo settings:
- URL: `http://localhost:3000/api/github/webhook`
- Secret: Paste from Pipeline XR
- Events: Just push event

## Step 6: Test

Push code to GitHub and watch deployment trigger automatically!

---

## Branch Mapping

- `main`/`master` → production
- `develop`/`dev`/`staging` → staging
- other → development
