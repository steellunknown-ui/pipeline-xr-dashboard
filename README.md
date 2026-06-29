<div align="center">
  <h1>🚀 Pipeline XR</h1>
  <p><strong>The Intelligent, Autonomous, AI-Powered Deployment Platform</strong></p>
  <p>Pipeline XR is a next-generation CI/CD dashboard built to seamlessly integrate with GitHub and Vercel. What makes Pipeline XR special is its <strong>Autonomous AI Fixer Engine</strong>—when a deployment fails, the platform automatically analyzes the build logs, generates a code fix, pushes the fix to your GitHub repository, and automatically triggers a re-deployment without human intervention.</p>
</div>

---

## ✨ Features & End-to-End User Flow

Pipeline XR provides a beautiful, frictionless experience from the moment a user logs in to the moment their code is live in production.

### 1. 🔐 Secure Authentication & Onboarding
- **OAuth Integration:** Users can instantly sign in using their **GitHub** or **Google** accounts, securely powered by Supabase Auth.
- **Interactive Onboarding:** A sleek, glassmorphic onboarding carousel introduces the platform's capabilities before landing users in their unified dashboard.

### 2. 🐙 One-Click GitHub Integration
- **Repository Fetching:** Connect your GitHub account and instantly browse, search, and import your repositories directly into Pipeline XR.
- **Branch Selection:** Select specific branches for targeted deployments or staging environments.

### 3. 🛡️ Pre-Flight Checks & Environment Management
- **Smart Pre-flight:** Before deploying, the platform automatically prompts the user with a sleek modal to confirm if the project requires Environment Variables.
- **Inline Secret Management:** Add `Key/Value` pairs directly from the dashboard. Pipeline XR securely encrypts and stores them in Supabase, ready to inject into the Vercel build environment.

### 4. 🧠 The AI Fixer Engine (The Crown Jewel)
If a deployment fails, Pipeline XR doesn't just give you an error log. It acts as your autonomous Senior DevOps Engineer:
1. **Log Ingestion:** Automatically captures and analyzes the failing Vercel build logs.
2. **Multi-Model AI Diagnosis:** Routes the error trace through **OpenRouter** (utilizing top-tier LLMs) to identify the exact root cause of the build failure.
3. **Automated Code Patching:** The AI generates a perfect code fix for the broken file.
4. **Auto-Commit to GitHub:** The platform programmatically commits the fix directly to your GitHub repository branch via the GitHub API.
5. **Self-Healing Redeployment:** Instantly triggers a fresh Vercel build with the newly patched code. 
6. **Live UI Status:** The entire autonomous process is displayed to the user via beautiful, real-time sliding Toast notifications (e.g., *"🤖 AI analyzing logs..."*, *"✏️ Patching code..."*, *"🚀 Redeploying..."*).

---

## 🏗️ Architecture & Tech Stack

Pipeline XR is built with a highly scalable, modern architecture designed for performance and beautiful aesthetics.

- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Styling:** Tailwind CSS, Framer Motion (for micro-animations), Shadcn UI
- **Backend/Database:** Supabase (PostgreSQL, Row Level Security, Auth)
- **Deployment Infrastructure:** Vercel API (Programmatic Deployments)
- **AI Infrastructure:** OpenRouter API (Accessing state-of-the-art LLMs)
- **Version Control:** GitHub REST API

---

## 👨‍💻 For Developers & Recruiters

If you are looking at this repository, this project demonstrates a deep understanding of:
- **Complex System Orchestration:** Tying together third-party APIs (Vercel, GitHub, Supabase, OpenRouter) into a unified, seamless user experience.
- **Autonomous AI Agents:** Moving beyond simple "chatbots" to create AI that actively reads files, writes code, and executes git commands on behalf of the user.
- **Modern UI/UX Design:** Implementing glassmorphism, dynamic gradients, and real-time state feedback to create a premium, "wow-factor" interface.
- **Production Readiness:** Strict TypeScript adherence, clean architecture, and robust error handling.

---

## 🚀 Getting Started

To run Pipeline XR locally:

```bash
# 1. Clone the repository
git clone https://github.com/steellunknown-ui/pipeline-xr-dashboard.git

# 2. Install dependencies
npm install

# 3. Configure Environment Variables
# Copy the .env.example to .env.local and add your Supabase, Vercel, GitHub, and OpenRouter keys.

# 4. Run the development server
npm run dev
```
