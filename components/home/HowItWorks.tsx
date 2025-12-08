"use client";

import { motion } from "framer-motion";
import { GitBranch, Settings, Activity, Brain, Rocket } from "lucide-react";

const steps = [
  {
    icon: GitBranch,
    title: "Connect Your GitHub Repository",
    description: "Link your project with a single click.",
  },
  {
    icon: Settings,
    title: "Configure Your Deployment",
    description: "Choose production, staging, or preview environments.",
  },
  {
    icon: Activity,
    title: "Watch Real-time Logs",
    description: "Monitor deployment logs live without refreshing.",
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Identify failures instantly with intelligent error detection.",
  },
  {
    icon: Rocket,
    title: "Launch Your Application",
    description: "Ship your application confidently with automated checks.",
  },
];

export const HowItWorks = () => {
  return (
    <section className="py-28">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-4xl px-6"
      >
        <div className="mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-4 text-3xl font-bold text-foreground md:text-4xl"
          >
            How Pipeline XR Works
          </motion.h2>
          <p className="text-sm text-muted-foreground md:text-base">
            From code to production in five simple steps
          </p>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 h-full w-0.5 bg-border md:left-12" />

          <div className="space-y-12">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.1 }}
                className="relative flex gap-6 md:gap-8"
              >
                {/* Icon */}
                <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg md:h-24 md:w-24">
                  <step.icon className="h-6 w-6 md:h-8 md:w-8" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-8 pt-2">
                  <div className="rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">
                        Step {index + 1}
                      </span>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
};
