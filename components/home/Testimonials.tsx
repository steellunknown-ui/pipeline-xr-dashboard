"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Frontend Developer",
    review: "Pipeline XR made deployment so simple. The AI error analysis saved me hours of debugging. Highly recommend!",
    avatar: "SC",
  },
  {
    name: "Michael Rodriguez",
    role: "Full Stack Engineer",
    review: "Real-time logs and one-click deployments are game changers. This is exactly what modern developers need.",
    avatar: "MR",
  },
  {
    name: "Emily Watson",
    role: "DevOps Engineer",
    review: "Finally, a deployment platform that's both powerful and beginner-friendly. The UI is clean and intuitive.",
    avatar: "EW",
  },
];

export const Testimonials = () => {
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
            What Developers Say
          </motion.h2>
          <p className="text-sm text-muted-foreground md:text-base">
            Trusted by developers worldwide
          </p>
        </div>

        <motion.div 
          className="grid gap-6 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.1 }}
              whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 300 } }}
              className="rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-xl"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Review */}
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                "{testimonial.review}"
              </p>

              {/* User Info */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};
