# Repository Validation & GitHub Integration Guide

## What Was Fixed

### 1. GitHub API Token Format
- Changed from `Bearer ${token}` to `token ${token}` (correct GitHub API format)
- Added proper error handling for 401/403 responses

### 2. Repository Validation
- Enhanced error messages for different failure scenarios
- Added `needsReauth` flag to detect token expiration
- Better handling of empty repositories and missing files

### 3. Repository Chooser
- Added full GitHub repository selector in validation page
- Fetch all accessible repos (owner + collaborator)
- One-click repository selection and update

### 4. GitHub OAuth Scopes
- Updated to request `repo read:user` scopes
- Enables access to private repositories
- Proper reconnection flow when token expires

### 5. Webhook Configuration
- Display webhook URL in validation results
- Show webhook setup instructions
- Auto-detect local environment URL

## How to Use

### Step 1: Navigate to Validation Page
```
http://localhost:3000/dashboard/validate-repo
```

### Step 2: Validate Current Repository
1. Click "Validate Repository" button for your project
2. System will check:
   - ✓ Repository exists and is accessible
   - ✓ Contains `package.json`
   - ✓ Contains `app/` or `pages/` folder
   - ✓ Contains `components/` folder

### Step 3: If Validation Fails

#### Option A: Choose from GitHub (Recommended)
1. Click "Choose Repo" button
2. System fetches all your GitHub repositories
3. Select the correct repository from dropdown
4. Click to confirm - auto-validates after selection

#### Option B: Manual Edit
1. Click "Manual Edit" button
2. Enter the correct GitHub URL
3. Click "Save"
4. Re-run validation

### Step 4: Reconnect GitHub (If Needed)
If you see "GitHub token expired" alert:
1. Click "Reconnect GitHub" button
2. Authorize with scopes: `repo read:user`
3. Return to validation page
4. Try validation again

### Step 5: Configure Webhook (For Auto-Deploy)
After successful validation:
1. Copy webhook URL from validation results
2. Go to GitHub: `Settings → Webhooks → Add webhook`
3. Paste webhook URL
4. Copy webhook secret from project settings
5. Set content type: `application/json`
6. Select events: `Push events`
7. Save webhook

## Current Repository Check

Your project is connected to:
```
https://github.com/steellunknown-ui/my-website
```

### To Verify This Repository:
1. Go to: https://github.com/steellunknown-ui/my-website
2. Check if it contains your Next.js dashboard code
3. Look for: `app/`, `components/`, `package.json`

### If Repository is Wrong:
1. Use validation page to select correct repository
2. Or manually update in project settings
3. Re-validate after changing

## Troubleshooting

### "Cannot access repository contents"
- **Cause**: Token expired or insufficient permissions
- **Fix**: Click "Reconnect GitHub" with `repo` scope

### "Repository not found"
- **Cause**: Wrong URL or no access to private repo
- **Fix**: Check URL or reconnect GitHub with proper scopes

### "Repository is empty"
- **Cause**: Repository has no files
- **Fix**: Push your Next.js code to the repository first

### "Not a Next.js Project"
- **Cause**: Missing required files/folders
- **Fix**: Ensure repository contains `app/` or `pages/` + `package.json`

## Files Modified

1. `app/dashboard/actions/github-validation.ts` - Enhanced validation with better errors
2. `app/dashboard/actions/projects.ts` - Fixed token format in getGitHubRepos
3. `app/dashboard/validate-repo/page.tsx` - Added repo chooser UI
4. `app/dashboard/projects/[id]/settings/page.tsx` - Updated OAuth scopes
5. `app/auth/callback/route.ts` - Added redirect parameter support

## Next Steps

1. ✅ Navigate to `/dashboard/validate-repo`
2. ✅ Click "Validate Repository" for your project
3. ✅ If invalid, click "Choose Repo" to select correct one
4. ✅ After validation passes, configure GitHub webhook
5. ✅ Test auto-deploy by pushing to GitHub
