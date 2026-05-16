# GitHub Integration Setup

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# GitHub Integration
GITHUB_TOKEN=your_github_personal_access_token_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## GitHub Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with these scopes:
   - `repo` (Full control of private repositories)
   - `read:user` (Read user profile data)
3. Copy the token and add it to `.env.local`

## Database Migration

Run the database migration to add GitHub integration fields:

```sql
-- Run this in your Supabase SQL editor
-- Add GitHub integration fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_deploy_enabled BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_deploy_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS framework TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_slug TEXT;

-- Add deployment_url to deployments table if not exists
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS deployment_url TEXT;

-- Update status constraint to include correct values
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;
ALTER TABLE deployments ADD CONSTRAINT deployments_status_check 
  CHECK (status IN ('pending', 'building', 'success', 'failed', 'cancelled'));
```

## Features Implemented

### 1. Auto Project Creation from GitHub
- Navigate to `/dashboard/projects/github`
- Select any GitHub repository
- Auto-detects framework (Next.js, React, Node.js)
- Auto-detects default branch (main/master)
- Validates repository structure (package.json, build script)

### 2. GitHub Webhook Integration
- Webhook URL: `{your_domain}/api/github/webhook`
- Auto-generates webhook secret for each project
- Listens for push events to default branch
- Automatically triggers deployments on git push

### 3. Repository Validation
- Checks for package.json existence
- Validates build script presence
- Detects framework type
- Blocks invalid repositories with clear error messages

### 4. AI Assistant Integration
- `analyzeGitHubRepository` - Analyzes repo structure
- `readRepositoryFile` - Reads specific files from repo
- Auto-explains deployment failures with exact reasons
- Suggests concrete fixes with git commands

## Usage Flow

1. **Import Project**: Go to Projects → Import from GitHub
2. **Select Repository**: Choose from your GitHub repos
3. **Auto-Analysis**: System validates and configures project
4. **Auto-Deploy**: Push to main branch → deployment starts automatically
5. **AI Assistance**: AI reads repo files and explains any failures

## Webhook Setup (Optional)

To enable automatic deployments on git push:

1. Go to your GitHub repository settings
2. Add webhook: `{your_domain}/api/github/webhook`
3. Set content type: `application/json`
4. Select "Just the push event"
5. Use the webhook secret from your project settings

## Testing

1. Create project from GitHub repo
2. Make a commit and push to main branch
3. Check `/dashboard/deployments` for automatic deployment
4. View logs for real-time deployment progress

The system is now ready for GitHub integration with automatic deployments!