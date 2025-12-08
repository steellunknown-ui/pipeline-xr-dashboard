"use client";

import { motion } from "framer-motion";
import { Brain, Activity, Zap, BarChart3, Layers, GraduationCap } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Identify deployment failures instantly with real-time AI-powered analysis.",
  },
  {
    icon: Activity,
    title: "Real-time Log Streaming",
    description: "Live logs update instantly without refreshing the page.",
  },
  {
    icon: Zap,
    title: "One-click Deployments",
    description: "Deploy your GitHub projects in seconds with one click.",
  },
  {
    icon: BarChart3,
    title: "Smart Monitoring",
    description: "Track CPU, memory, and application health with real-time metrics.",
  },
  {
    icon: Layers,
    title: "Multi-Environment Support",
    description: "Deploy to production, staging, and preview environments effortlessly.",
  },
  {
    icon: GraduationCap,
    title: "Beginner-Friendly Tools",
    description: "Designed to help new developers deploy and debug without DevOps experience.",
  },
];

export const FeaturesGrid = () => {
  return (
    <section className="relative py-28">
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
            Powerful Features
          </motion.h2>
          <p className="text-sm text-muted-foreground md:text-base">
            Built for speed, reliability, and developer experience
          </p>
        </div>
        
        <motion.div 
          className="grid gap-6 md:grid-cols-3"
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
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary transition-all group-hover:from-primary group-hover:to-primary/80 group-hover:text-primary-foreground">
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};
