"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Github, Rocket, Shield, Zap, CheckCircle, ArrowRight, X } from "lucide-react";

interface OnboardingFlowProps {
  open: boolean;
  onComplete: () => void;
}

const slides = [
  {
    id: 0,
    icon: Rocket,
    iconColor: "from-violet-500 to-indigo-500",
    title: "Welcome to Pipeline XR",
    subtitle: "Your intelligent deployment platform",
    description:
      "Ship faster, fail smarter. Pipeline XR connects your GitHub repos to production with AI-powered failure analysis — so you always know exactly what went wrong and how to fix it.",
    visual: "rocket",
  },
  {
    id: 1,
    icon: Github,
    iconColor: "from-gray-700 to-gray-900 dark:from-gray-300 dark:to-gray-100",
    title: "Connect Your GitHub",
    subtitle: "One-click repo import",
    description:
      "Sign in with GitHub and instantly browse all your repositories. Select a repo, pick your branch, and Pipeline XR handles the rest — clone, build, deploy.",
    visual: "github",
  },
  {
    id: 2,
    icon: Shield,
    iconColor: "from-emerald-500 to-teal-500",
    title: "Secure Environment Variables",
    subtitle: "OTP-protected secrets",
    description:
      "Add your API keys, database URLs, and secrets. Every time you view or edit a sensitive value, we send a verification code to your email — your secrets stay secret.",
    visual: "env",
  },
  {
    id: 3,
    icon: Zap,
    iconColor: "from-amber-500 to-orange-500",
    title: "Real Deployments. Real Logs.",
    subtitle: "Watch your app go live",
    description:
      "One click triggers a full Vercel deployment. Watch live logs stream in real time. If something breaks, our AI reads every log line and tells you exactly what to fix.",
    visual: "deploy",
  },
  {
    id: 4,
    icon: CheckCircle,
    iconColor: "from-green-500 to-emerald-500",
    title: "AI Fixes Your Failures",
    subtitle: "Your senior dev on demand",
    description:
      "Failed build? Our AI analyzes the error, identifies the exact file and line, explains it in plain English, and gives you the replacement code. You review, apply, redeploy.",
    visual: "ai",
  },
];

const VisualMockup = ({ type }: { type: string }) => {
  if (type === "rocket") {
    return (
      <div className="relative w-full h-48 rounded-xl bg-gradient-to-br from-violet-950 to-indigo-950 border border-violet-800/40 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
        <div className="text-center">
          <div className="text-6xl mb-2">🚀</div>
          <div className="text-violet-300 font-mono text-sm">pipeline-xr deploy --prod</div>
          <div className="text-green-400 font-mono text-xs mt-1">✓ Deployed in 23s</div>
        </div>
      </div>
    );
  }
  if (type === "github") {
    return (
      <div className="w-full h-48 rounded-xl bg-gradient-to-br from-gray-950 to-gray-900 border border-gray-700/40 overflow-hidden p-4 space-y-2">
        {["my-next-app", "investment-tracker", "pipeline-xr-dashboard"].map((repo, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Github className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-200 font-medium">{repo}</span>
            </div>
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">TypeScript</span>
          </div>
        ))}
      </div>
    );
  }
  if (type === "env") {
    return (
      <div className="w-full h-48 rounded-xl bg-gradient-to-br from-emerald-950 to-teal-950 border border-emerald-800/40 overflow-hidden p-4 space-y-2">
        {[
          { key: "NEXT_PUBLIC_API_URL", value: "https://api.ex..." },
          { key: "DATABASE_URL", value: "postgresql://••••••" },
          { key: "OPENAI_API_KEY", value: "sk-••••••••••••" },
        ].map((env, i) => (
          <div key={i} className="flex items-center justify-between bg-emerald-900/40 rounded-lg px-3 py-2 border border-emerald-800/20">
            <span className="text-xs font-mono text-emerald-300">{env.key}</span>
            <span className="text-xs font-mono text-gray-400">{env.value}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-emerald-400 text-xs">
          <Shield className="w-3 h-3" />
          OTP verification required to view
        </div>
      </div>
    );
  }
  if (type === "deploy") {
    return (
      <div className="w-full h-48 rounded-xl bg-gray-950 border border-gray-800/40 overflow-hidden p-3 font-mono">
        <div className="text-gray-500 text-xs mb-2">▶ Build Log</div>
        {[
          { text: "Cloning repository...", color: "text-gray-400" },
          { text: "Installing dependencies...", color: "text-gray-400" },
          { text: "✓ npm install (12s)", color: "text-green-400" },
          { text: "Running build...", color: "text-blue-400" },
          { text: "✓ Build successful", color: "text-green-400" },
          { text: "🚀 Deployed to production", color: "text-violet-400" },
        ].map((line, i) => (
          <div key={i} className={`text-xs ${line.color} leading-6`}>
            {line.text}
          </div>
        ))}
      </div>
    );
  }
  // ai
  return (
    <div className="w-full h-48 rounded-xl bg-gradient-to-br from-gray-950 to-gray-900 border border-gray-700/40 overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
        <div className="space-y-1.5 text-sm">
          <p className="text-gray-200 font-medium">Build failed in <code className="text-red-400 text-xs bg-red-950/40 px-1 rounded">lib/utils.ts</code></p>
          <p className="text-gray-400 text-xs">Cannot find module <code className="text-amber-400">@/hooks/useAuth</code>. The import path is incorrect — the file is at <code className="text-green-400">hooks/useAuth</code>.</p>
          <div className="mt-2 bg-gray-800/60 rounded p-2 text-xs font-mono">
            <span className="text-red-400">- import from '@/hooks/useAuth'</span><br />
            <span className="text-green-400">+ import from '../../hooks/useAuth'</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export function OnboardingFlow({ open, onComplete }: OnboardingFlowProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide((p) => p + 1);
    } else {
      onComplete();
    }
  };

  const goPrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((p) => p - 1);
    }
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;
  const isLast = currentSlide === slides.length - 1;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Skip button */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress dots */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="p-8 pt-12">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-5"
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${slide.iconColor} flex items-center justify-center shadow-lg`}>
                <Icon className="w-7 h-7 text-white" />
              </div>

              {/* Text */}
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">{slide.subtitle}</p>
                <h2 className="text-2xl font-bold text-foreground mb-2">{slide.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{slide.description}</p>
              </div>

              {/* Visual */}
              <VisualMockup type={slide.visual} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={currentSlide === 0}
            className="text-muted-foreground"
          >
            Back
          </Button>

          <Button onClick={goNext} className="gap-2">
            {isLast ? "Get Started" : "Next"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
