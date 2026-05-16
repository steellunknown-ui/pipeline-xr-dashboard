"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { DevOpsAssistantWindow } from "./DevOpsAssistantWindow";

export function FloatingDevOpsBot() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="group relative h-16 w-16 rounded-full bg-gradient-to-br from-zinc-900 via-black to-zinc-800 dark:from-zinc-900 dark:via-black dark:to-zinc-800 shadow-2xl transition-all duration-300 hover:scale-105 animate-float border border-zinc-700/50 dark:border-zinc-700/50"
        >
          {/* Platinum glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 dark:from-zinc-300 dark:to-zinc-500 opacity-40 blur-xl group-hover:opacity-60 group-hover:animate-pulse transition-opacity" />
          
          {/* AI Logo */}
          <div className="relative flex h-full w-full items-center justify-center">
            <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" rx="3" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="2" />
              <path d="M8 12H16M12 8V16" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="8" cy="8" r="1.5" className="fill-zinc-800 dark:fill-white" />
              <circle cx="16" cy="8" r="1.5" className="fill-zinc-800 dark:fill-white" />
              <circle cx="12" cy="16" r="1.5" className="fill-zinc-800 dark:fill-white" />
              <path d="M12 2V4M12 20V22M2 12H4M20 12H22" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </button>
        
        {/* Label */}
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 animate-fade-in">
          Ask XR DevOps AI
        </span>
      </div>

      <DevOpsAssistantWindow open={open} onOpenChange={setOpen} />

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-in;
        }
      `}</style>
    </>
  );
}
