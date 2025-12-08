# Real Email OTP Verification - Setup Guide

## Overview
The Environment Variables page now uses **REAL Supabase Auth OTP** sent via email to reveal secret values.

---

## How It Works

### 1. User Clicks Eye Icon
- System sends OTP to user's email using `supabase.auth.signInWithOtp()`
- No new user is created (`shouldCreateUser: false`)
- Uses the logged-in user's email automatically

### 2. User Receives Email
- Supabase sends a 6-digit OTP code to the user's email
- Code expires in 60 seconds

### 3. User Enters OTP
- Modal appears asking for the 6-digit code
- User enters the code from their email

### 4. System Verifies OTP
- Uses `supabase.auth.verifyOtp()` to validate the code
- If valid, reveals the secret value

### 5. Auto-Hide After 60 Seconds
- Secret value is automatically hidden after 60 seconds
- User gets a notification when it's hidden
- User can manually hide it anytime by clicking the eye icon again

---

## Features

✅ **Real Email OTP** - Actual emails sent via Supabase Auth  
✅ **No Demo Code** - No console logs or fake OTPs  
✅ **Works with OAuth** - Google/GitHub users can use their login email  
✅ **60-Second Auto-Hide** - Secrets automatically hide after 1 minute  
✅ **Manual Hide** - Click eye icon again to hide immediately  
✅ **No Schema Changes** - Uses Supabase Auth, no custom tables needed  
✅ **Fully Typed** - Complete TypeScript support  

---

## Supabase Email Configuration

### Step 1: Enable Email Auth
Go to **Supabase Dashboard → Authentication → Providers**
- Ensure "Email" is enabled
- Configure email templates if needed

### Step 2: Configure Email Templates (Optional)
Go to **Supabase Dashboard → Authentication → Email Templates**
- Customize the "Magic Link" template
- This is the email users will receive with the OTP

### Step 3: Test Email Delivery
- Make sure your Supabase project can send emails
- For production, configure a custom SMTP provider

---

## Testing the Feature

### 1. Go to Environment Variables Page
```
http://localhost:3000/dashboard/environment
```

### 2. Add a Test Variable
- Click "Add Variable"
- Key: `TEST_SECRET`
- Value: `my-secret-value-123`
- Environment: Production
- Click "Add Variable"

### 3. Reveal the Secret
- Click the Eye icon on the variable
- Check your email for the 6-digit OTP
- Enter the OTP in the modal
- Click "Verify & Reveal"
- Secret value is now visible

### 4. Wait 60 Seconds
- After 60 seconds, the value automatically hides
- You'll see a toast notification: "Secret value hidden"

### 5. Manual Hide
- Click the Eye icon again to hide immediately
- No OTP required to hide

---

## User Flow Diagram

```
User clicks Eye icon
    ↓
System sends OTP to user's email
    ↓
User receives email with 6-digit code
    ↓
User enters code in modal
    ↓
System verifies OTP with Supabase Auth
    ↓
If valid: Secret revealed for 60 seconds
If invalid: Error message shown
    ↓
After 60 seconds: Secret auto-hides
```

---

## Security Features

1. **Real Email Verification** - OTP sent to verified email address
2. **60-Second Expiry** - OTP expires quickly
3. **One-Time Use** - Each OTP can only be used once
4. **Auto-Hide** - Secrets don't stay revealed indefinitely
5. **No Console Logs** - No OTP codes in browser console
6. **No Custom Tables** - Uses Supabase Auth (more secure)

---

## Code Changes Summary

### Removed:
- ❌ `app/dashboard/actions/otp.ts` (no longer needed)
- ❌ `password_view_otps` table usage (not needed)
- ❌ Demo OTP console logs
- ❌ Custom OTP generation/verification

### Added:
- ✅ `supabase.auth.signInWithOtp()` for sending OTP
- ✅ `supabase.auth.verifyOtp()` for verification
- ✅ 60-second auto-hide timer
- ✅ User email fetching from session
- ✅ Professional OTP modal with email display

---

## Troubleshooting

### Issue: Not receiving OTP emails
**Solution:**
1. Check Supabase email settings
2. Check spam folder
3. Verify email provider is configured
4. For local dev, check Supabase logs

### Issue: OTP verification fails
**Solution:**
1. Make sure you're entering the correct 6-digit code
2. Check if OTP expired (60 seconds)
3. Request a new OTP

### Issue: Works for email users but not OAuth users
**Solution:**
- OAuth users (Google/GitHub) use their OAuth email
- Make sure the OAuth provider returns an email
- Check user email in Supabase Auth dashboard

### Issue: Secret doesn't auto-hide after 60 seconds
**Solution:**
- Check browser console for errors
- Make sure you didn't navigate away from the page
- Timer is cleared on page unmount

---

## Production Checklist

- [ ] Configure custom SMTP provider in Supabase
- [ ] Customize email templates
- [ ] Test with real email addresses
- [ ] Test with OAuth users (Google/GitHub)
- [ ] Verify auto-hide timer works
- [ ] Test manual hide functionality
- [ ] Check email deliverability
- [ ] Monitor Supabase Auth logs

---

## Email Template Example

Subject: **Your verification code**

Body:
```
Your verification code is: 123456

This code will expire in 60 seconds.

If you didn't request this code, please ignore this email.
```

---

## Next Steps

1. ✅ Code is already updated
2. ✅ No database migration needed
3. ✅ No dependencies to install
4. 🚀 Just restart your dev server and test!

```bash
npm run dev
```

Enjoy secure, real email OTP verification! 🎉
