-- Fix project deletion cascades
-- Find any foreign keys to projects that do not have ON DELETE CASCADE

-- 1. environment_variables
ALTER TABLE public.environment_variables
DROP CONSTRAINT IF EXISTS environment_variables_project_id_fkey;

ALTER TABLE public.environment_variables
ADD CONSTRAINT environment_variables_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 2. deployments
ALTER TABLE public.deployments
DROP CONSTRAINT IF EXISTS deployments_project_id_fkey;

ALTER TABLE public.deployments
ADD CONSTRAINT deployments_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 3. activity_logs
ALTER TABLE public.activity_logs
DROP CONSTRAINT IF EXISTS activity_logs_project_id_fkey;

ALTER TABLE public.activity_logs
ADD CONSTRAINT activity_logs_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 4. deployment_fix_history
ALTER TABLE public.deployment_fix_history
DROP CONSTRAINT IF EXISTS deployment_fix_history_project_id_fkey;

ALTER TABLE public.deployment_fix_history
ADD CONSTRAINT deployment_fix_history_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Also fix deployment cascades
-- 5. deployment_logs
ALTER TABLE public.deployment_logs
DROP CONSTRAINT IF EXISTS deployment_logs_deployment_id_fkey;

ALTER TABLE public.deployment_logs
ADD CONSTRAINT deployment_logs_deployment_id_fkey
FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE CASCADE;

-- 6. activity_logs (deployment)
ALTER TABLE public.activity_logs
DROP CONSTRAINT IF EXISTS activity_logs_deployment_id_fkey;

ALTER TABLE public.activity_logs
ADD CONSTRAINT activity_logs_deployment_id_fkey
FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE CASCADE;
