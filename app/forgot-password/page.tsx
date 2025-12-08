"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Spotlight } from "@/components/ui/spotlight";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send OTP");
        setLoading(false);
        return;
      }

      // Redirect to OTP entry page
      window.location.href = `/enter-otp?email=${encodeURIComponent(email)}`;
    } catch (err) {
      setError("Something went wrong");
      setLoading(false);
    }
  };
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black/[0.96] antialiased">
      <Spotlight className="left-0 top-0 md:left-60 md:-top-20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,120,255,0.15),transparent)] blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo & Title */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-white">Pipeline XR</h1>
            <p className="text-sm text-white/60">Reset your password</p>
          </div>

          <p className="mb-6 text-center text-sm text-white/70">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}



          {/* Form */}
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          {/* Back to Login */}
          <p className="mt-6 text-center text-sm text-white/60">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-white transition-colors hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
