"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Github, Save, Trash2, RefreshCw, Copy, Eye, EyeOff, Webhook } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getProjectById, updateProject, deleteProject, getGitHubRepos, updateProjectAutoDeploy, regenerateWebhookSecret } from "@/app/dashboard/actions";
import { createClient } from "@/lib/supabase-browser";
import { toast } from "sonner";
import type { Project } from "@/lib/types/database";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  owner: {
    login: string;
  };
}

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [autoDeployEnabled, setAutoDeployEnabled] = useState(false);
  const [autoDeployBranch, setAutoDeployBranch] = useState("main");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    github_repo_url: "",
  });

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  async function fetchProject() {
    setLoading(true);
    const result = await getProjectById(projectId);
    if (result.success && result.data) {
      setProject(result.data);
      setFormData({
        name: result.data.name,
        github_repo_url: result.data.github_repo_url,
      });
      setAutoDeployEnabled(result.data.auto_deploy_enabled);
      setAutoDeployBranch(result.data.auto_deploy_branch || "main");
    } else {
      toast.error(result.error || "Failed to load project");
      router.push("/dashboard/projects");
    }
    setLoading(false);
  }

  async function handleSaveName() {
    if (!formData.name) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    const result = await updateProject(projectId, { name: formData.name });
    if (result.success) {
      toast.success("Project name updated");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to update project");
    }
    setSaving(false);
  }

  async function handleSaveRepoUrl() {
    if (!formData.github_repo_url) {
      toast.error("Repository URL is required");
      return;
    }
    setSaving(true);
    const result = await updateProject(projectId, { github_repo_url: formData.github_repo_url });
    if (result.success) {
      toast.success("Repository URL updated");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to update repository");
    }
    setSaving(false);
  }

  async function handleConnectGitHub() {
    setConnectingGitHub(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.provider_token) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          scopes: "repo read:user",
          redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard/projects/${projectId}/settings`,
        },
      });
      
      if (error) {
        toast.error("Failed to connect GitHub");
        setConnectingGitHub(false);
      }
      return;
    }

    const result = await getGitHubRepos();
    setConnectingGitHub(false);

    if (result.success && result.data) {
      setGithubRepos(result.data);
      setShowRepoSelector(true);
      toast.success("GitHub connected! Select a repository");
    } else {
      if (result.needsReauth) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: {
            scopes: "repo read:user",
            redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard/projects/${projectId}/settings`,
          },
        });
        if (error) {
          toast.error("Failed to reconnect GitHub");
        }
      } else {
        toast.error(result.error || "Failed to fetch repositories");
      }
    }
  }

  async function handleSelectRepo() {
    if (!selectedRepo) {
      toast.error("Please select a repository");
      return;
    }

    const repo = githubRepos.find(r => r.full_name === selectedRepo);
    if (!repo) return;

    setSaving(true);
    const result = await updateProject(projectId, {
      github_repo_url: repo.html_url,
    });

    if (result.success) {
      toast.success("Repository connected successfully");
      setShowRepoSelector(false);
      setSelectedRepo("");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to connect repository");
    }
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    const result = await deleteProject(projectId);
    if (result.success) {
      toast.success("Project deleted successfully");
      router.push("/dashboard/projects");
    } else {
      toast.error(result.error || "Failed to delete project");
      setSaving(false);
    }
  }

  async function handleAutoDeployToggle(enabled: boolean) {
    setSaving(true);
    const result = await updateProjectAutoDeploy(projectId, enabled, autoDeployBranch);
    if (result.success) {
      toast.success(`Auto-deploy ${enabled ? "enabled" : "disabled"}`);
      fetchProject();
    } else {
      toast.error(result.error || "Failed to update auto-deploy");
    }
    setSaving(false);
  }

  async function handleSaveAutoDeploy() {
    setSaving(true);
    const result = await updateProjectAutoDeploy(projectId, autoDeployEnabled, autoDeployBranch);
    if (result.success) {
      toast.success("Auto-deploy settings saved");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to save settings");
    }
    setSaving(false);
  }

  async function handleRegenerateSecret() {
    if (!confirm("Regenerate webhook secret? This will invalidate the current secret.")) return;
    setSaving(true);
    const result = await regenerateWebhookSecret(projectId);
    if (result.success) {
      toast.success("Webhook secret regenerated");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to regenerate secret");
    }
    setSaving(false);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Project Settings</h1>
          <p className="text-muted-foreground mt-1">{project.name}</p>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update your project information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Project"
              />
              <Button onClick={handleSaveName} disabled={saving || formData.name === project.name}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="repo-url">GitHub Repository URL</Label>
            <div className="flex gap-2">
              <Input
                id="repo-url"
                value={formData.github_repo_url}
                onChange={(e) => setFormData({ ...formData, github_repo_url: e.target.value })}
                placeholder="https://github.com/username/repo"
              />
              <Button onClick={handleSaveRepoUrl} disabled={saving || formData.github_repo_url === project.github_repo_url}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(project.created_at).toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Last Updated</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(project.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Deploy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Auto-Deploy
          </CardTitle>
          <CardDescription>Automatically deploy when you push to GitHub</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable auto-deploy on Git push</Label>
              <p className="text-sm text-muted-foreground">
                Automatically trigger deployments when code is pushed to GitHub
              </p>
            </div>
            <Switch
              checked={autoDeployEnabled}
              onCheckedChange={(checked) => {
                setAutoDeployEnabled(checked);
                handleAutoDeployToggle(checked);
              }}
              disabled={saving}
            />
          </div>

          {autoDeployEnabled && (
            <>
              <Separator />

              <div className="space-y-2">
                <Label htmlFor="auto-deploy-branch">Auto-deploy Branch</Label>
                <div className="flex gap-2">
                  <Input
                    id="auto-deploy-branch"
                    value={autoDeployBranch}
                    onChange={(e) => setAutoDeployBranch(e.target.value)}
                    placeholder="main"
                  />
                  <Button onClick={handleSaveAutoDeploy} disabled={saving || autoDeployBranch === project.auto_deploy_branch}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only pushes to this branch will trigger deployments
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/api/github/webhook`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${window.location.origin}/api/github/webhook`, "Webhook URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this URL to your GitHub repository webhooks
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Webhook Secret</Label>
                <div className="flex gap-2">
                  <Input
                    type={showWebhookSecret ? "text" : "password"}
                    value={project.webhook_secret || "Not generated"}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  >
                    {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {project.webhook_secret && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(project.webhook_secret!, "Webhook secret")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Use this secret to verify webhook requests from GitHub
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRegenerateSecret} disabled={saving}>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Regenerate
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* GitHub Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Integration
          </CardTitle>
          <CardDescription>Connect your GitHub repository</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showRepoSelector ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your GitHub account to automatically fetch repository details and branches.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleConnectGitHub} disabled={connectingGitHub}>
                  <Github className="h-4 w-4 mr-2" />
                  {connectingGitHub ? "Connecting..." : "Connect GitHub"}
                </Button>
                <Button variant="outline" onClick={handleConnectGitHub} disabled={connectingGitHub}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Change Repository
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Repository</Label>
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {githubRepos.map((repo) => (
                      <SelectItem key={repo.id} value={repo.full_name}>
                        {repo.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRepo && (
                <div className="p-4 border rounded-lg space-y-2">
                  <p className="text-sm font-medium">Selected Repository</p>
                  <p className="text-sm text-muted-foreground">
                    {githubRepos.find(r => r.full_name === selectedRepo)?.html_url}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Default branch: {githubRepos.find(r => r.full_name === selectedRepo)?.default_branch}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSelectRepo} disabled={!selectedRepo || saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Connecting..." : "Connect Repository"}
                </Button>
                <Button variant="outline" onClick={() => { setShowRepoSelector(false); setSelectedRepo(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-destructive rounded-lg">
            <div>
              <p className="font-medium">Delete Project</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this project, all deployments, environment variables, and activity logs.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project{" "}
              <span className="font-semibold">{project.name}</span> and all associated data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All deployments</li>
                <li>All environment variables</li>
                <li>All activity logs</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
