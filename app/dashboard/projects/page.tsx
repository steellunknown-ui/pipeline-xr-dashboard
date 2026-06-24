"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, GitBranch, Calendar, Trash2, Settings, Rocket, Github } from "lucide-react";
import { useRouter } from "next/navigation";
import { createProject, getProjects, deleteProject } from "../actions";
import { triggerVercelDeploy } from "../actions/deployments";
import { toast } from "sonner";
import type { Project } from "@/lib/types/database";
import { GradientBar } from "@/components/ui/gradient-bar";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { supabase } from "@/lib/supabase-browser";
import { getGitHubConnectionState } from "@/lib/github-provider-guard";
import { GitHubNotConnected } from "@/components/deployment/EmptyStates";
import { DisabledComparisonButton } from "@/components/deployment/DisabledComparisonButton";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", github_repo_url: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deployingProjects, setDeployingProjects] = useState<Set<string>>(new Set());
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [checkingGitHub, setCheckingGitHub] = useState(true);


  useEffect(() => {
    fetchProjects();
    checkGitHubConnection();
  }, []);

  const checkGitHubConnection = async () => {
    setCheckingGitHub(true);
    const state = await getGitHubConnectionState();
    setIsGitHubConnected(state.isConnected);
    setCheckingGitHub(false);
  };

  async function fetchProjects() {
    setLoading(true);
    const result = await getProjects();
    if (result.success) {
      setProjects(result.data || []);
    } else {
      toast.error(result.error || "Failed to fetch projects");
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!formData.name || !formData.github_repo_url) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    const result = await createProject(formData);
    if (result.success) {
      toast.success("Project created successfully");
      setOpen(false);
      setFormData({ name: "", github_repo_url: "" });
      fetchProjects();
    } else {
      toast.error(result.error || "Failed to create project");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this project?")) return;
    const result = await deleteProject(id);
    if (result.success) {
      toast.success("Project deleted");
      fetchProjects();
    } else {
      toast.error(result.error || "Failed to delete project");
    }
  }

  async function handleMakeDeployment(projectId: string) {
    setDeployingProjects(prev => new Set([...prev, projectId]));

    try {
      const result = await triggerVercelDeploy({
        projectId,
        environment: 'development',
        branch: 'main'
      });

      if (result.success) {
        toast.success("🚀 Deployment created! Redirecting to logs...");
        router.push(`/dashboard/deployments/${result.data.id}/logs`);
      } else {
        // Enforce ENV-State Machine Frontend Contract
        if (result.error_code === "ENV_REQUIRED") {
          toast.error("This project uses backend services. Configure environment variables before deployment.", {
            duration: 6000,
            action: {
              label: "Configure",
              onClick: () => router.push(`/dashboard/projects/${projectId}/settings?tab=environment`)
            }
          });
        } else {
          toast.error(result.error || "Failed to create deployment");
        }
      }
    } catch (error) {
      toast.error("Failed to create deployment");
    } finally {
      setDeployingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  }

  async function handleGitHubImport() {
    if (!isGitHubConnected) {
      setShowProviderModal(true);
      return;
    }
    router.push('/dashboard/projects/github');
  }

  return (
    <div className="space-y-6">
      <GitHubProviderModal
        open={showProviderModal}
        onOpenChange={setShowProviderModal}
      />
      <GradientBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Projects</h1>
          <p className="text-muted-foreground mt-1">Manage and deploy your projects</p>
        </div>
        <div className="flex gap-2">
          {!isGitHubConnected && !checkingGitHub ? (
            <GitHubNotConnected onConnect={() => setShowProviderModal(true)} />
          ) : (
            <Button
              variant="outline"
              onClick={handleGitHubImport}
              disabled={!isGitHubConnected || checkingGitHub}
            >
              <Github className="mr-2 h-4 w-4" />
              Import from GitHub
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>Add a new project to your dashboard</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="My Awesome Project"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github_repo_url">Repository URL</Label>
                  <Input
                    id="github_repo_url"
                    placeholder="github.com/username/repo"
                    value={formData.github_repo_url}
                    onChange={(e) => setFormData({ ...formData, github_repo_url: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-2 mb-6">
              <h3 className="text-lg font-semibold text-foreground">
                No projects yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Create your first project to start deploying applications with Pipeline XR.
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-2">
                      <GitBranch className="h-3 w-3" />
                      {project.github_repo_url}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/dashboard/projects/${project.id}/settings`)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(project.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleMakeDeployment(project.id)}
                    disabled={deployingProjects.has(project.id) || (project as any).envState?.status === "REQUIRED_MISSING"}
                    className="ml-2"
                  >
                    <Rocket className="h-4 w-4 mr-1" />
                    {deployingProjects.has(project.id) ? 'Creating...' : 'Deploy'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
