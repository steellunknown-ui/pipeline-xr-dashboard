# Quick Setup - 6-Digit OTP (Not Magic Links)

## 🚨 Required: Configure Supabase Dashboard

### 1. Disable Magic Links
Go to: **Supabase Dashboard → Authentication → Providers → Email**

Turn OFF: **"Enable Email Magic Links"**

### 2. Update Email Template
Go to: **Supabase Dashboard → Authentication → Email Templates → Magic Link**

Change body to:
```
Your verification code is: {{ .Token }}

This code will expire in 60 seconds.
```

### 3. Test
```bash
npm run dev
```

Go to: `http://localhost:3000/dashboard/environment`

Click Eye icon → Check email for **6-digit code** (not a link)

---

## ✅ Code Already Configured

The code is already set up to:
- Send OTP with no redirect
- Verify 6-digit codes
- Auto-hide after 60 seconds
- Work with OAuth users

---

## 📧 Expected Email

**Good (OTP Code):**
```
Your verification code is: 123456
```

**Bad (Magic Link):**
```
Click here to sign in: https://...
```

---

## 🔧 If Still Getting Magic Links

1. Make sure "Enable Email Magic Links" is OFF
2. Clear email cache
3. Request new OTP
4. Check email template uses `{{ .Token }}`

---

That's it! 🎉
