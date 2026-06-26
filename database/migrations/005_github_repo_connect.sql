ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo_full_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_default_branch TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_connected_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vercel_deployment_url TEXT;
