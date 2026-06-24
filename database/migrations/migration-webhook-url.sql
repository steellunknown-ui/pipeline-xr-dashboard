-- Add webhook_url column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Create index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_projects_webhook_url ON projects(webhook_url);
