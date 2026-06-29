"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase-browser";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "sonner";
import { FloatingDevOpsBot } from "@/components/ai/FloatingDevOpsBot";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useOnboarding } from "@/hooks/useOnboarding";
import { User } from "@supabase/supabase-js";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const { isOnboardingComplete, loading: onboardingLoading, completeOnboarding } = useOnboarding();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const showOnboarding = !onboardingLoading && isOnboardingComplete === false;

  return (
    <div className="flex h-screen bg-background">
      <Toaster richColors position="top-right" />
      <FloatingDevOpsBot />

      {/* Onboarding */}
      <OnboardingFlow open={showOnboarding} onComplete={completeOnboarding} />

      <Sidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-[68px] min-w-0">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Verify session exists, redirect if not
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = "/auth/login";
      } else {
        setReady(true);
      }
    });
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 flex items-center justify-center animate-pulse mix-blend-screen overflow-hidden">
            <Image src="/images/xr-logo.png" alt="Pipeline XR Logo" width={64} height={64} className="object-contain" />
          </div>
          <p className="text-sm text-muted-foreground">Loading Pipeline XR...</p>
        </div>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}