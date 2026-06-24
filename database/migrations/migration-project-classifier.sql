-- SAFE migration for ENV classifier (append-only behavior)

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'UNKNOWN',
ADD COLUMN IF NOT EXISTS requires_env BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS classification_reason TEXT,
ADD COLUMN IF NOT EXISTS classification_risk TEXT;

-- DO NOT mass-update existing projects.
-- Existing projects remain unchanged intentionally.
