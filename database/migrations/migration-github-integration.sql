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