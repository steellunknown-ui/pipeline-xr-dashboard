-- Add missing columns to activity_logs table
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_deployment_id ON activity_logs(deployment_id);
