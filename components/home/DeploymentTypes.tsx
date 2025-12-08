"use client";

import { motion } from "framer-motion";
import { Globe, Server, Box, Layers } from "lucide-react";

const deploymentTypes = [
  {
    icon: Globe,
    title: "Frontend Deployments",
    description: "Deploy React, Vue, Angular, and static sites with automatic optimization and CDN distribution.",
  },
  {
    icon: Server,
    title: "Backend Deployments",
    description: "Host Node.js, Python, Go, and Ruby APIs with auto-scaling and load balancing.",
  },
  {
    icon: Box,
    title: "Docker Deployments",
    description: "Deploy containerized applications with full Docker and Docker Compose support.",
  },
  {
    icon: Layers,
    title: "Fullstack Frameworks",
    description: "Deploy Next.js, Nuxt, SvelteKit, and other fullstack frameworks seamlessly.",
  },
];

export const DeploymentTypes = () => {
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
            Supported Deployment Types
          </motion.h2>
          <p className="text-sm text-muted-foreground md:text-base">
            Deploy any application, anywhere, with confidence
          </p>
        </div>

        <motion.div 
          className="grid gap-6 md:grid-cols-2"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {deploymentTypes.map((type, index) => (
            <motion.div
              key={type.title}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.1 }}
              whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 300 } }}
              className="group rounded-xl border bg-card p-8 shadow-sm transition-all duration-300 hover:shadow-xl"
            >
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary transition-all group-hover:from-primary group-hover:to-primary/80 group-hover:text-primary-foreground">
                <type.icon className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">
                {type.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {type.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};
