-- Migration: AI Fix Assistant Tables
-- Description: Adds deployment_fix_history table for tracking AI-assisted fixes

-- Table: deployment_fix_history
CREATE TABLE IF NOT EXISTS deployment_fix_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'undone')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system')),
  actor_user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  files_changed JSONB NOT NULL DEFAULT '[]',
  before_snapshot JSONB NOT NULL,
  after_snapshot JSONB NOT NULL,
  diff_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  undone_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fix_history_deployment_id ON deployment_fix_history(deployment_id);
CREATE INDEX IF NOT EXISTS idx_fix_history_project_id ON deployment_fix_history(project_id);

-- Enable RLS
ALTER TABLE deployment_fix_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view fixes for their own projects"
  ON deployment_fix_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deployment_fix_history.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fixes for their own projects"
  ON deployment_fix_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deployment_fix_history.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update fixes for their own projects"
  ON deployment_fix_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = deployment_fix_history.project_id
      AND projects.user_id = auth.uid()
    )
  );
