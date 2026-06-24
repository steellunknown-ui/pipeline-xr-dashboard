-- Add deployment_url column to deployments table
ALTER TABLE deployments ADD COLUMN deployment_url TEXT;

-- Add slug column to projects table
ALTER TABLE projects ADD COLUMN slug TEXT;

-- Create index on slug for faster lookups
CREATE INDEX idx_projects_slug ON projects(slug);

-- Update existing projects with slugs (run this after the helper function is created)
-- UPDATE projects SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;