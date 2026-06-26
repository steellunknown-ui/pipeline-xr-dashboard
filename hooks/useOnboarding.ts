"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";

export function useOnboarding() {
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("user_profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      setIsComplete(data?.onboarding_completed ?? false);
    } catch {
      setIsComplete(true); // If error, don't block the user
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_profiles")
        .upsert({ id: user.id, onboarding_completed: true, updated_at: new Date().toISOString() });

      setIsComplete(true);
    } catch {
      setIsComplete(true); // Don't block even on error
    }
  }, []);

  return { isOnboardingComplete: isComplete, loading, completeOnboarding };
}
