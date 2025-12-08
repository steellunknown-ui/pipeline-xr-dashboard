# Database Setup Instructions

## Step 1: Run SQL Schema in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `supabase-schema.sql`
6. Click **Run** to execute the SQL

This will create:
- `projects` table with RLS policies
- `deployments` table with RLS policies
- `environment_variables` table with RLS policies
- `activity_logs` table with RLS policies
- All necessary indexes for performance

## Step 2: Verify Tables

1. Go to **Table Editor** in Supabase Dashboard
2. Verify all 4 tables are created:
   - projects
   - deployments
   - environment_variables
   - activity_logs

## Step 3: Verify RLS is Enabled

1. In **Table Editor**, click on each table
2. Click **RLS** tab
3. Ensure RLS is enabled and policies are active

## Step 4: Test the Actions

All server actions are ready to use:

```typescript
import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
  createDeployment,
  getDeployments,
  addEnvVariable,
  getEnvVariables,
  createActivityLog,
  getActivityLogs,
} from "@/app/dashboard/actions";
```

## Features

✅ Server-side Supabase client with SSR support
✅ Zod validation on all inputs
✅ RLS policies enforce user isolation
✅ Automatic user_id insertion from auth session
✅ Proper error handling with try/catch
✅ Strongly typed responses
✅ Activity logging for audit trail
