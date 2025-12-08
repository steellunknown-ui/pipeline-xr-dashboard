# Webhook URL Update Instructions

## Step 1: Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Add webhook_url column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Create index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_projects_webhook_url ON projects(webhook_url);

-- Update existing project with ngrok URL
UPDATE projects 
SET webhook_url = 'https://dupable-preferredly-giovani.ngrok-free.dev/api/github/webhook'
WHERE user_id = 'd17bc26a-cd6f-4817-802a-6ae5bf5b676b';
```

## Step 2: Verify Changes

The UI has been updated with:

1. ✅ **Editable Webhook URL field** - No longer read-only
2. ✅ **Save button** - Appears next to the webhook URL input
3. ✅ **Copy button** - Still available to copy the URL
4. ✅ **Server action** - `updateProjectWebhookUrl()` added to save changes
5. ✅ **Activity logging** - Logs webhook URL updates
6. ✅ **Database type** - Updated Project type with `webhook_url` field

## Step 3: Use the Feature

After running the migration:

1. Navigate to `/dashboard/projects/[id]/settings`
2. Scroll to "Auto-Deploy" section
3. Edit the "Webhook URL" field
4. Enter: `https://dupable-preferredly-giovani.ngrok-free.dev/api/github/webhook`
5. Click "Save" button
6. URL will be saved to database
7. Webhook secret remains unchanged

## Files Modified

1. `lib/types/database.ts` - Added `webhook_url` to Project type
2. `app/dashboard/actions/projects.ts` - Added `updateProjectWebhookUrl()` action
3. `app/dashboard/projects/[id]/settings/page.tsx` - Made webhook URL editable with save button
4. `migration-webhook-url.sql` - Database migration file

## Default Behavior

- If no webhook URL is set, defaults to: `${window.location.origin}/api/github/webhook`
- Can be overridden with any custom URL (e.g., ngrok URL for local dev)
- Webhook secret is preserved and not affected by URL changes

## Testing

1. Update webhook URL in settings
2. Click Save
3. Refresh page - should show new URL
4. Check activity logs - should show "webhook_url_updated" event
5. Test GitHub webhook with new URL
