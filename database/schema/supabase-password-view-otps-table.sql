-- Create password_view_otps table for storing OTPs to view passwords
CREATE TABLE IF NOT EXISTS password_view_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_view_otps_email ON password_view_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_view_otps_expires_at ON password_view_otps(expires_at);
