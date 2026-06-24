-- Add Vercel integration fields to deployments table
ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS deployment_url TEXT,
ADD COLUMN IF NOT EXISTS vercel_deployment_id TEXT;
