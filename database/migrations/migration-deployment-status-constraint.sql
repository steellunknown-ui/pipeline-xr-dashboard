-- Migration: Update deployments status constraint to include all status values used in code
-- This fixes the constraint violation error when inserting deployments with status values
-- like 'queued', 'in_progress', 'completed', 'cancelled'

-- Drop the existing constraint
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;

-- Add new constraint with all supported status values
-- Includes both old values (pending, building, success) and new values (queued, in_progress, completed) for compatibility
ALTER TABLE deployments 
  ADD CONSTRAINT deployments_status_check 
  CHECK (status IN ('pending', 'queued', 'building', 'in_progress', 'success', 'completed', 'failed', 'cancelled'));

-- Update default status to 'queued' to match code usage
ALTER TABLE deployments ALTER COLUMN status SET DEFAULT 'queued';



