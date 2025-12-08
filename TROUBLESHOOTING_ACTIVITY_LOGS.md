# Troubleshooting Activity Logs - "No activity logs yet"

## Issue
Activity logs page shows "No activity logs yet" even after performing actions.

## Root Causes & Solutions

### 1. Database Schema Not Updated
**Problem:** The `activity_logs` table still has `event_type` column instead of `event`.

**Solution:** Run the migration SQL:
```sql
-- Run this in Supabase SQL Editor
-- File: migration-activity-logs-final.sql

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE activity_logs RENAME COLUMN event_type TO event;
  END IF;
END $$;

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS event TEXT NOT NULL DEFAULT '';
ALTER TABLE activity_logs ALTER COLUMN description DROP NOT NULL;
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS deployment_id UUID REFERENCES public.deployments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON activity_logs;

CREATE POLICY "Users can view their own activity logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_deployment_id ON activity_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
```

### 2. Verify Database Schema
**Run this query to check your table structure:**
```sql
-- File: test-activity-logs.sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_logs'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` (uuid)
- `user_id` (uuid)
- `event` (text) ← Must be "event", NOT "event_type"
- `description` (text, nullable)
- `project_id` (uuid, nullable)
- `deployment_id` (uuid, nullable)
- `metadata` (jsonb)
- `created_at` (timestamp)

### 3. Test Manual Insert
**Create a test log to verify everything works:**

1. Go to your dashboard
2. Open browser console
3. Run this in your app (or create a test button):

```typescript
import { testActivityLog } from "@/app/dashboard/actions/test-activity-log";

// Call this function
const result = await testActivityLog();
console.log(result);
```

### 4. Check RLS Policies
**Verify RLS policies exist:**
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'activity_logs';
```

**Expected policies:**
- "Users can view their own activity logs" (SELECT)
- "Users can insert their own activity logs" (INSERT)

### 5. Verify User Authentication
**Check if user is authenticated:**
```typescript
// In browser console on dashboard page
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
console.log("User ID:", user?.id);
```

### 6. Test Activity Log Creation
**Try creating a project and check for errors:**

1. Create a new project
2. Open browser console
3. Check for any errors
4. Run this SQL to see if log was created:

```sql
SELECT * FROM activity_logs 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 7. Common Errors

**Error: "column 'event' does not exist"**
- Solution: Run the migration SQL to rename `event_type` to `event`

**Error: "null value in column 'event' violates not-null constraint"**
- Solution: Ensure all `createActivityLog()` calls include the `event` parameter

**Error: "new row violates row-level security policy"**
- Solution: Check RLS policies and ensure `auth.uid() = user_id`

**No errors but no logs appear:**
- Check if `getActivityLogs()` is querying the correct user_id
- Verify the frontend is using `log.event` not `log.event_type`

## Quick Verification Checklist

- [ ] Migration SQL executed successfully
- [ ] `event` column exists (not `event_type`)
- [ ] `description` column is nullable
- [ ] `project_id`, `deployment_id`, `metadata` columns exist
- [ ] RLS policies exist for SELECT and INSERT
- [ ] User is authenticated (check browser console)
- [ ] Frontend uses `log.event` not `log.event_type`
- [ ] Test log creation works
- [ ] Create a project and verify log appears

## Files Updated
- ✅ `lib/types/database.ts` - ActivityLog interface
- ✅ `app/dashboard/actions/activity.ts` - createActivityLog function
- ✅ `app/dashboard/actions/projects.ts` - Project actions
- ✅ `app/dashboard/actions/deployments.ts` - Deployment actions
- ✅ `app/dashboard/actions/environment.ts` - Environment actions
- ✅ `app/dashboard/activity/page.tsx` - Activity page (uses log.event)
- ✅ `app/dashboard/logs/page.tsx` - Logs page (uses log.event)

## Next Steps

1. **Run migration SQL** in Supabase SQL Editor
2. **Verify schema** using test-activity-logs.sql
3. **Test manual insert** using testActivityLog()
4. **Create a project** and check if log appears
5. **Check browser console** for any errors
6. **Refresh the activity logs page**

If logs still don't appear after all steps, check Supabase logs for any database errors.
