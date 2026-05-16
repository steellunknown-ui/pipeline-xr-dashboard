# Supabase Auth Storage Cleanup

## One-Time Cleanup (Development Only)

If you encounter auth persistence issues during development, perform this one-time cleanup:

### Browser Storage Cleanup
1. Open browser DevTools (F12)
2. Go to Application/Storage tab
3. Clear the following:
   - Remove any `supabase.auth.token` entries
   - Remove any `sb-*` auth keys from localStorage
   - Remove any `sb-*` auth keys from sessionStorage
   - Clear all cookies for localhost

### After Cleanup
1. Hard reload the browser (Ctrl+Shift+R)
2. The app will automatically handle auth state recovery
3. Users will be logged out gracefully if auth is corrupted

## No Recurring Cleanup Required
The AuthSafetyGuard component now handles corrupted auth automatically by:
- Detecting corrupted auth on app startup
- Automatically signing out users with corrupted sessions
- Preventing crashes from malformed auth data

## Validation
After cleanup, verify:
- No `_recoverAndRefresh` errors in console
- Auth state persists after browser refresh
- OAuth (GitHub + Google) continues working
- No crashes after 24+ hours of usage