# Project Settings - Quick Start

## ✅ What's Implemented

- **Project Settings Page**: `/dashboard/projects/[id]/settings`
- **Editable Fields**: Project name, Repository URL
- **GitHub Integration**: OAuth + Repository selection
- **Danger Zone**: Delete project with confirmation
- **Settings Button**: Added to each project card

---

## 🚀 Quick Setup

### 1. Configure GitHub OAuth in Supabase

**Go to:** Supabase Dashboard → Authentication → Providers → GitHub

**Enable GitHub** and add:
- Get credentials from: https://github.com/settings/developers
- Create new OAuth App
- Callback URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`

### 2. Test It

```bash
npm run dev
```

1. Go to: `http://localhost:3000/dashboard/projects`
2. Click **Settings icon** (⚙️) on any project
3. Update project name → Click Save
4. Click **Connect GitHub** → Authorize
5. Select repository → Click Connect
6. Test **Delete Project** in Danger Zone

---

## 📁 New Files

- ✅ `app/dashboard/projects/[id]/settings/page.tsx` - Settings page
- ✅ `app/dashboard/actions/projects.ts` - Added `updateProject()` and `getGitHubRepos()`
- ✅ `app/dashboard/projects/page.tsx` - Added Settings button

---

## 🔑 Features

1. **Edit Project Name** - Save button appears when changed
2. **Edit Repo URL** - Save button appears when changed
3. **Connect GitHub** - OAuth → Select repo → Auto-save
4. **Change Repository** - Re-authenticate → Select new repo
5. **Delete Project** - Confirmation dialog → Cascading delete

---

## ⚠️ Important

**GitHub OAuth Required:**
- Without GitHub OAuth configured, "Connect GitHub" won't work
- Repository selection requires GitHub authentication
- Manual repo URL editing still works without OAuth

---

## 🧪 Test Without GitHub OAuth

You can still test:
- ✅ Edit project name
- ✅ Edit repository URL manually
- ✅ Delete project
- ❌ Connect GitHub (requires OAuth setup)

---

That's it! Your Project Settings page is ready! 🎉
