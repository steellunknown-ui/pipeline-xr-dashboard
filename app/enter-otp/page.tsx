"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Spotlight } from "@/components/ui/spotlight";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function EnterOtpPage() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  useEffect(() => {
    if (!email) {
      router.push("/forgot-password");
    }
  }, [email, router]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid OTP");
        setLoading(false);
        return;
      }

      router.push(`/new-password?email=${email}`);
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
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-white">Pipeline XR</h1>
            <p className="text-sm text-white/60">Enter OTP</p>
          </div>

          <p className="mb-6 text-center text-sm text-white/70">
            We've sent a 6-digit code to {email}
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                OTP Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl tracking-widest text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/60">
            <Link href="/forgot-password" className="font-semibold text-white transition-colors hover:underline">
              Back to Forgot Password
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
