"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { HomeAssistantWindow } from "./HomeAssistantWindow";

export function FloatingHomeBot() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="group relative h-16 w-16 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-900 shadow-2xl transition-all duration-300 hover:scale-105 animate-float border border-zinc-600/50 dark:border-zinc-600/50"
        >
          {/* Silver glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-600 dark:from-zinc-400 dark:to-zinc-600 opacity-30 blur-xl group-hover:opacity-50 transition-opacity" />
          
          {/* AI Logo */}
          <div className="relative flex h-full w-full items-center justify-center">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" className="fill-zinc-400 dark:fill-zinc-500" />
              <path d="M2 17L12 22L22 17" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="2" className="fill-zinc-800 dark:fill-white" />
            </svg>
          </div>
        </button>
        
        {/* Label */}
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 animate-fade-in">
          Ask PipelineBot
        </span>
      </div>

      <HomeAssistantWindow open={open} onOpenChange={setOpen} />

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
