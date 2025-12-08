"use client";

import { motion } from "framer-motion";

export const Spotlight = ({ className }: { className?: string }) => {
  return (
    <motion.div
      className={`pointer-events-none absolute -top-40 left-0 h-[169%] w-full opacity-0 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "radial-gradient(600px circle at 0% 0%, rgba(120, 119, 198, 0.3), transparent 40%)",
            "radial-gradient(600px circle at 100% 0%, rgba(120, 119, 198, 0.3), transparent 40%)",
            "radial-gradient(600px circle at 100% 100%, rgba(120, 119, 198, 0.3), transparent 40%)",
            "radial-gradient(600px circle at 0% 100%, rgba(120, 119, 198, 0.3), transparent 40%)",
            "radial-gradient(600px circle at 0% 0%, rgba(120, 119, 198, 0.3), transparent 40%)",
          ],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </motion.div>
  );
};
