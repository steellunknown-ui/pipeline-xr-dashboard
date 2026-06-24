-- Create password_view_otps table for OTP verification
CREATE TABLE IF NOT EXISTS password_view_otps (
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
CREATE INDEX IF NOT EXISTS idx_password_view_otps_user_id ON password_view_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_password_view_otps_variable_id ON password_view_otps(variable_id);
CREATE INDEX IF NOT EXISTS idx_password_view_otps_expires_at ON password_view_otps(expires_at);

-- Auto-delete expired OTPs (optional cleanup function)
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM password_view_otps WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
