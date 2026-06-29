-- ============================================================
-- PIPELINE XR — ALL SUPABASE SQL QUERIES
-- Paste all your queries below this line
-- ============================================================

1st one :- create table reset_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index reset_otps_email_idx on reset_otps(email);


2nd one:-CREATE TABLE IF NOT EXISTS password_view_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_view_otps_email ON password_view_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_view_otps_expires_at ON password_view_otps(expires_at);



3rd one:- create policy "Users can view only their own project env variables"
on project_environment_variables
for select
using (auth.uid() = user_id);


4th one:-create policy "Users can insert env vars for their own project"
on project_environment_variables
for insert
with check (auth.uid() = user_id);


5th one:- create policy "Users can update their own env vars"
on project_environment_variables
for update
using (auth.uid() = user_id);


6th one:- create policy "Users can delete their own env vars"
on project_environment_variables
for delete
using (auth.uid() = user_id);


7th one:--- Allow users to see ONLY their own projects
create policy "User can view own projects"
on projects
for select
using (auth.uid() = user_id);

-- Allow user to insert new projects
create policy "User can insert own projects"
on projects
for insert
with check (auth.uid() = user_id);

-- Allow user to update only their own projects
create policy "User can update own projects"
on projects
for update
using (auth.uid() = user_id);

-- Allow user to delete only their own projects
create policy "User can delete own projects"
on projects
for delete
using (auth.uid() = user_id);

8th one :- -- SELECT allowed only for owner
create policy "User can view own deployments"
on deployments
for select
using (auth.uid() = user_id);

-- INSERT allowed only for owner
create policy "User can insert own deployments"
on deployments
for insert
with check (auth.uid() = user_id);

-- UPDATE allowed only for owner
create policy "User can update own deployments"
on deployments
for update
using (auth.uid() = user_id);

-- DELETE allowed only for owner
create policy "User can delete own deployments"
on deployments
for delete
using (auth.uid() = user_id);
 

 9th one:- -- SELECT: user sees only own logs
create policy "User can view own activity logs"
on activity_logs
for select
using (auth.uid() = user_id);

-- INSERT: system inserts only matching user_id
create policy "System insert logs for user"
on activity_logs
for insert
with check (auth.uid() = user_id);


10th one:-create policy "select_own_otps"
on public.password_view_otps
as permissive
for select
to authenticated
using (email = auth.email());


11th one:- create policy "insert_own_otps"
on public.password_view_otps
as permissive
for insert
to authenticated
with check (email = auth.email());


12th one:-create policy "update_own_otps"
on public.password_view_otps
as permissive
for update
to authenticated
using (email = auth.email());


13th one:-create policy "delete_own_otps"
on public.password_view_otps
as permissive
for delete
to authenticated
using (email = auth.email());


14th one:-CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'success')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at ASC);




15th one :- CREATE TABLE IF NOT EXISTS environment_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE environment_variables ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_environment_variables_user_id ON environment_variables(user_id);
CREATE INDEX IF NOT EXISTS idx_environment_variables_project_id ON environment_variables(project_id);


16th one:-DROP TABLE IF EXISTS env_variables CASCADE;
DROP TABLE IF EXISTS project_environment_variables CASCADE;


17th one:-SELECT * FROM activity_logs ORDER BY created_at DESC;

18th one:- -- Add new columns to activity_logs
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS deployment_id UUID REFERENCES public.deployments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON activity_logs;

-- Create RLS policies
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_deployment_id ON activity_logs(deployment_id);


19th one:- ELECT * FROM activity_logs ORDER BY created_at DESC;

20th one :--- Rename event_type to event if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE activity_logs RENAME COLUMN event_type TO event;
  END IF;
END $$;

-- Add event column if it doesn't exist
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS event TEXT NOT NULL DEFAULT '';

-- Make description nullable
ALTER TABLE activity_logs ALTER COLUMN description DROP NOT NULL;

-- Add new columns
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS deployment_id UUID REFERENCES public.deployments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON activity_logs;

-- Create RLS policies
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_deployment_id ON activity_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);



21th one:- -- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_logs'
ORDER BY ordinal_position;



22th one:- SELECT auth.uid() as my_user_id;

23rd one :- -- Get all users
SELECT id, email FROM auth.users;

24th one :- INSERT INTO activity_logs (
  user_id,
  event,
  description,
  metadata
) VALUES (
  'd17bc26a-cd6f-4817-802a-6ae5bf5b676b',
  'test_event',
  'Manual test log',
  '{"test": true}'::jsonb
);


25th :- SELECT * FROM activity_logs 
WHERE user_id = 'd17bc26a-cd6f-4817-802a-6ae5bf5b676b'
ORDER BY created_at DESC;


26th one:- -- Create password_view_otps table for OTP verification
-- Drop existing table if it has wrong structure
DROP TABLE IF EXISTS password_view_otps CASCADE;

-- Create password_view_otps table with correct columns
CREATE TABLE password_view_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variable_id UUID NOT NULL REFERENCES environment_variables(id) ON DELETE CASCADE,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE password_view_otps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own OTPs"
  ON password_view_otps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OTPs"
  ON password_view_otps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OTPs"
  ON password_view_otps FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_password_view_otps_user_id ON password_view_otps(user_id);
CREATE INDEX idx_password_view_otps_variable_id ON password_view_otps(variable_id);
CREATE INDEX idx_password_view_otps_expires_at ON password_view_otps(expires_at);



27th one:- -- Check current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'deployments'::regclass 
AND contype = 'c';

-- Drop old constraint if it exists
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_environment_check;

-- Add correct constraint
ALTER TABLE deployments 
ADD CONSTRAINT deployments_environment_check 
CHECK (environment IN ('development', 'staging', 'production'));



28th one:- -- Drop old constraint
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_environment_check;

-- Add correct constraint
ALTER TABLE deployments 
ADD CONSTRAINT deployments_environment_check 
CHECK (environment IN ('development', 'staging', 'production'));


29th one:- ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS auto_deploy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_deploy_branch TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS webhook_secret TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_auto_deploy ON projects(auto_deploy_enabled) WHERE auto_deploy_enabled = true;


30th one:--- Enable cascading delete for deployments
ALTER TABLE deployments 
DROP CONSTRAINT IF EXISTS deployments_project_id_fkey,
ADD CONSTRAINT deployments_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES projects(id) 
ON DELETE CASCADE;

-- Enable cascading delete for environment_variables
ALTER TABLE environment_variables 
DROP CONSTRAINT IF EXISTS environment_variables_project_id_fkey,
ADD CONSTRAINT environment_variables_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES projects(id) 
ON DELETE CASCADE;

-- Enable cascading delete for deployment_logs
ALTER TABLE deployment_logs 
DROP CONSTRAINT IF EXISTS deployment_logs_deployment_id_fkey,
ADD CONSTRAINT deployment_logs_deployment_id_fkey 
FOREIGN KEY (deployment_id) 
REFERENCES deployments(id) 
ON DELETE CASCADE;

-- Enable cascading delete for activity_logs
ALTER TABLE activity_logs 
DROP CONSTRAINT IF EXISTS activity_logs_project_id_fkey,
ADD CONSTRAINT activity_logs_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES projects(id) 
ON DELETE CASCADE;

ALTER TABLE activity_logs 
DROP CONSTRAINT IF EXISTS activity_logs_deployment_id_fkey,
ADD CONSTRAINT activity_logs_deployment_id_fkey 
FOREIGN KEY (deployment_id) 
REFERENCES deployments(id) 
ON DELETE CASCADE;


31th one :- ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;

32th one:-  alter table deployments
add column if not exists started_at timestamptz,
add column if not exists completed_at timestamptz,
add column if not exists deployment_url text,
add column if not exists error_message text;

33th one:- insert into deployment_logs (
  deployment_id,
  user_id,
  level,
  message
)
select 
  id,
  user_id,
  'info',
  'Manual test log'
from deployments
limit 1;


34th one:- -- Add GitHub integration fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_deploy_enabled BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_deploy_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS framework TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_slug TEXT;

-- Add deployment_url to deployments table if not exists
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS deployment_url TEXT;

-- Update existing deployment statuses to match new constraint
UPDATE deployments SET status = 'pending' WHERE status = 'queued';
UPDATE deployments SET status = 'building' WHERE status = 'in_progress';
UPDATE deployments SET status = 'success' WHERE status = 'completed';

-- Now update status constraint to include correct values
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;
ALTER TABLE deployments ADD CONSTRAINT deployments_status_check 
  CHECK (status IN ('pending', 'building', 'success', 'failed', 'cancelled'));


 35th one:- -- 1. Backfill project_slug for existing projects
UPDATE projects
SET project_slug = lower(
  regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')
)
WHERE project_slug IS NULL;

-- 2. Make project_slug mandatory
ALTER TABLE projects
ALTER COLUMN project_slug SET NOT NULL;

-- 3. Enforce unique project slug per user
CREATE UNIQUE INDEX IF NOT EXISTS projects_user_slug_unique
ON projects (user_id, project_slug);

36th one:- -- 4. Generate webhook secret for existing projects
UPDATE projects
SET webhook_secret = encode(gen_random_bytes(32), 'hex')
WHERE webhook_secret IS NULL;

-- 5. Enable auto-deploy where webhook exists
UPDATE projects
SET auto_deploy_enabled = true
WHERE webhook_url IS NOT NULL;

-- 6. Performance index for deployments
CREATE INDEX IF NOT EXISTS deployments_project_id_idx
ON deployments (project_id);

37th one:- SELECT user_id, project_slug, COUNT(*) 
FROM projects
GROUP BY user_id, project_slug
HAVING COUNT(*) > 1;


38th one:- WITH ranked AS (
  SELECT
    id,
    user_id,
    project_slug,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, project_slug
      ORDER BY created_at
    ) AS rn
  FROM projects
)
UPDATE projects
SET project_slug = project_slug || '-' || rn
FROM ranked
WHERE projects.id = ranked.id
  AND ranked.rn > 1;

39th one:- UPDATE projects
SET project_slug = 'project-' || id
WHERE project_slug IS NULL;


40th one:- SELECT user_id, project_slug, COUNT(*)
FROM projects
GROUP BY user_id, project_slug
HAVING COUNT(*) > 1;


50th one:-WITH ranked AS (
  SELECT
    p.id,
    p.user_id,
    p.project_slug,
    ROW_NUMBER() OVER (
      PARTITION BY p.user_id, p.project_slug
      ORDER BY p.created_at
    ) AS rn
  FROM projects p
)
UPDATE projects p
SET project_slug = p.project_slug || '-' || ranked.rn
FROM ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

  51th one:-  CREATE UNIQUE INDEX IF NOT EXISTS projects_user_slug_unique
ON projects (user_id, project_slug);

52th one:- -- ============================================================
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

-- Update status constraint to use ONLY the approved statuses
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;
ALTER TABLE deployments ADD CONSTRAINT deployments_status_check 
  CHECK (status IN ('pending', 'building', 'success', 'failed', 'cancelled'));

-- Create indexes for deployment queries
CREATE INDEX IF NOT EXISTS idx_deployments_commit_sha ON deployments(commit_sha);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at DESC);

53th one:- -- projects table
SELECT webhook_enabled, github_webhook_id, auto_deploy_branch, project_slug
FROM projects
LIMIT 1;

-- deployments table
SELECT commit_sha, commit_message, status, deployment_url
FROM deployments
LIMIT 1;

-- constraint check
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'deployments_status_check';

54th one:- SELECT commit_sha, COUNT(*)
FROM deployments
GROUP BY commit_sha
HAVING COUNT(*) > 1;


55th one:- ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

UPDATE deployments
SET source = 'legacy'
WHERE commit_sha IS NULL;

56th:-

57th one:- -- Check current deployments and their source values
SELECT d.id, d.source, p.name as project_name, p.github_repo_url 
FROM deployments d 
JOIN projects p ON d.project_id = p.id 
ORDER BY d.created_at DESC;

58th one:- -- Update deployments to 'github' for projects that have GitHub URLs
UPDATE deployments 
SET source = 'github' 
WHERE project_id IN (
  SELECT id FROM projects 
  WHERE github_repo_url LIKE '%github.com%'
);


59th one:--- Update specific projects by name
UPDATE deployments 
SET source = 'github' 
WHERE project_id IN (
  SELECT id FROM projects 
  WHERE name IN ('my-website', 'investment tracker')
);


60th one:- -- Check if any deployments exist at all
SELECT COUNT(*) as total_deployments FROM deployments;

61th one:- -- Check if any projects exist
SELECT id, name, github_repo_url FROM projects ORDER BY created_at DESC;

62th one:- -- Check what the current source values are
SELECT d.id, d.source, p.name, p.github_repo_url 
FROM deployments d 
JOIN projects p ON d.project_id = p.id;


63th one:-  -- Force update all deployments to github source where project has github_repo_url
UPDATE deployments 
SET source = 'github' 
FROM projects 
WHERE deployments.project_id = projects.id 
AND projects.github_repo_url IS NOT NULL;

64th one:- -- Reset all deployments to default, then we'll set the correct ones
UPDATE deployments SET source = 'zip';


65th one:- -- Update specific deployment IDs to zip (replace with actual IDs)
UPDATE deployments SET source = 'zip' WHERE id IN ('deployment-id-1', 'deployment-id-2');


66th one:- -- Check deployment logs to identify source
SELECT d.id, d.source, p.name, dl.message 
FROM deployments d 
JOIN projects p ON d.project_id = p.id 
LEFT JOIN deployment_logs dl ON d.id = dl.deployment_id 
WHERE dl.message LIKE '%ZIP%' OR dl.message LIKE '%GitHub%' OR dl.message LIKE '%Auto-deployment%'
ORDER BY d.created_at DESC;


67th one:--- Update deployments to 'github' if they have GitHub-related logs
UPDATE deployments 
SET source = 'github' 
WHERE id IN (
  SELECT DISTINCT d.id 
  FROM deployments d 
  JOIN deployment_logs dl ON d.id = dl.deployment_id 
  WHERE dl.message LIKE '%Auto-deployment%' 
  OR dl.message LIKE '%GitHub%' 
  OR dl.message LIKE '%Cloning repository%'
);

-- Update deployments to 'zip' if they have ZIP-related logs
UPDATE deployments 
SET source = 'zip' 
WHERE id IN (
  SELECT DISTINCT d.id 
  FROM deployments d 
  JOIN deployment_logs dl ON d.id = dl.deployment_id 
  WHERE dl.message LIKE '%ZIP%' 
  OR dl.message LIKE '%ZIP file received%'
);


68th one:- ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS source TEXT
CHECK (source IN ('github', 'zip', 'manual'));

69th one:- UPDATE deployments
SET source = 'manual'
WHERE source IS NULL;

70th one :- SELECT id, status, started_at, now() - started_at AS age
FROM deployments
WHERE status = 'building';


71th one:- UPDATE deployments
SET started_at = created_at
WHERE status = 'building'
AND started_at IS NULL;


72th one:- UPDATE deployments
SET status = 'failed',
    error_message = 'Build timed out (recovered from missing started_at)',
    completed_at = now()
WHERE status = 'building'
AND started_at < now() - interval '15 minutes';


73th one:- SELECT id, status, started_at, created_at
FROM deployments
ORDER BY created_at DESC
LIMIT 10;


74th one:- SELECT COUNT(*) AS null_started_at_builds
FROM deployments
WHERE status = 'building'
AND started_at IS NULL;


75th one:- UPDATE deployments
SET status = 'failed',
    error_message = 'Recovered from stuck build (pre-runner-fix)',
    completed_at = now()
WHERE status = 'building'
AND started_at IS NULL;

76th one:--- Deployment Audit Log Table

CREATE TABLE IF NOT EXISTS deployment_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  deployment_id UUID REFERENCES deployments(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system')),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_deployment ON deployment_audit_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON deployment_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON deployment_audit_logs(created_at DESC);

ALTER TABLE deployment_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project audit logs"
  ON deployment_audit_logs
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert audit logs"
  ON deployment_audit_logs
  FOR INSERT
  WITH CHECK (true);


  77th one:- -- Database migration for Priority ENV-Classifier Engine
-- Adds deterministic classification fields to the projects table

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS requires_env BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS classification_reason TEXT;

-- Update existing projects to be safe fallbacks
UPDATE public.projects
SET project_type = 'UNKNOWN',
    requires_env = FALSE,
    classification_reason = 'Pre-existing project before classifier engine implementation'
WHERE project_type IS NULL;


78the one:--- SAFE migration for ENV classifier (append-only behavior)

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS requires_env BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS classification_reason TEXT,
ADD COLUMN IF NOT EXISTS classification_risk TEXT;

-- DO NOT mass-update existing projects.
-- Existing projects remain unchanged intentionally.


79th one:-  -- Migration for Priority ENV-Change Detector
-- Adds environment variable fingerprint tracking to deployments

ALTER TABLE public.deployments
ADD COLUMN IF NOT EXISTS env_fingerprint TEXT;

-- We do NOT mass-update existing deployments to a default value
-- because the absence of a fingerprint securely implies "no fingerprint tracking existed."
-- This guarantees backward compatibility and safe append-only behavior.

80th one:- ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo_full_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_default_branch TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_connected_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;

-- URL Overhaul Migration
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS vercel_deployment_id TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS alias_url TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS preview_image_url TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS alias_status TEXT DEFAULT 'pending';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS ai_fix_attempts INTEGER DEFAULT 0;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS ai_fix_status TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS production_alias_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vercel_deployment_url TEXT;

90th one:- ALTER TABLE projects ALTER COLUMN github_repo_url DROP NOT NULL;
