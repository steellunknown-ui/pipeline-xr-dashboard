-- Drop incorrect tables if they exist
DROP TABLE IF EXISTS env_variables CASCADE;
DROP TABLE IF EXISTS project_environment_variables CASCADE;

-- Ensure environment_variables table exists with correct schema
CREATE TABLE IF NOT EXISTS environment_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE environment_variables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own environment variables" ON environment_variables;
DROP POLICY IF EXISTS "Users can insert their own environment variables" ON environment_variables;
DROP POLICY IF EXISTS "Users can update their own environment variables" ON environment_variables;
DROP POLICY IF EXISTS "Users can delete their own environment variables" ON environment_variables;

-- Create RLS policies
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_environment_variables_user_id ON environment_variables(user_id);
CREATE INDEX IF NOT EXISTS idx_environment_variables_project_id ON environment_variables(project_id);
