-- Migration for Priority ENV-Change Detector
-- Adds environment variable fingerprint tracking to deployments

ALTER TABLE public.deployments
ADD COLUMN IF NOT EXISTS env_fingerprint TEXT;

-- We do NOT mass-update existing deployments to a default value
-- because the absence of a fingerprint securely implies "no fingerprint tracking existed."
-- This guarantees backward compatibility and safe append-only behavior.
