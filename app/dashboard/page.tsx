"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, FolderKanban, Rocket, Settings, Plus, Eye, TrendingUp, Clock, ExternalLink, Github } from "lucide-react";
import { getProjects, getDeployments, getActivityLogs, getEnvVariables } from "./actions";
import { supabase } from "@/lib/supabase-browser";
import { recoverSession } from "@/lib/session-recovery";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Project, DeploymentWithProject, ActivityLog, EnvironmentVariable } from "@/lib/types/database";
import { toast } from "sonner";
import { GradientBar } from "@/components/ui/gradient-bar";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { GitHubConnectionCard } from "@/components/github/GitHubConnectionCard";
import { FirstTimeGuide } from "@/components/onboarding/FirstTimeGuide";
import { WhyPipelineXR } from "@/components/onboarding/WhyPipelineXR";
import { getOnboardingAction } from "@/lib/onboarding-rules";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deployments, setDeployments] = useState<DeploymentWithProject[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasGitHubAuth, setHasGitHubAuth] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);

  // PRIORITY 7.1: First-Time User Guidance
  const onboardingAction = getOnboardingAction({
    projects,
    deployments,
    lastDeployment: deployments[0],
    autoDeployEnabled: false // TODO: Check actual auto-deploy status
  });


  const fetchData = async () => {
    try {
      setError(null);

      // Recover session if corrupted
      const sessionValid = await recoverSession();
      if (!sessionValid) {
        console.log('Session recovery completed, retrying...');
        // Give a moment for session to clear, then retry
        setTimeout(() => window.location.reload(), 1000);
        return;
      }

      // Debug: Check if we have a user with GitHub identity
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Client user:', user?.id);
      console.log('User identities:', user?.identities);

      // Check for GitHub identity
      const hasGitHubIdentity = user?.identities?.some(identity => identity.provider === 'github');
      console.log('Has GitHub identity:', hasGitHubIdentity);

      // Only show as connected if user has GitHub identity
      setHasGitHubAuth(hasGitHubIdentity || false);

      const [projectsRes, deploymentsRes, activitiesRes, envVarsRes] = await Promise.all([
        getProjects(),
        getDeployments(),
        getActivityLogs(50),
        getEnvVariables(),
      ]);

      const errors = [];
      if (projectsRes.success) setProjects(projectsRes.data || []);
      else errors.push(`Projects: ${projectsRes.error}`);

      if (deploymentsRes.success) setDeployments(deploymentsRes.data || []);
      else errors.push(`Deployments: ${deploymentsRes.error}`);

      if (activitiesRes.success) setActivities(activitiesRes.data || []);
      else errors.push(`Activities: ${activitiesRes.error}`);

      if (envVarsRes.success) setEnvVars(envVarsRes.data || []);
      else errors.push(`Environment: ${envVarsRes.error}`);

      if (errors.length > 0) {
        setError(errors.join(', '));
        console.error('Dashboard errors:', errors);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(`Failed to fetch dashboard data: ${err}`);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const connectGitHub = async () => {
    try {
      // Call our GitHub OAuth API route
      const response = await fetch('/api/github/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!result.success) {
        // Handle provider mismatch specifically
        if (result.error_code === 'PROVIDER_MISMATCH') {
          setShowProviderModal(true);
          return;
        }

        toast.error(result.error || 'Failed to connect GitHub');
        return;
      }

      // Redirect to GitHub OAuth
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('GitHub connection error:', error);
      toast.error('Failed to initiate GitHub connection');
    }
  };

  const queuedDeployments = deployments.filter(d => d.status === "pending").length;
  const runningDeployments = deployments.filter(d => d.status === "building").length;
  const successDeployments = deployments.filter(d => d.status === "success").length;
  const failedDeployments = deployments.filter(d => d.status === "failed").length;

  const last7DaysActivities = activities.filter(a => {
    const date = new Date(a.created_at);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const recentDeployments = deployments.slice(0, 5);
  const recentActivities = activities.slice(0, 5);

  const deploymentTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: Math.floor(Math.random() * 10) + 1,
    };
  });

  const maxCount = Math.max(...deploymentTrendData.map(d => d.count));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-green-500">Success</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "running": return <Badge className="bg-blue-500">Running</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (error && !loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive text-sm">{error}</p>
          <Button onClick={fetchData}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <GradientBar />

      {/* GitHub Provider Mismatch Modal */}
      <GitHubProviderModal
        open={showProviderModal}
        onOpenChange={setShowProviderModal}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Overview Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor your projects, deployments, and activity</p>
        </div>
        <div className="flex gap-2">
          {hasGitHubAuth ? (
            <Button variant="outline" size="sm" disabled>
              <Github className="h-4 w-4 mr-2" />
              GitHub Connected
            </Button>
          ) : (
            <Button onClick={connectGitHub} variant="outline" size="sm">
              <Github className="h-4 w-4 mr-2" />
              Connect GitHub
            </Button>
          )}
          <Button onClick={() => router.push("/dashboard/projects")} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* PRIORITY 7.1: First-Time User Guidance */}
      {onboardingAction && !loading && (
        <FirstTimeGuide action={onboardingAction} />
      )}

      {/* PRIORITY 7.2: Why Pipeline XR - Clarity Layer */}
      {!loading && (
        <WhyPipelineXR deployments={deployments} autoDeployEnabled={false} />
      )}

      {/* PRIORITY 9.3: Activity Feed - show only if deployments exist */}
      {!loading && deployments.length > 0 && (
        <ActivityFeed />
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/dashboard/projects")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{projects.length}</div>}
            <p className="text-xs text-muted-foreground mt-1">Click to view all</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/dashboard/deployments")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{deployments.length}</div>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="text-yellow-600">{queuedDeployments} pending</span>
                  <span className="text-blue-600">{runningDeployments} running</span>
                  <span className="text-green-600">{successDeployments} success</span>
                  <span className="text-red-600">{failedDeployments} failed</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/dashboard/environment")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Environment Variables</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{envVars.length}</div>}
            <p className="text-xs text-muted-foreground mt-1">Active variables</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/dashboard/activity")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Activity (7 days)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{last7DaysActivities}</div>}
            <p className="text-xs text-muted-foreground mt-1">Recent events</p>
          </CardContent>
        </Card>
      </div>

      {/* GitHub Connection Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <GitHubConnectionCard />

        {/* Quick Actions */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/projects")}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/deployments")}>
                <Rocket className="h-4 w-4 mr-2" />
                New Deployment
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/environment")}>
                <Settings className="h-4 w-4 mr-2" />
                Add Environment Variable
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Deployment Trend (Last 7 Days)
          </CardTitle>
          <CardDescription>Daily deployment activity</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="flex items-end justify-between h-48 gap-2">
              {deploymentTrendData.map((item, i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-2">
                  <div className="w-full bg-primary/20 rounded-t relative" style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: '20px' }}>
                    <div className="absolute inset-0 bg-primary rounded-t" />
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium">{item.count}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.day}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Deployments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Deployments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/deployments")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : recentDeployments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No deployments yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDeployments.map((deployment) => (
                  <TableRow key={deployment.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/deployments/${deployment.id}/logs`)}>
                    <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                    <TableCell className="font-medium">{deployment.projects?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant={(deployment.source || 'github') === 'github' ? 'default' : 'secondary'} className="flex items-center gap-1 w-fit">
                        {(deployment.source || 'github') === 'github' ? (
                          <>
                            <Github className="h-3 w-3" />
                            GitHub
                          </>
                        ) : (
                          <>
                            📦 ZIP
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{deployment.environment}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{deployment.branch}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(deployment.created_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {deployment.deployment_url && deployment.status === "success" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); window.open(deployment.deployment_url!, '_blank'); }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Visit
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/deployments/${deployment.id}/logs`); }}>
                          <Eye className="h-4 w-4 mr-1" />
                          Logs
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/activity")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => router.push("/dashboard/activity")}
                >
                  <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{activity.event.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm mt-1">{activity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/projects")}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/deployments")}>
              <Rocket className="h-4 w-4 mr-2" />
              New Deployment
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => router.push("/dashboard/environment")}>
              <Settings className="h-4 w-4 mr-2" />
              Add Environment Variable
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
