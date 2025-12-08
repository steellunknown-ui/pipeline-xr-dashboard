"use client";

import { LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Topbar() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      {/* Left side - can add breadcrumbs or page title here */}
      <div className="flex items-center">
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
      </div>

      {/* Right side - User info and logout */}
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-3">
          {/* User avatar and info */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-foreground">User</p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
              "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            )}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}