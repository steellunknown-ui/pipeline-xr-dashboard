-- Fix deployment status constraint
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;
ALTER TABLE deployments ADD CONSTRAINT deployments_status_check 
  CHECK (status IN ('pending', 'building', 'success', 'failed'));

-- Update any existing invalid statuses
UPDATE deployments SET status = 'pending' WHERE status = 'queued';
UPDATE deployments SET status = 'building' WHERE status = 'in_progress' OR status = 'running';
UPDATE deployments SET status = 'success' WHERE status = 'completed';