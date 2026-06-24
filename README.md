<div align="center">
  <h1>🚀 Pipeline XR</h1>
  <p><strong>Intelligent Deployment & Platform Operations System</strong></p>
  <p>
    An advanced, highly observable, deterministic framework for project instantiation, build execution, and static artifact hosting. Built to resolve the opacity of traditional CI/CD platforms by utilizing strict deployment intelligence.
  </p>
  <br />
</div>

## 📖 Overview

Pipeline XR abstracts the severe complexities of infrastructure orchestration while providing a deeply observable, deterministic operational environment. It brings clarity and structure to modern platform engineering by enforcing deterministic deployment tracking, build runner isolation, and comprehensive deployment intelligence.

## ✨ Key Features

- **🛡️ Isolated Build Runners**: Spawns detached, strictly controlled child processes to execute build steps securely.
- **🧠 Deterministic Intelligence Philosophy**: Mathematical, state-based metrics regarding build health, environment drift, and deployment lineage without hallucination risks.
- **🔄 Smart Rollbacks & Replay**: Facilitates instant, reliable redeploy workflows derived from preserved historical states.
- **🔐 OTP-Protected Operations**: Hardened security protocols requiring One-Time Passwords for critical environment mutations.
- **📊 Real-time Log Streaming**: Streamlined and compressed build log ingestion, intelligently highlighting failures and reducing noise.
- **🔒 Deployment Freeze**: Safety mechanism to lock environments from unintended automated deployments during critical periods.

## 🏗️ System Architecture

Pipeline XR fundamentally separates operations into a **Control Plane** (Next.js UI) and an **Execution Plane** (Isolated Build Processes).

### Tech Stack

- **Frontend:** Next.js (App Router), React, TailwindCSS, shadcn/ui, Framer Motion
- **Backend:** Node.js, Next.js API Routes, Isolated `child_process` runner
- **Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **AI Integration:** `@anthropic-ai/sdk` and `openai` (Isolated to log summarization and human-readable guidance, 0 authority to mutate core state)

## 🚀 Getting Started

Follow these instructions to get a local copy up and running.

### Prerequisites

- **Node.js** v20.x (LTS recommended)
- **npm** or **yarn**
- **Supabase** Project setup with valid credentials

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
   Create a `.env.local` file at the root of the project and populate the required API keys and Supabase connection strings. (Refer to the `docs/ENVIRONMENT_VARIABLES_SETUP.md` for specific schemas).

4. **Run the build runner compiler:**
   Pipeline XR uses a custom detached runner that requires pre-compilation.
   ```bash
   npm run runner:build
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) to view the Control Plane dashboard.

## 🎯 The Deployment Lifecycle

Pipeline XR enforces a strict finite state machine sequence for all deployments:
`QUEUED ➔ CLONING ➔ BUILDING ➔ DEPLOYING ➔ COMPLETED | FAILED`

All transitions are actively monitored, and any divergence from the expected state triggers the **Operator Focus Level Engine** to instantly present raw logs and recovery actions to the developer.

## 🧠 Intelligence Engine Layers

- **Predictive Risk Engine:** Flags risky deployments based on configuration drift.
- **Memory Engine:** Tracks performance regressions over time.
- **Confidence Calibration:** Scores build likelihood of success based on identical past fingerprints.
- **Operator State Engine:** Dynamically alters the dashboard based on real-time operational urgency.

## 💡 Limitations & Future Roadmap

Currently focused heavily on static artifact hosting (e.g., React/Next.js static exports) rather than long-running Node.js daemon microservices. 

**Upcoming:**
- 🐳 Dynamic Container-based Execution (Docker integration)
- 🌐 DNS Automation Engine
- 📈 OpenTelemetry Health Monitoring integration

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Built with precision for seamless platform operations.</p>
