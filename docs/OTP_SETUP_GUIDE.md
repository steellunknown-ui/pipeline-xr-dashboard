# OTP Password Reset Setup Guide

## Step 1: Create Database Table in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/nyknxpakjngffjosdtwh
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Paste this SQL and click "Run":

```sql
create table reset_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index reset_otps_email_idx on reset_otps(email);
```

## Step 2: Restart Your Dev Server

```bash
npm run dev
```

## Step 3: Test the Flow

1. Go to http://localhost:3000/login
2. Click "Forgot Password?"
3. Enter your email
4. Check your email for the 6-digit OTP
5. Enter the OTP
6. Set your new password
7. Login with new password

## How It Works

1. **Forgot Password** (`/forgot-password`) → User enters email → OTP sent via Resend
2. **Enter OTP** (`/enter-otp`) → User enters 6-digit code → Verified against database
3. **New Password** (`/new-password`) → User sets new password → Updated in Supabase

## API Routes Created

- `POST /api/auth/send-otp` - Generates and sends OTP
- `POST /api/auth/verify-otp` - Verifies OTP code
- `POST /api/auth/reset-password` - Marks OTPs as used

## Files Created

- `lib/sendEmail.ts` - Resend email helper
- `app/api/auth/send-otp/route.ts` - Send OTP API
- `app/api/auth/verify-otp/route.ts` - Verify OTP API
- `app/api/auth/reset-password/route.ts` - Reset password API
- `app/enter-otp/page.tsx` - OTP entry page
- `app/new-password/page.tsx` - New password page
- Updated `app/forgot-password/page.tsx` - Now uses OTP system

## Environment Variables

Already added to `.env.local`:
```
RESEND_API_KEY=re_6uNbfyCY_LxQraqDmWyUcN9tKfebf6kp4
```

## Security Features

- OTPs expire after 10 minutes
- OTPs can only be used once
- 6-digit random codes
- Email verification required
- Database-backed validation
