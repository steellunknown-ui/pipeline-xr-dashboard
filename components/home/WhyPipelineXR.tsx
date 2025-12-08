"use client";

import { motion } from "framer-motion";
import { Brain, Activity, Smile, Zap } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Error Analyzer",
    description: "Intelligent error detection and analysis powered by AI to help you fix issues faster.",
  },
  {
    icon: Activity,
    title: "Real-time Logs",
    description: "Monitor your deployments with live log streaming and instant status updates.",
  },
  {
    icon: Smile,
    title: "Beginner Friendly",
    description: "Simple, intuitive interface designed for developers of all skill levels.",
  },
  {
    icon: Zap,
    title: "One-click Deployments",
    description: "Deploy your applications instantly with seamless GitHub integration.",
  },
];

export const WhyPipelineXR = () => {
  return (
    <section className="py-28">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-6xl px-6"
      >
        <div className="mb-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-4 text-3xl font-bold text-foreground md:text-4xl"
          >
            Why Pipeline XR?
          </motion.h2>
          <p className="text-sm text-muted-foreground md:text-base">
            Everything you need to deploy with confidence
          </p>
        </div>
        
        <motion.div 
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.1 }}
              whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 300 } }}
              className="group rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-xl"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};
