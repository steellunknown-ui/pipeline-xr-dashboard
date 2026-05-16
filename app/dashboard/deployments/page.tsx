"use client";

import React, { useState, useEffect, Fragment } from "react";
import { Eye, GitBranch, Clock, ExternalLink, Plus, Rocket, Github, Brain, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { getProjects } from "../actions/projects";
import { getDeployments, createDeployment } from "../actions/deployments";
import { runDeploymentPipeline } from "../actions/deployment-pipeline";
import { toast } from "sonner";
import type { DeploymentWithProject, Project } from "@/lib/types/database";
import { GradientBar } from "@/components/ui/gradient-bar";
import { UploadZipButton } from "@/components/deployment/UploadZipButton";
import PreDeployWarning from "@/components/deployment/PreDeployWarning";
import DeploymentExplanationPanel from "@/components/deployment/DeploymentExplanationPanel";
import { DeploymentEmptyState, FirstDeploymentBanner, NoFailuresYet } from "@/components/deployment/EmptyStates";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { DisabledComparisonButton } from "@/components/deployment/DisabledComparisonButton";
import { DegradedModeBanner } from "@/components/system/DegradedModeBanner";
import { safeFetch } from "@/lib/safe-fetch";

const getStatusColor = (status: string) => {
  switch (status) {
    case "success":
      return "bg-green-500";
    case "pending":
      return "bg-yellow-500";
    case "failed":
      return "bg-red-500";
    case "building":
    case "in_progress":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

const getEnvironmentBadge = (env: string) => {
  const colors = {
    Production: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    Staging: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    Preview: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
  };
  return colors[env as keyof typeof colors] || "bg-gray-100 text-gray-800";
};

export default function DeploymentsPage() {
  const router = useRouter();
  const [deployments, setDeployments] = useState<DeploymentWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ project_id: "", environment: "development" as "development" | "staging" | "production", branch: "main", commit_hash: "" });
  const [submitting, setSubmitting] = useState(false);
  const [runningDeployments, setRunningDeployments] = useState<Set<string>>(new Set());
  const [showPreflightWarning, setShowPreflightWarning] = useState(false);
  const [pendingDeployment, setPendingDeployment] = useState<{ id: string; projectId: string; source: string; commitSha?: string } | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string>("");
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [totalDeploymentCount, setTotalDeploymentCount] = useState(0);
  const [isDegraded, setIsDegraded] = useState(false);


  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setIsDegraded(false);

    // Use the original server actions for now, fallback to safeFetch if needed
    try {
      const [deploymentsRes, projectsRes] = await Promise.all([
        getDeployments(),
        getProjects(),
      ]);

      if (deploymentsRes.success) {
        const deploymentData = deploymentsRes.data || [];
        setDeployments(deploymentData);
        setTotalDeploymentCount(deploymentData.length);
      } else {
        // Try safeFetch as fallback
        const deploymentsResult = await safeFetch('/api/deployments');
        if (deploymentsResult.degraded) {
          setIsDegraded(true);
        } else if (deploymentsResult.success && deploymentsResult.data?.success) {
          const deploymentData = deploymentsResult.data.data || [];
          setDeployments(deploymentData);
          setTotalDeploymentCount(deploymentData.length);
        }
      }

      if (projectsRes.success) {
        setProjects(projectsRes.data || []);
      } else {
        // Try safeFetch as fallback
        const projectsResult = await safeFetch('/api/projects');
        if (projectsResult.degraded) {
          setIsDegraded(true);
        } else if (projectsResult.success && projectsResult.data?.success) {
          setProjects(projectsResult.data.data || []);
        }
      }
    } catch (error) {
      // Network-level failure, use safeFetch
      const deploymentsResult = await safeFetch('/api/deployments');
      const projectsResult = await safeFetch('/api/projects');

      if (deploymentsResult.degraded || projectsResult.degraded) {
        setIsDegraded(true);
      }

      if (deploymentsResult.success && deploymentsResult.data?.success) {
        const deploymentData = deploymentsResult.data.data || [];
        setDeployments(deploymentData);
        setTotalDeploymentCount(deploymentData.length);
      }

      if (projectsResult.success && projectsResult.data?.success) {
        setProjects(projectsResult.data.data || []);
      }
    }

    setLoading(false);
  }



  async function handleCreate() {
    if (!formData.project_id || !formData.branch) {
      toast.error("Please fill required fields");
      return;
    }

    // Show preflight warning for new deployment
    setPendingDeployment({
      id: 'new',
      projectId: formData.project_id,
      source: 'github',
      commitSha: formData.commit_hash || undefined
    });
    setShowPreflightWarning(true);
  }

  async function executeNewDeployment() {
    setSubmitting(true);
    const result = await createDeployment({
      projectId: formData.project_id,
      environment: formData.environment,
      branch: formData.branch
    });
    if (result.success) {
      toast.success("Deployment created! Redirecting to logs...");
      setOpen(false);
      setFormData({ project_id: "", environment: "development", branch: "main", commit_hash: "" });

      // Redirect to logs page
      router.push(`/dashboard/deployments/${result.data.id}/logs`);
    } else {
      toast.error(result.error || "Failed to create deployment");
    }
    setSubmitting(false);
    setShowPreflightWarning(false);
    setPendingDeployment(null);
  }

  async function handleRunDeployment(deploymentId: string) {
    const deployment = deployments.find(d => d.id === deploymentId);
    if (!deployment) return;

    // Show preflight warning
    setPendingDeployment({
      id: deploymentId,
      projectId: deployment.project_id,
      source: deployment.source || 'github',
      commitSha: deployment.commit_sha ?? undefined
    });
    setShowPreflightWarning(true);
  }

  async function executeDeployment() {
    if (!pendingDeployment) return;

    setRunningDeployments(prev => new Set([...prev, pendingDeployment.id]));
    toast.info("Starting deployment...");

    try {
      const result = await runDeploymentPipeline(pendingDeployment.id);
      if (result.success) {
        toast.success("Deployment completed successfully!");
      } else {
        toast.error(result.error || "Deployment failed");
      }
      fetchData(); // Refresh to show updated status
    } catch (error) {
      toast.error("Failed to run deployment");
    } finally {
      setRunningDeployments(prev => {
        const newSet = new Set(prev);
        newSet.delete(pendingDeployment.id);
        return newSet;
      });
      setShowPreflightWarning(false);
      setPendingDeployment(null);
    }
  }

  function cancelDeployment() {
    setShowPreflightWarning(false);
    setPendingDeployment(null);
    if (pendingDeployment?.id === 'new') {
      setOpen(false); // Close the create dialog if it was a new deployment
    }
  }

  function handleExplainDeployment(deploymentId: string) {
    setSelectedDeploymentId(deploymentId);
    setShowExplanation(true);
  }

  const hasDeployments = deployments.length > 0;
  const isFirstDeploymentEver = totalDeploymentCount === 0;
  const hasProjects = projects.length > 0;
  const hasFailedDeployments = deployments.some(d => d.status === 'failed');
  const hasMultipleDeployments = deployments.length > 1;

  return (
    <div className="space-y-6">
      <GradientBar />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Deployments
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your application deployments
          </p>
        </div>
        <div className="flex gap-2">
          <UploadZipButton />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Rocket className="mr-2 h-4 w-4" />
                New Deployment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Deployment</DialogTitle>
                <DialogDescription>Deploy your project to an environment</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="project">Project</Label>
                  <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Select value={formData.environment} onValueChange={(value: any) => setFormData({ ...formData, environment: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input id="branch" placeholder="main" value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commit_hash">Commit Hash (Optional)</Label>
                  <Input id="commit_hash" placeholder="abc123..." value={formData.commit_hash} onChange={(e) => setFormData({ ...formData, commit_hash: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                <Button onClick={handleCreate} disabled={submitting}>{submitting ? "Creating..." : "Create Deployment"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Degraded Mode Banner */}
      <DegradedModeBanner show={isDegraded} className="mb-4" />

      {/* First Deployment Banner - Show only when user has zero deployments ever */}
      {isFirstDeploymentEver && !loading && (
        <FirstDeploymentBanner />
      )}

      {/* No Failures Yet - Show when deployments exist but none failed */}
      {hasDeployments && !hasFailedDeployments && !loading && (
        <NoFailuresYet />
      )}

      {loading ? (
        <div className="rounded-xl border bg-card shadow-sm p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : hasDeployments ? (
        /* Deployments Table */
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Source</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Environment</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Branch</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Deployed</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Run</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((deployment) => (
                  <Fragment key={deployment.id}>
                    <tr
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      {/* Status */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getStatusColor(deployment.status || 'unknown')}`} />
                          <span className="text-sm font-medium capitalize">
                            {deployment.status || 'processing'}
                          </span>
                        </div>
                      </td>

                      {/* Deployment Name */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {deployment.projects?.name || 'Project'}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            {deployment.branch || 'main'}
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="p-4">
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
                      </td>

                      {/* Environment */}
                      <td className="p-4">
                        <Badge variant="outline" className="capitalize">
                          {deployment.environment || 'development'}
                        </Badge>
                      </td>

                      {/* Branch */}
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <GitBranch className="h-3 w-3" />
                          <span className="font-mono">{deployment.branch || 'main'}</span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {deployment.created_at ? new Date(deployment.created_at).toLocaleString() : 'Recently'}
                        </div>
                      </td>

                      {/* Run */}
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant={deployment.status === 'pending' ? 'default' : 'outline'}
                          onClick={() => handleRunDeployment(deployment.id)}
                          disabled={isDegraded || runningDeployments.has(deployment.id) || deployment.status === 'building'}
                          className={isDegraded ? 'opacity-50' : ''}
                        >
                          <Rocket className="h-3 w-3 mr-1" />
                          {runningDeployments.has(deployment.id) ? 'Running...' : 'Run'}
                        </Button>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExplainDeployment(deployment.id)}
                          >
                            <Brain className="h-3 w-3 mr-1" />
                            Explain
                          </Button>
                          <DisabledComparisonButton deploymentCount={deployments.length} />
                          {deployment.deployment_url && deployment.status === "success" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(deployment.deployment_url!, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Visit Site
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/dashboard/deployments/${deployment.id}/logs`)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Logs
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Priority ENV-Change Detector Banner */}
                    {deployment.envOutdated?.outdated && deployment.status === 'success' && (
                      <tr className="bg-yellow-500/10 border-b">
                        <td colSpan={8} className="p-3">
                          <div className="flex items-center justify-between text-sm text-yellow-700 dark:text-yellow-500">
                            <div className="flex items-center gap-2 font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              <span>Environment variables changed since this deployment. Redeploy to apply updates.</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-yellow-500/50 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-500"
                              onClick={() => handleRunDeployment(deployment.id)}
                            >
                              <Rocket className="h-3 w-3 mr-2" />
                              Start Redeploy
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : hasProjects ? (
        /* Project has no deployments yet */
        <DeploymentEmptyState
          projectName={projects[0]?.name}
          projectId={projects[0]?.id}
          hasGitHubConnection={true}
          onDeploy={() => setOpen(true)}
          onEnableAutoDeploy={() => router.push(`/dashboard/projects/${projects[0]?.id}/settings`)}
        />
      ) : (
        /* No projects at all */
        <DeploymentEmptyState
          onDeploy={() => router.push('/dashboard/projects')}
          onConnectGitHub={() => setShowGitHubModal(true)}
        />
      )}

      {/* GitHub Provider Modal */}
      <GitHubProviderModal
        open={showGitHubModal}
        onOpenChange={setShowGitHubModal}
      />

      {/* Pre-Deploy Warning Modal */}
      {pendingDeployment && (
        <PreDeployWarning
          projectId={pendingDeployment.projectId}
          source={pendingDeployment.source as 'github' | 'zip' | 'manual'}
          commitSha={pendingDeployment.commitSha}
          onContinue={pendingDeployment.id === 'new' ? executeNewDeployment : executeDeployment}
          onCancel={cancelDeployment}
          isVisible={showPreflightWarning}
        />
      )}
      {/* Explanation Panel */}
      <DeploymentExplanationPanel
        deploymentId={selectedDeploymentId}
        isOpen={showExplanation}
        onClose={() => setShowExplanation(false)}
      />
    </div>
  );
}