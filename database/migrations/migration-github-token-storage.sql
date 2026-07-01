-- Add github_access_token to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS github_access_token TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS github_avatar_url TEXT;
