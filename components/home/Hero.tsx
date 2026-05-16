"use client";

import { motion } from "framer-motion";
import { Spotlight } from "@/components/ui/spotlight";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { supabase } from "@/lib/supabase-browser";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";

export const Hero = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
    });
  }, []);

  const handleDashboardClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setShowAuthModal(true);
    }
  };

  return (
    <div id="hero-section" className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02]">
      {/* Hero Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,120,255,0.15),transparent)] blur-3xl" />
      <Spotlight className="left-0 top-0 md:left-60 md:-top-20" />
      
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm"
          >
            ✨ AI-Powered Deployment Platform
          </motion.div>

          {/* Title */}
          <h1 className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-6xl font-bold tracking-tight text-transparent md:text-8xl">
            Pipeline XR
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-2xl text-lg text-white/60 md:text-xl">
            AI-powered deployment platform for everyone. Ship faster, monitor smarter, and scale effortlessly.
          </p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row"
          >
            <Link
              href="/dashboard"
              onClick={handleDashboardClick}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-base font-semibold text-black transition-all hover:scale-105 hover:shadow-xl hover:shadow-white/20"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            
            <Link
              href="/dashboard"
              onClick={handleDashboardClick}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </motion.div>

          <AuthRequiredModal open={showAuthModal} onOpenChange={setShowAuthModal} redirectTo="/dashboard" />

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-8 pt-12 text-sm text-white/40"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>99.9% Uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span>Real-time Monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span>AI-Powered Analysis</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
};
