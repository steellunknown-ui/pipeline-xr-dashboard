"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, GitBranch, Calendar, Trash2, Settings, Rocket, Github, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createProject, getProjects, deleteProject } from "../actions";
import { triggerVercelDeploy, createDeployment } from "../actions/deployments";
import { toast } from "sonner";
import type { Project } from "@/lib/types/database";
import { GradientBar } from "@/components/ui/gradient-bar";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { supabase } from "@/lib/supabase-browser";
import { getGitHubConnectionState } from "@/lib/github-provider-guard";
import { GitHubNotConnected } from "@/components/deployment/EmptyStates";
import { DisabledComparisonButton } from "@/components/deployment/DisabledComparisonButton";
import { DragDropUploader } from "@/components/deployment/DragDropUploader";
import { FileArchive } from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [zipModalOpen, setZipModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", github_repo_url: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deployingProjects, setDeployingProjects] = useState<Set<string>>(new Set());
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [checkingGitHub, setCheckingGitHub] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [projectToSchedule, setProjectToSchedule] = useState<Project | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");


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
    setDeleting(true);
    const result = await deleteProject(id);
    if (result.success) {
      toast.success("Project deleted");
      setProjectToDelete(null);
      fetchProjects();
    } else {
      toast.error(result.error || "Failed to delete project");
    }
    setDeleting(false);
  }

  async function handleMakeDeployment(project: Project) {
    setDeployingProjects(prev => new Set([...prev, project.id]));

    try {
      let result;
      if (project.source_type === "zip" || !project.github_repo_url) {
        result = await createDeployment({
          projectId: project.id,
          environment: 'development',
          branch: 'main',
          source: 'zip'
        });
      } else {
        result = await triggerVercelDeploy({
          projectId: project.id,
          environment: 'development',
          branch: 'main'
        });
      }

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
              onClick: () => router.push(`/dashboard/projects/${project.id}/settings?tab=environment`)
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
        newSet.delete(project.id);
        return newSet;
      });
    }
  }

  async function handleScheduleDeployment() {
    if (!projectToSchedule || !scheduleDate || !scheduleTime) return;
    
    setDeployingProjects(prev => new Set([...prev, projectToSchedule.id]));
    setScheduleModalOpen(false);

    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      let result;
      
      if (projectToSchedule.source_type === "zip" || !projectToSchedule.github_repo_url) {
        result = await createDeployment({
          projectId: projectToSchedule.id,
          environment: 'development',
          branch: 'main',
          source: 'zip',
          scheduledFor
        });
      } else {
        result = await triggerVercelDeploy({
          projectId: projectToSchedule.id,
          environment: 'development',
          branch: 'main',
          scheduledFor
        });
      }

      if (result.success) {
        toast.success(`🗓️ Deployment scheduled for ${new Date(scheduledFor).toLocaleString()}!`);
      } else {
        toast.error(result.error || "Failed to schedule deployment");
      }
    } catch (error) {
      toast.error("Failed to schedule deployment");
    } finally {
      setDeployingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectToSchedule.id);
        return newSet;
      });
      setProjectToSchedule(null);
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

      {/* ── Delete Confirmation Dialog ─────────────────────── */}
      <Dialog open={!!projectToDelete} onOpenChange={(o) => !o && setProjectToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              Delete Project
            </DialogTitle>
            <DialogDescription className="pt-1">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{projectToDelete?.name}</span>?<br />
              This will permanently remove the project and all its deployments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setProjectToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => projectToDelete && handleDelete(projectToDelete.id)}
              disabled={deleting}
              className="gap-2"
            >
              {deleting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {deleting ? "Deleting..." : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Deployment Dialog ─────────────────────── */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Schedule Deployment
            </DialogTitle>
            <DialogDescription>
              Pick a date and time to automatically trigger a deployment for {projectToSchedule?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleDeployment} disabled={!scheduleDate || !scheduleTime}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          
          {/* <Dialog open={zipModalOpen} onOpenChange={setZipModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-dashed border-2 bg-primary/5 hover:bg-primary/10">
                <FileArchive className="h-4 w-4" />
                Upload .ZIP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Deploy from ZIP</DialogTitle>
                <DialogDescription>Drag and drop a .zip file of your static site to deploy instantly.</DialogDescription>
              </DialogHeader>
              <DragDropUploader />
            </DialogContent>
          </Dialog> */}


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
                    <CardTitle 
                      className="cursor-pointer hover:text-indigo-400 transition-colors"
                      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                    >
                      {project.name}
                    </CardTitle>
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
                      onClick={() => setProjectToDelete(project)}
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
                  
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          disabled={deployingProjects.has(project.id) || (project as any).envState?.status === "REQUIRED_MISSING"}
                        >
                          <Rocket className="h-4 w-4 mr-1" />
                          {deployingProjects.has(project.id) ? 'Deploying...' : 'Deploy'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMakeDeployment(project)}>
                          <Rocket className="h-4 w-4 mr-2" /> Deploy Now
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setProjectToSchedule(project);
                          setScheduleModalOpen(true);
                        }}>
                          <Clock className="h-4 w-4 mr-2" /> Schedule...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
