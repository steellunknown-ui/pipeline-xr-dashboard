"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getUserDisplayName, getUserAvatar } from "@/lib/auth-utils";
import { User } from "@supabase/supabase-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Settings, ChevronRight } from "lucide-react";
import Image from "next/image";

interface TopbarProps {
  user?: User | null;
}

// Route label map for breadcrumbs
const routeLabels: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/projects": "Projects",
  "/dashboard/deployments": "Deployments",
  "/dashboard/environment": "Environment",
  "/dashboard/activity": "Activity",
  "/dashboard/settings": "Settings",
  "/dashboard/ai": "AI Assistant",
  "/dashboard/logs": "Logs",
};

function Breadcrumb() {
  const pathname = usePathname();

  // Build crumbs from the path
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let accumulated = "";
  for (const seg of segments) {
    accumulated += `/${seg}`;
    const label = routeLabels[accumulated];
    if (label) {
      crumbs.push({ label, href: accumulated });
    } else if (seg !== "dashboard") {
      // Dynamic segments (like project IDs) — just capitalize
      crumbs.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1), href: accumulated });
    }
  }

  if (crumbs.length === 0) return <span className="text-sm font-semibold">Dashboard</span>;

  return (
    <div className="flex items-center gap-1.5">
      {crumbs.map((crumb, i) => (
        <div key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
          <span
            className={
              i === crumbs.length - 1
                ? "text-sm font-semibold text-foreground"
                : "text-sm text-muted-foreground"
            }
          >
            {crumb.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const displayName = getUserDisplayName(user || null);
  const avatarUrl = getUserAvatar(user || null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/");
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-6 flex-shrink-0">
      {/* Breadcrumbs */}
      <div className="flex items-center">
        <Breadcrumb />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 outline-none rounded-xl p-1.5 hover:bg-muted transition-colors">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={30}
                height={30}
                className="h-7 w-7 rounded-full border border-border"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xs font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
              {displayName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
