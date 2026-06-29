-- 1. Update Projects table for ZIP uploads
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'github' CHECK (source_type IN ('github', 'zip'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS zip_url TEXT NULL;

-- 2. Update Deployments table for Scheduling
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NULL;

-- Update deployments status constraint to allow 'scheduled'
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check;
ALTER TABLE deployments 
  ADD CONSTRAINT deployments_status_check 
  CHECK (status IN ('pending', 'queued', 'scheduled', 'building', 'in_progress', 'success', 'completed', 'failed', 'cancelled'));

-- Update deployments source constraint to ensure 'zip' is allowed (if it wasn't already)
ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_source_check;
ALTER TABLE deployments ADD CONSTRAINT deployments_source_check CHECK (source IN ('github', 'manual', 'zip'));

-- 3. Storage Policies for ZIP Uploads
-- Allow authenticated users to upload files to the new bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'pipeline-xr-uploads' );

-- Allow public read access to the bucket
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'pipeline-xr-uploads' );
