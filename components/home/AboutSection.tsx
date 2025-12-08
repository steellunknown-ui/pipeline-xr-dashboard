"use client";

import { motion } from "framer-motion";

export const AboutSection = () => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="py-28"
    >
      <div className="mx-auto max-w-6xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-4 text-3xl font-bold text-foreground md:text-4xl"
        >
          About Pipeline XR
        </motion.h2>
        <p className="mb-6 text-sm text-muted-foreground md:text-base">
          Simplifying deployment for modern developers
        </p>
        <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
          Pipeline XR is an AI-powered deployment platform designed to simplify your development workflow. 
          Monitor deployments in real-time, analyze errors instantly with AI, and ship your applications 
          with confidence. Built for developers who want powerful tools without the complexity.
        </p>
      </div>
    </motion.section>
  );
};
