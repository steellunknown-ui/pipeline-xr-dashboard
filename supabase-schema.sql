-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  github_repo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Deployments Table
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  branch TEXT NOT NULL,
  commit_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deployments
CREATE POLICY "Users can view their own deployments"
  ON deployments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deployments"
  ON deployments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deployments"
  ON deployments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments"
  ON deployments FOR DELETE
  USING (auth.uid() = user_id);

-- Environment Variables Table
CREATE TABLE IF NOT EXISTS environment_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE environment_variables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for environment_variables
CREATE POLICY "Users can view their own environment variables"
  ON environment_variables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own environment variables"
  ON environment_variables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own environment variables"
  ON environment_variables FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own environment variables"
  ON environment_variables FOR DELETE
  USING (auth.uid() = user_id);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Deployment Logs Table
CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'success')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deployment_logs
CREATE POLICY "Users can view logs for their own deployments"
  ON deployment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deployments
      WHERE deployments.id = deployment_logs.deployment_id
      AND deployments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert logs for their own deployments"
  ON deployment_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deployments
      WHERE deployments.id = deployment_logs.deployment_id
      AND deployments.user_id = auth.uid()
    )
  );

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_environment_variables_user_id ON environment_variables(user_id);
CREATE INDEX IF NOT EXISTS idx_environment_variables_project_id ON environment_variables(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at ASC);
