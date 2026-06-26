<div align="center">
  <h1>🚀 Pipeline XR</h1>
  <p><strong>The AI-Powered Deployment Platform for Frontend Developers</strong></p>
  <p>
    Pipeline XR is a modern, Vercel-like deployment platform that doesn't just host your code—it actively helps you fix it when it breaks. Built for developers who want seamless deployments with built-in AI failure recovery.
  </p>
  <br />
</div>

## 📖 Overview

Pipeline XR simplifies infrastructure and CI/CD pipelines while providing deep, AI-driven observability. When your build fails on traditional platforms, you're left staring at hundreds of lines of obscure logs. Pipeline XR intercepts those failures, reads the logs using advanced large language models (LLMs), and instantly tells you exactly what went wrong and how to fix it.

**Target Audience:** Frontend Developers, Full-stack Engineers, and DevOps teams who want zero-configuration deployments backed by intelligent debugging.

## ✨ Key Features

- **🔗 GitHub Integration**: Connect your repositories and deploy with a single click.
- **⚡ Vercel-Style Wizard**: Automatic framework detection and zero-config environment variable injection.
- **📊 Real-time Log Streaming**: Watch your builds execute in real-time via Server-Sent Events (SSE).
- **🤖 AI Failure Analysis**: Powered by **Nemotron 3 Super (120B)**, Pipeline XR ingests your entire failed build log to identify the exact root cause of a failure.
- **🛠️ AI Fix Suggester**: Powered by **Poolside Laguna M.1**, Pipeline XR automatically generates surgical code patches to fix your broken deployments.
- **💬 DevOps XR Assistant**: An integrated chat interface powered by **gpt-oss-20b** to help you understand CI/CD concepts and debug issues on the fly.
- **⏪ One-Click Rollbacks**: Instantly revert to any previously successful deployment.

## 🏗️ System Architecture

Pipeline XR separates operations into a **Control Plane** (the Next.js dashboard) and an **Execution Plane** (isolated Node.js child processes for building).

### Tech Stack

- **Frontend:** Next.js 16 (App Router / Turbopack), React, TailwindCSS, shadcn/ui, Framer Motion
- **Backend:** Node.js, Next.js API Routes, Isolated `child_process` runner
- **Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **AI Integration:** OpenRouter Multi-Key Pool (Dedicated API keys to prevent rate limits)

## 🚀 Getting Started

Follow these instructions to get a local instance of Pipeline XR up and running.

### Prerequisites

- **Node.js** v20.x or higher
- **npm** or **yarn**
- **Supabase** Project setup with valid credentials
- **OpenRouter** Account with API keys

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/steellunknown-ui/pipeline-xr-dashboard.git
   cd pipeline-xr-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file at the root of the project. You will need Supabase keys and OpenRouter API keys (Chat, Analyze, and Fix keys).
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

   OPENROUTER_CHAT_KEY=your_gpt_oss_key
   OPENROUTER_ANALYZE_KEY=your_nemotron_key
   OPENROUTER_FIX_KEY=your_laguna_key
   ```

4. **Run the build runner compiler:**
   Pipeline XR uses a custom detached runner that requires pre-compilation.
   ```bash
   npm run runner:build
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 🎯 The Deployment Lifecycle

Pipeline XR enforces a strict finite state machine sequence for all deployments:
`QUEUED ➔ CLONING ➔ BUILDING ➔ DEPLOYING ➔ COMPLETED | FAILED`

If the deployment hits the `FAILED` state, the **AI Failure Analyzer** automatically kicks in to diagnose the logs.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Built with precision for seamless platform operations.</p>
