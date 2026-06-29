"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, FolderKanban, CheckCircle2, XCircle, Clock, ArrowRight,
  Github, Plus, Zap, ExternalLink, RefreshCw, TrendingUp, Activity
} from "lucide-react";
import { getProjects, getDeployments } from "./actions";
import { supabase } from "@/lib/supabase-browser";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project, DeploymentWithProject } from "@/lib/types/database";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Status config
const statusConfig = {
  success: { label: "Success", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", badge: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
  building: { label: "Building", icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-500/10", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-gray-500", bg: "bg-gray-500/10", badge: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20" },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", config.badge)}>
      <Icon className={cn("w-3 h-3", config.color, status === "building" && "animate-spin")} />
      {config.label}
    </span>
  );
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Empty / First-time State ───────────────────────────────────────────────

function WelcomeState({ userName, onImport, onCreate }: {
  userName: string;
  onImport: () => void;
  onCreate: () => void;
}) {
  const steps = [
    { icon: Github, label: "Connect a Repo", desc: "Import from GitHub", action: onImport, primary: true },
    { icon: FolderKanban, label: "Create Project", desc: "Start from scratch", action: onCreate, primary: false },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full space-y-8"
      >
        {/* Hero */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-medium">
            <Zap className="w-3.5 h-3.5" />
            Ready to deploy
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Hey {userName}! 👋
          </h1>
          <p className="text-lg text-muted-foreground">
            Let&apos;s ship your first project. Connect a GitHub repo and we&apos;ll handle the rest.
          </p>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.label}
                onClick={step.action}
                className={cn(
                  "group flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all duration-200 text-center",
                  step.primary
                    ? "bg-primary text-primary-foreground border-primary hover:opacity-90 shadow-lg shadow-primary/25"
                    : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  step.primary ? "bg-primary-foreground/20" : "bg-muted"
                )}>
                  <Icon className={cn("w-6 h-6", step.primary ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                </div>
                <div>
                  <p className={cn("font-semibold text-sm", step.primary ? "text-primary-foreground" : "text-foreground")}>{step.label}</p>
                  <p className={cn("text-xs mt-0.5", step.primary ? "text-primary-foreground/70" : "text-muted-foreground")}>{step.desc}</p>
                </div>
                <ArrowRight className={cn("w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all", step.primary ? "text-primary-foreground" : "text-muted-foreground")} />
              </button>
            );
          })}
        </div>

        {/* How it works */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">How it works</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { step: "1", label: "Connect Repo" },
            { step: "2", label: "Set ENV Vars" },
            { step: "3", label: "Deploy" },
            { step: "4", label: "AI Monitors" },
          ].map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground mx-auto">
                {item.step}
              </div>
              <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deployments, setDeployments] = useState<DeploymentWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.full_name?.split(" ")[0] ||
          user.user_metadata?.name?.split(" ")[0] ||
          user.email?.split("@")[0] ||
          "there";
        setUserName(name);
      }
    });
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, deploymentsRes] = await Promise.all([
        getProjects(),
        getDeployments(),
      ]);
      if (projectsRes.success) setProjects(projectsRes.data || []);
      if (deploymentsRes.success) setDeployments(deploymentsRes.data || []);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const totalProjects = projects.length;
  const totalDeploys = deployments.length;
  const successDeploys = deployments.filter((d) => d.status === "success").length;
  const failedDeploys = deployments.filter((d) => d.status === "failed").length;
  const activeDeploys = deployments.filter((d) => d.status === "building" || d.status === "pending").length;
  const successRate = totalDeploys > 0 ? Math.round((successDeploys / totalDeploys) * 100) : 0;
  const recentDeploys = deployments.slice(0, 8);

  if (loading) {
    return (
      <div className="space-y-6 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite] pointer-events-none z-10" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-muted/60" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl bg-muted/60" />
      </div>
    );
  }

  // Empty state
  if (totalProjects === 0) {
    return (
      <WelcomeState
        userName={userName}
        onImport={() => router.push("/dashboard/projects/github")}
        onCreate={() => router.push("/dashboard/projects")}
      />
    );
  }

  // Stats cards data
  const stats = [
    {
      label: "Projects",
      value: totalProjects,
      icon: FolderKanban,
      href: "/dashboard/projects",
      sub: `${activeDeploys > 0 ? `${activeDeploys} deploying` : "all idle"}`,
    },
    {
      label: "Total Deploys",
      value: totalDeploys,
      icon: Rocket,
      href: "/dashboard/deployments",
      sub: `${successDeploys} succeeded`,
    },
    {
      label: "Success Rate",
      value: `${successRate}%`,
      icon: TrendingUp,
      href: "/dashboard/deployments",
      sub: totalDeploys > 0 ? `${failedDeploys} failed` : "no deploys yet",
    },
    {
      label: "Active Now",
      value: activeDeploys,
      icon: Activity,
      href: "/dashboard/deployments",
      sub: activeDeploys > 0 ? "in progress" : "nothing running",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {userName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s what&apos;s happening with your projects</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/projects/github")}>
            <Github className="w-4 h-4 mr-1.5" />
            Import Repo
          </Button>
          <Button size="sm" onClick={() => router.push("/dashboard/projects")}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Card
                className="cursor-pointer bg-card/80 backdrop-blur-sm border-border/40 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] group"
                onClick={() => router.push(stat.href)}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
                    <div className="w-8 h-8 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                      <Icon className="w-4 h-4 text-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Deployments */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-5">
          <CardTitle className="text-base font-semibold">Recent Deployments</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => router.push("/dashboard/deployments")} className="text-muted-foreground hover:text-foreground">
            View all
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {recentDeploys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Rocket className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-sm text-foreground">No deployments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Go to a project and click Deploy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDeploys.map((deploy, i) => (
                <motion.div
                  key={deploy.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => router.push(`/dashboard/deployments/${deploy.id}/logs`)}
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-border/80 hover:shadow-md cursor-pointer transition-all duration-300 hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status={deploy.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {(deploy as any).projects?.name ?? "Unknown Project"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{deploy.branch}</span>
                        <span>•</span>
                        <span>{timeAgo(deploy.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {deploy.status === "success" && (
                      <a
                        href={deploy.alias_url || '#'}
                        target={deploy.alias_url ? "_blank" : undefined}
                        rel={deploy.alias_url ? "noopener noreferrer" : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!deploy.alias_url) e.preventDefault();
                        }}
                        className={`p-1.5 rounded-md transition-colors inline-flex items-center justify-center ${
                          deploy.alias_url 
                            ? 'text-muted-foreground hover:text-foreground hover:bg-muted' 
                            : 'text-muted-foreground/30 cursor-not-allowed'
                        }`}
                        title={!deploy.alias_url ? 'Production URL unavailable' : 'Visit Site'}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Your Projects</h2>
          <Button size="sm" variant="ghost" onClick={() => router.push("/dashboard/projects")} className="text-muted-foreground hover:text-foreground">
            View all
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.slice(0, 6).map((project, i) => {
            const lastDeploy = deployments.find((d) => d.project_id === project.id);
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card
                  className="cursor-pointer bg-card/80 backdrop-blur-sm border-border/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-primary/20 group relative overflow-hidden"
                  onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0">
                        <span className="text-foreground font-bold text-sm">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {lastDeploy && <StatusBadge status={lastDeploy.status} />}
                    </div>
                    <p className="font-semibold text-sm text-foreground truncate">{project.name}</p>
                    {(project as any).github_repo_full_name ? (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                        <Github className="w-3 h-3 flex-shrink-0" />
                        {(project as any).github_repo_full_name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">No repo connected</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {lastDeploy ? timeAgo(lastDeploy.created_at) : "Never deployed"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/projects/${project.id}/settings`); }}
                      >
                        <Rocket className="w-3 h-3 mr-1" />
                        Deploy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {/* Add project card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: projects.slice(0, 6).length * 0.06 }}>
            <Card
              className="cursor-pointer border-dashed border-border/60 bg-transparent hover:border-primary/50 hover:bg-primary/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] group"
              onClick={() => router.push("/dashboard/projects")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full min-h-[120px]">
                <div className="w-9 h-9 rounded-lg border-2 border-dashed border-border group-hover:border-primary/40 flex items-center justify-center mb-2 transition-colors">
                  <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">New Project</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
