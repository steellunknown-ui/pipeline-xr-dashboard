"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import ProfileSection from "@/components/settings/ProfileSection";
import SecuritySection from "@/components/settings/SecuritySection";
import PasswordSection from "@/components/settings/PasswordSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        router.push("/login");
      }
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:ml-[72px]">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your account settings</p>
            </div>
            
            <ProfileSection />
            <SecuritySection />
            <PasswordSection />
            <AppearanceSection />
            <DeleteAccountSection />
          </div>
        </main>
      </div>
    </div>
  );
}
