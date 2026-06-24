-- ============================================================
-- FINAL MIGRATION: GitHub Auto-Deploy Schema
-- ============================================================
-- This migration adds all required fields for GitHub webhook-based auto-deployment
-- Run this ONCE on your Supabase instance

-- ============================================================
-- PROJECTS TABLE: Add webhook and GitHub integration fields
-- ============================================================

-- Rename auto_deploy_enabled to webhook_enabled (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'auto_deploy_enabled'
  ) THEN
    ALTER TABLE projects RENAME COLUMN auto_deploy_enabled TO webhook_enabled;
  END IF;
END $$;

-- Add missing columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_secret TEXT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_webhook_id BIGINT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_deploy_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_slug TEXT NULL;

-- Add columns that may already exist from previous migrations
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS framework TEXT NULL;

-- Drop webhook_url column if it exists (not needed - webhook URL is implicit)
ALTER TABLE projects DROP COLUMN IF EXISTS webhook_url;

-- Create indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_projects_webhook_enabled ON projects(webhook_enabled) WHERE webhook_enabled = true;
CREATE INDEX IF NOT EXISTS idx_projects_github_webhook_id ON projects(github_webhook_id) WHERE github_webhook_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_project_slug ON projects(project_slug);

-- ============================================================
-- DEPLOYMENTS TABLE: Add webhook-triggered deployment fields
-- ============================================================

-- Add missing deployment fields
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS commit_message TEXT NULL;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS commit_author TEXT NULL;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS deployment_url TEXT NULL;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS error_message TEXT NULL;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

-- Add source field to track deployment origin
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('github', 'manual', 'zip'));

-- Rename commit_hash to commit_sha for consistency with GitHub API
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deployments' AND column_name = 'commit_hash'
  ) THEN
    ALTER TABLE deployments RENAME COLUMN commit_hash TO commit_sha;
  END IF;
END $$;

-- Add commit_sha if it doesn't exist
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS commit_sha TEXT NULL;

-- Add constraint: GitHub deployments REQUIRE commit_sha
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_github_commit_sha_check;
ALTER TABLE deployments ADD CONSTRAINT deployments_github_commit_sha_check 
  CHECK (source != 'github' OR commit_sha IS NOT NULL);

-- Update status constraint to use ONLY the approved statuses
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;
ALTER TABLE deployments ADD CONSTRAINT deployments_status_check 
  CHECK (status IN ('pending', 'building', 'success', 'failed', 'cancelled'));

-- Create indexes for deployment queries
CREATE INDEX IF NOT EXISTS idx_deployments_commit_sha ON deployments(commit_sha);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_source ON deployments(source);

-- ============================================================
-- VERIFICATION QUERIES (Run these to confirm migration)
-- ============================================================
-- Uncomment and run separately to verify:

-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'projects' 
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'deployments' 
-- ORDER BY ordinal_position;
