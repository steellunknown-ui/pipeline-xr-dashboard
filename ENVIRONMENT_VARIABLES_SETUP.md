# Environment Variables Page - Complete Setup Guide

## Overview
Professional Vercel-style Environment Variables page with:
- ✅ Tabs for Production, Staging, Development
- ✅ Masked values with OTP verification to reveal
- ✅ Copy key/value buttons
- ✅ Edit and Delete modals
- ✅ Professional styling and animations

---

## Step 1: Install Dependencies

Run this command:

```bash
npm install @radix-ui/react-tabs @radix-ui/react-alert-dialog
```

---

## Step 2: Run Database Migration

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
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
```

---

## Step 3: Restart Your Dev Server

```bash
npm run dev
```

---

## Step 4: Test the Features

### 1. Add Environment Variable
- Go to `/dashboard/environment`
- Click "Add Variable"
- Fill in Key, Value, Environment
- Click "Add Variable"

### 2. View Variables by Environment
- Click tabs: Production, Staging, Development
- Each tab shows only variables for that environment

### 3. Reveal Value with OTP
- Click the Eye icon on any variable
- OTP will be sent (check browser console for OTP in demo mode)
- Enter the 6-digit OTP
- Value will be revealed temporarily
- Click Eye icon again to hide

### 4. Copy Key/Value
- Click Copy icon next to key to copy key
- Reveal value first, then click Copy icon to copy value

### 5. Edit Variable
- Click Pencil icon
- Update key and/or value
- Click "Update Variable"

### 6. Delete Variable
- Click Trash icon
- Confirm deletion in dialog
- Variable will be permanently deleted

---

## Features Implemented

### ✅ Environment Tabs
- Production (default)
- Staging
- Development
- Clean tab switching with Radix UI

### ✅ Variable Display
- Key shown in monospace font
- Value masked by default (••••••••••••••••)
- Professional card layout with hover effects

### ✅ OTP Verification Flow
1. User clicks Eye icon
2. System generates 6-digit OTP
3. OTP stored in `password_view_otps` table with 5-minute expiry
4. OTP logged to console (demo mode)
5. User enters OTP in dialog
6. If valid, value is revealed
7. OTP is deleted after verification

### ✅ Copy Functionality
- Copy key button (always available)
- Copy value button (only when revealed)
- Toast notification on copy

### ✅ Edit Modal
- Pre-filled with current key and value
- Update both key and value
- Validation and error handling

### ✅ Delete Confirmation
- AlertDialog with clear warning
- Shows variable key being deleted
- Permanent deletion warning

### ✅ Professional Styling
- Vercel-inspired design
- Smooth transitions and hover effects
- Responsive layout
- Clean spacing and typography
- Loading skeletons
- Empty states

---

## File Structure

```
app/dashboard/
├── environment/
│   └── page.tsx                    # Main Environment Variables page
├── actions/
│   ├── otp.ts                      # OTP server actions
│   ├── environment.ts              # Env variable CRUD actions
│   └── index.ts                    # Export all actions

components/ui/
├── tabs.tsx                        # Tabs component (NEW)
├── alert-dialog.tsx                # AlertDialog component (NEW)
├── dialog.tsx                      # Dialog component (existing)
├── button.tsx                      # Button component (existing)
├── input.tsx                       # Input component (existing)
└── ...

Database Tables:
├── environment_variables           # Existing table
└── password_view_otps             # NEW table for OTP verification
```

---

## OTP Flow Diagram

```
User clicks Eye icon
    ↓
sendViewOTP() generates 6-digit OTP
    ↓
OTP stored in password_view_otps table
    ↓
OTP logged to console (demo mode)
    ↓
User enters OTP in dialog
    ↓
verifyViewOTP() checks OTP validity
    ↓
If valid: Value revealed + OTP deleted
If invalid: Error message shown
```

---

## Security Notes

1. **OTP Expiry**: OTPs expire after 5 minutes
2. **One-time Use**: OTPs are deleted after verification
3. **User Isolation**: RLS ensures users only see their own OTPs
4. **Masked Values**: Values are masked by default
5. **Temporary Reveal**: Revealed values can be hidden again

---

## Demo Mode

In demo mode, OTPs are logged to the browser console:
```
OTP for variable abc-123: 456789
```

For production, integrate with email/SMS service to send OTPs.

---

## Troubleshooting

### Issue: Tabs not showing
**Solution**: Run `npm install @radix-ui/react-tabs`

### Issue: Delete dialog not working
**Solution**: Run `npm install @radix-ui/react-alert-dialog`

### Issue: OTP verification fails
**Solution**: Check if `password_view_otps` table exists in Supabase

### Issue: Can't reveal values
**Solution**: 
1. Check browser console for OTP
2. Ensure OTP is 6 digits
3. Verify OTP hasn't expired (5 min limit)

---

## Next Steps

1. ✅ Install dependencies
2. ✅ Run database migration
3. ✅ Restart dev server
4. ✅ Test all features
5. 🚀 Deploy to production

Enjoy your professional Environment Variables page! 🎉
