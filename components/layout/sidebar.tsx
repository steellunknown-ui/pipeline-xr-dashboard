"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Rocket,
  FolderKanban,
  Key,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { name: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { name: "Deployments", href: "/dashboard/deployments", icon: Rocket },
  { name: "Activity", href: "/dashboard/activity", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/");
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {navigation.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onClick}
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            )}
          >
            <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
            <span className="truncate">{item.name}</span>
            {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-background border border-border shadow-sm lg:hidden"
        aria-label="Toggle menu"
      >
        <div className="w-4 h-0.5 bg-foreground mb-1 transition-all" style={{ transform: mobileOpen ? "rotate(45deg) translate(2px, 2px)" : "none" }} />
        <div className="w-4 h-0.5 bg-foreground mb-1 transition-all" style={{ opacity: mobileOpen ? 0 : 1 }} />
        <div className="w-4 h-0.5 bg-foreground transition-all" style={{ transform: mobileOpen ? "rotate(-45deg) translate(2px, -2px)" : "none" }} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 bg-background border-r border-border flex flex-col transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-border">
          <div className="h-8 w-8 rounded-md border-2 border-foreground flex items-center justify-center flex-shrink-0">
            <span className="text-foreground font-black text-xs tracking-tighter">XR</span>
          </div>
          <span className="text-base font-bold tracking-tight">Pipeline XR</span>
        </div>

        <NavLinks onClick={() => setMobileOpen(false)} />

        {/* Sign out */}
        <div className="p-3 border-t border-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop sidebar — hover to expand */}
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={cn(
          "hidden lg:flex fixed left-0 top-0 h-screen flex-col bg-background border-r border-border transition-all duration-300 ease-in-out overflow-hidden z-30",
          expanded ? "w-[230px]" : "w-[68px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-[18px] flex-shrink-0">
          <div className="h-8 w-8 rounded-md border-2 border-foreground flex items-center justify-center flex-shrink-0">
            <span className="text-foreground font-black text-xs tracking-tighter">XR</span>
          </div>
          {expanded && (
            <span className="ml-3 text-base font-bold tracking-tight whitespace-nowrap">Pipeline XR</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.name}
                href={item.href}
                title={!expanded ? item.name : undefined}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                )}
              >
                <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary-foreground" : "")} />
                {expanded && <span className="whitespace-nowrap">{item.name}</span>}
                {expanded && active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Sign out at bottom */}
        <div className="p-2.5 border-t border-border flex-shrink-0">
          <button
            onClick={handleSignOut}
            title={!expanded ? "Sign Out" : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {expanded && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </div>
    </>
  );
}