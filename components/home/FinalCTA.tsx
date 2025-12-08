"use client";

import { motion } from "framer-motion";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export const FinalCTA = () => {
  return (
    <section className="relative py-28">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-4xl px-6 text-center"
      >
        <h2 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Start Deploying with Pipeline XR
        </h2>
        <p className="mb-10 text-lg text-muted-foreground md:text-xl">
          Deploy your next project with AI-powered confidence.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-all duration-300 hover:scale-105 hover:shadow-xl"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-8 py-4 text-base font-semibold text-foreground transition-all duration-300 hover:bg-muted"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </motion.div>
    </section>
  );
};
