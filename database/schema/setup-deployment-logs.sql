-- Run this in Supabase SQL Editor to create deployment_logs table

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

-- RLS Policies
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at ASC);
