-- Add auto-deploy columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS auto_deploy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_deploy_branch TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS webhook_secret TEXT NULL;

-- Create index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_projects_auto_deploy ON projects(auto_deploy_enabled) WHERE auto_deploy_enabled = true;

-- RLS policies remain unchanged (existing policies still apply)
