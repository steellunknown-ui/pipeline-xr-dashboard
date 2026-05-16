"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export default function SecuritySection() {
  
  const [showSection, setShowSection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const checkProvider = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.app_metadata?.provider === "email") {
        setShowSection(true);
      }
    };
    checkProvider();
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setShowPassword(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleEyeClick = async () => {
    if (showPassword) {
      setShowPassword(false);
      setTimer(0);
      return;
    }

    setMessage(null);
    setLoading(true);

    const response = await fetch("/api/auth/send-password-code", {
      method: "POST",
    });

    setLoading(false);

    if (response.ok) {
      setShowOtpDialog(true);
    } else {
      setMessage({ type: "error", text: "Failed to send verification code" });
    }
  };

  const handleVerifyOtp = async () => {
    setMessage(null);
    setLoading(true);

    const response = await fetch("/api/auth/verify-password-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });

    setLoading(false);

    if (response.ok) {
      setShowPassword(true);
      setShowOtpDialog(false);
      setOtp("");
      setTimer(20);
      setMessage({ type: "success", text: "Password revealed for 20 seconds" });
    } else {
      setMessage({ type: "error", text: "Invalid or expired OTP" });
    }
  };

  if (!showSection) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showPassword ? "text" : "password"}
                value={showPassword ? "YourActualPassword123" : "••••••••••••"}
                disabled
                className="pr-10"
              />
              <button
                type="button"
                onClick={handleEyeClick}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {timer > 0 && (
              <p className="text-xs text-muted-foreground">
                Password will hide in {timer} seconds
              </p>
            )}
          </div>

          {message && (
            <div className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      {showOtpDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>Verify Your Identity</CardTitle>
              <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to your email</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              </div>

              {message && (
                <div className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOtpDialog(false);
                    setOtp("");
                    setMessage(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying..." : "Verify"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

