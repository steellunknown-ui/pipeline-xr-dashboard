# Supabase OTP Configuration - 6-Digit Code Setup

## ⚠️ IMPORTANT: Configure Supabase to Send OTP Codes (Not Magic Links)

By default, Supabase sends magic links. You need to configure it to send 6-digit OTP codes instead.

---

## Step 1: Disable Magic Links in Supabase Dashboard

### Go to Supabase Dashboard:
1. Open your project: https://supabase.com/dashboard
2. Navigate to: **Authentication → Providers**
3. Find **Email** provider
4. Click **Edit** or configure Email settings

### Disable Magic Links:
Look for these settings and configure:
- **Enable Email Confirmations**: ON (if you want email verification)
- **Secure Email Change**: ON (recommended)
- **Enable Email Magic Links**: **OFF** ← TURN THIS OFF

---

## Step 2: Configure Email Templates for OTP

### Go to Email Templates:
1. Navigate to: **Authentication → Email Templates**
2. Find **Magic Link** template
3. Edit the template to show OTP code

### Template Variables:
Supabase provides these variables:
- `{{ .Token }}` - The 6-digit OTP code
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email

### Example OTP Email Template:

**Subject:**
```
Your verification code
```

**Body (HTML):**
```html
<h2>Your Verification Code</h2>
<p>Your 6-digit verification code is:</p>
<h1 style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">{{ .Token }}</h1>
<p>This code will expire in 60 seconds.</p>
<p>If you didn't request this code, please ignore this email.</p>
```

**Body (Plain Text):**
```
Your verification code is: {{ .Token }}

This code will expire in 60 seconds.

If you didn't request this code, please ignore this email.
```

---

## Step 3: Verify Configuration

### Test the OTP Flow:
1. Restart your dev server: `npm run dev`
2. Go to: `http://localhost:3000/dashboard/environment`
3. Add a test environment variable
4. Click the Eye icon to reveal
5. Check your email - you should receive a **6-digit code**, NOT a magic link

### Expected Email:
```
Your verification code is: 123456

This code will expire in 60 seconds.
```

### NOT Expected (Magic Link):
```
Click here to sign in: https://...
```

---

## Step 4: Code Configuration (Already Done)

The code is already configured to:
- ✅ Send OTP with `emailRedirectTo: undefined` (no redirect)
- ✅ Verify OTP with `type: "email"`
- ✅ Not create new users (`shouldCreateUser: false`)
- ✅ Auto-hide after 60 seconds
- ✅ Use logged-in user's email

---

## Troubleshooting

### Issue: Still receiving magic links instead of OTP codes
**Solution:**
1. Make sure "Enable Email Magic Links" is OFF in Supabase Dashboard
2. Clear your email cache
3. Request a new OTP
4. Check email template uses `{{ .Token }}` variable

### Issue: OTP code not showing in email
**Solution:**
1. Edit email template in Supabase Dashboard
2. Add `{{ .Token }}` variable to the template
3. Save and test again

### Issue: OTP verification fails
**Solution:**
1. Make sure you're entering the exact 6-digit code
2. Check if code expired (60 seconds)
3. Request a new OTP
4. Verify email matches logged-in user

### Issue: Email not received
**Solution:**
1. Check spam folder
2. Verify email provider is configured in Supabase
3. Check Supabase logs for email delivery errors
4. For production, configure custom SMTP

---

## Production Checklist

- [ ] Disable "Enable Email Magic Links" in Supabase
- [ ] Configure email template with `{{ .Token }}`
- [ ] Test OTP delivery
- [ ] Test OTP verification
- [ ] Test with OAuth users (Google/GitHub)
- [ ] Configure custom SMTP provider
- [ ] Test email deliverability
- [ ] Monitor Supabase Auth logs

---

## Code Flow

```
User clicks Eye icon
    ↓
supabase.auth.signInWithOtp({
  email: user.email,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: undefined  ← No redirect, OTP only
  }
})
    ↓
Supabase sends 6-digit OTP to email
    ↓
User enters OTP in modal
    ↓
supabase.auth.verifyOtp({
  email: user.email,
  token: otpCode,
  type: "email"
})
    ↓
If valid: Secret revealed for 60 seconds
If invalid: Error message
```

---

## Security Notes

1. **OTP Expiry**: Codes expire in 60 seconds
2. **One-Time Use**: Each code can only be used once
3. **No Redirect**: No URL redirect, OTP only
4. **Email Verification**: User must have access to their email
5. **Auto-Hide**: Secrets auto-hide after 60 seconds

---

## Summary

### What You Need to Do:
1. ✅ Go to Supabase Dashboard → Authentication → Providers
2. ✅ Turn OFF "Enable Email Magic Links"
3. ✅ Edit email template to show `{{ .Token }}`
4. ✅ Test the OTP flow

### What's Already Done:
- ✅ Code configured to send OTP (not magic links)
- ✅ Code configured to verify OTP
- ✅ 60-second auto-hide timer
- ✅ Professional UI with email display

---

## Next Steps

1. Configure Supabase Dashboard settings (above)
2. Restart dev server: `npm run dev`
3. Test OTP flow
4. Verify you receive 6-digit codes (not links)

Done! 🎉
