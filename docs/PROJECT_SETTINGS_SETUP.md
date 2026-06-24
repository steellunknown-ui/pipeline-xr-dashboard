# Project Settings Page - Complete Setup Guide

## Overview
Professional Vercel-style Project Settings page with:
- ✅ Editable project name and repository URL
- ✅ GitHub OAuth integration for repository selection
- ✅ Automatic repository fetching from GitHub API
- ✅ Change/Reconnect repository functionality
- ✅ Danger Zone with project deletion
- ✅ Cascading delete (deployments, env vars, activity logs)

---

## Features Implemented

### 1. General Settings
- **Project Name**: Editable with Save button
- **GitHub Repository URL**: Editable with Save button
- **Created Date**: Display only
- **Last Updated**: Display only

### 2. GitHub Integration
- **Connect GitHub**: OAuth authentication with GitHub
- **Fetch Repositories**: Automatically fetches user's repos using GitHub API
- **Select Repository**: Dropdown to choose from user's repositories
- **Repository Details**: Shows repo URL and default branch
- **Change Repository**: Re-authenticate and select new repo
- **Reconnect**: Refresh GitHub connection

### 3. Danger Zone
- **Delete Project**: Permanent deletion with confirmation
- **Cascading Delete**: Removes all associated data:
  - All deployments
  - All environment variables
  - All activity logs

---

## How It Works

### GitHub OAuth Flow

```
User clicks "Connect GitHub"
    ↓
Supabase OAuth with GitHub (scope: repo)
    ↓
User authorizes in GitHub
    ↓
Redirects back with provider_token
    ↓
Fetch repos using GitHub API
    ↓
Display repos in dropdown
    ↓
User selects repo
    ↓
Save repo URL to projects table
```

### GitHub API Integration

```javascript
// Get user's repositories
const response = await fetch(
  "https://api.github.com/user/repos?per_page=100&sort=updated",
  {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  }
);
```

---

## Setup Instructions

### Step 1: Configure GitHub OAuth in Supabase

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Enable **GitHub** provider
3. Add your GitHub OAuth credentials:
   - Client ID
   - Client Secret
4. Add redirect URL: `http://localhost:3000/auth/callback`

### Step 2: Get GitHub OAuth Credentials

1. Go to: https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - Application name: `Pipeline XR`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
4. Copy **Client ID** and **Client Secret**
5. Paste them in Supabase Dashboard

### Step 3: Test the Flow

```bash
npm run dev
```

1. Go to: `http://localhost:3000/dashboard/projects`
2. Click Settings icon on any project
3. Click "Connect GitHub"
4. Authorize in GitHub
5. Select a repository
6. Click "Connect Repository"

---

## File Structure

```
app/dashboard/
├── projects/
│   ├── page.tsx                           # Projects list (updated with Settings button)
│   └── [id]/
│       └── settings/
│           └── page.tsx                   # NEW: Project Settings page
├── actions/
│   └── projects.ts                        # Updated with new actions

New Server Actions:
- updateProject(id, data)                  # Update project fields
- getGitHubRepos()                         # Fetch user's GitHub repos
```

---

## Server Actions

### 1. updateProject
```typescript
await updateProject(projectId, {
  name: "New Name",
  github_repo_url: "https://github.com/user/repo"
});
```

### 2. getGitHubRepos
```typescript
const result = await getGitHubRepos();
// Returns: { success: true, data: [...repos] }
```

### 3. deleteProject
```typescript
await deleteProject(projectId);
// Cascades to deployments, env_vars, activity_logs
```

---

## UI Components Used

- ✅ Card, CardHeader, CardTitle, CardDescription, CardContent
- ✅ Button (Save, Delete, Connect)
- ✅ Input (Project name, Repo URL)
- ✅ Label
- ✅ Select, SelectTrigger, SelectValue, SelectContent, SelectItem
- ✅ AlertDialog (Delete confirmation)
- ✅ Separator (Section dividers)
- ✅ Skeleton (Loading states)
- ✅ Icons: ArrowLeft, Github, Save, Trash2, RefreshCw

---

## Security Features

1. **Authentication**: All actions require authenticated user
2. **Authorization**: Users can only access their own projects
3. **RLS**: Row Level Security enforced on all tables
4. **OAuth Scopes**: GitHub OAuth requests only `repo` scope
5. **Token Security**: Provider token stored securely in session
6. **Cascading Delete**: Proper cleanup of all related data

---

## GitHub API Endpoints Used

### Get User Repositories
```
GET https://api.github.com/user/repos
Query params:
  - per_page: 100
  - sort: updated
Headers:
  - Authorization: Bearer {token}
  - Accept: application/vnd.github.v3+json
```

### Response Format
```json
[
  {
    "id": 123456,
    "name": "my-repo",
    "full_name": "username/my-repo",
    "html_url": "https://github.com/username/my-repo",
    "default_branch": "main",
    "owner": {
      "login": "username"
    }
  }
]
```

---

## Testing Checklist

- [ ] Navigate to project settings page
- [ ] Update project name and save
- [ ] Update repository URL and save
- [ ] Click "Connect GitHub"
- [ ] Authorize in GitHub
- [ ] See list of repositories
- [ ] Select a repository
- [ ] Click "Connect Repository"
- [ ] Verify repo URL updated
- [ ] Click "Change Repository"
- [ ] Select different repo
- [ ] Verify repo changed
- [ ] Click "Delete Project"
- [ ] Confirm deletion
- [ ] Verify project deleted
- [ ] Verify deployments deleted
- [ ] Verify env vars deleted
- [ ] Verify activity logs deleted

---

## Troubleshooting

### Issue: "GitHub not connected" error
**Solution:**
1. Make sure GitHub OAuth is enabled in Supabase
2. User must authenticate with GitHub first
3. Check if `provider_token` exists in session

### Issue: No repositories showing
**Solution:**
1. Check GitHub OAuth scope includes `repo`
2. Verify GitHub token is valid
3. Check browser console for API errors
4. Verify user has repositories in GitHub

### Issue: Repository selection not saving
**Solution:**
1. Check `updateProject` server action
2. Verify project ID is correct
3. Check Supabase logs for errors
4. Ensure user owns the project

### Issue: Delete not working
**Solution:**
1. Check if cascading delete is set up in database
2. Verify foreign key constraints
3. Check RLS policies
4. Look for errors in browser console

---

## Database Schema (No Changes Required)

The existing schema already supports all features:

```sql
-- projects table (existing)
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  github_repo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cascading deletes already configured via foreign keys
```

---

## Next Steps

1. ✅ Code is already implemented
2. ✅ Configure GitHub OAuth in Supabase
3. ✅ Get GitHub OAuth credentials
4. ✅ Add credentials to Supabase
5. 🚀 Test the complete flow

---

## Production Checklist

- [ ] Configure GitHub OAuth for production domain
- [ ] Update redirect URLs for production
- [ ] Test with multiple users
- [ ] Test with users who have many repos
- [ ] Test delete functionality thoroughly
- [ ] Monitor GitHub API rate limits
- [ ] Add error logging
- [ ] Add analytics tracking

---

Enjoy your professional Project Settings page! 🎉
