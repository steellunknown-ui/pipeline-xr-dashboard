"use client";

import { useState, useEffect } from "react";
import { Eye, GitBranch, Clock, ExternalLink, Plus, Rocket, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { getDeployments, createDeployment, getProjects, runDeployment } from "../actions";
import { toast } from "sonner";
import type { DeploymentWithProject, Project } from "@/lib/types/database";

const getStatusColor = (status: string) => {
  switch (status) {
    case "success":
      return "bg-green-500";
    case "pending":
      return "bg-yellow-500";
    case "failed":
      return "bg-red-500";
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
  const [runningDeployment, setRunningDeployment] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [deploymentsRes, projectsRes] = await Promise.all([
      getDeployments(),
      getProjects(),
    ]);
    if (deploymentsRes.success) {
      setDeployments(deploymentsRes.data || []);
    } else {
      toast.error(deploymentsRes.error || "Failed to fetch deployments");
    }
    if (projectsRes.success) {
      setProjects(projectsRes.data || []);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!formData.project_id || !formData.branch) {
      toast.error("Please fill required fields");
      return;
    }
    setSubmitting(true);
    const result = await createDeployment(formData);
    if (result.success) {
      toast.success("Deployment created successfully");
      setOpen(false);
      setFormData({ project_id: "", environment: "development", branch: "main", commit_hash: "" });
      fetchData();
    } else {
      toast.error(result.error || "Failed to create deployment");
    }
    setSubmitting(false);
  }

  async function handleRunDeployment(deploymentId: string) {
    setRunningDeployment(deploymentId);
    toast.info("Starting deployment...");
    
    // Run deployment in background
    runDeployment(deploymentId).then((result) => {
      if (result.success) {
        toast.success("Deployment completed successfully!");
      } else {
        toast.error(result.error || "Deployment failed");
      }
      fetchData();
      setRunningDeployment(null);
    });
  }

  const hasDeployments = deployments.length > 0;

  return (
    <div className="space-y-6">
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
                  <th className="text-left p-4 font-medium text-muted-foreground">Environment</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Branch</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Deployed</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((deployment) => (
                  <tr
                    key={deployment.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    {/* Status */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(deployment.status)}`} />
                        <span className="text-sm font-medium capitalize">
                          {deployment.status}
                        </span>
                      </div>
                    </td>

                    {/* Deployment Name */}
                    <td className="p-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {deployment.projects?.name || 'Unknown Project'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GitBranch className="h-3 w-3" />
                          {deployment.branch}
                        </div>
                      </div>
                    </td>

                    {/* Environment */}
                    <td className="p-4">
                      <Badge variant="outline" className="capitalize">
                        {deployment.environment}
                      </Badge>
                    </td>

                    {/* Branch */}
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        <span className="font-mono">{deployment.branch}</span>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(deployment.created_at).toLocaleString()}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <div className="flex gap-2">
                        {deployment.status === "queued" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRunDeployment(deployment.id)}
                            disabled={runningDeployment === deployment.id}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {runningDeployment === deployment.id ? "Running..." : "Run"}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto max-w-md space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <ExternalLink className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                No deployments found
              </h3>
              <p className="text-sm text-muted-foreground">
                Connect your GitHub repository to start deploying your applications.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              <GitBranch className="h-4 w-4" />
              Connect GitHub to Deploy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}