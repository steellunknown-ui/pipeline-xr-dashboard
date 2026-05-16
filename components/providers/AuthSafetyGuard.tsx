"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";

export function AuthSafetyGuard() {
  useEffect(() => {
    if (supabase?.auth) {
      supabase.auth.getUser().catch(() => {
        supabase.auth.signOut();
      });
    }
  }, []);

  return null;
}