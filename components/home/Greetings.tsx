"use client";

import { motion } from "framer-motion";

export const Greetings = () => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative py-12 text-center"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="text-4xl font-bold tracking-tight text-foreground">
          Build. Deploy. Scale. With Pipeline XR.
        </h2>
        <p className="mt-3 text-lg text-foreground opacity-70">
          Your all-in-one AI-powered deployment workflow.
        </p>
      </div>
    </motion.section>
  );
};
