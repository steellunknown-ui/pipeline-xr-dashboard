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
import { getProjectById, updateProject, deleteProject, getGitHubRepos, updateProjectAutoDeploy, regenerateWebhookSecret, updateProjectWebhookUrl } from "@/app/dashboard/actions";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import type { Project } from "@/lib/types/database";
import { GradientBar } from "@/components/ui/gradient-bar";
import { getGitHubConnectionState } from "@/lib/github-provider-guard";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { connectRepoToProject, disconnectRepo } from "@/app/dashboard/actions/github";
import { GitHubRepoSelector } from "@/components/github-repo-selector";

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

// Recent Deployments Component - Step 2.3
function RecentDeployments({ projectId }: { projectId: string }) {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, [projectId]);

  async function fetchDeployments() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/deployments?limit=5`);
      const data = await response.json();

      if (response.ok && data.success) {
        setDeployments(data.deployments || []);
      } else {
        setError(data.error || "Failed to load deployments");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        {error}
      </div>
    );
  }

  if (!deployments || deployments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No deployments yet
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Commit</th>
            <th className="text-left p-3 font-medium">Source</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-left p-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((deployment) => (
            <tr key={deployment.id} className="border-b last:border-b-0 hover:bg-muted/50">
              <td className="p-3">
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {deployment.commit_sha?.substring(0, 7) || deployment.commit_hash?.substring(0, 7) || "N/A"}
                </code>
              </td>
              <td className="p-3">
                <span className="text-xs">
                  {deployment.source || (deployment.commit_sha || deployment.commit_hash ? "github" : "manual")}
                </span>
              </td>
              <td className="p-3">
                <span className={`text-xs px-2 py-1 rounded-full ${deployment.status === "completed" ? "bg-green-100 text-green-700" :
                  deployment.status === "failed" ? "bg-red-100 text-red-700" :
                    deployment.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                      deployment.status === "queued" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-700"
                  }`}>
                  {deployment.status}
                </span>
              </td>
              <td className="p-3 text-xs text-muted-foreground">
                {new Date(deployment.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fixingUrls, setFixingUrls] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [autoDeployEnabled, setAutoDeployEnabled] = useState(false);
  const [autoDeployBranch, setAutoDeployBranch] = useState("main");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [checkingGitHub, setCheckingGitHub] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    github_repo_url: "",
  });

  useEffect(() => {
    fetchProject();
    checkGitHubConnection();
  }, [projectId]);

  const checkGitHubConnection = async () => {
    setCheckingGitHub(true);
    const state = await getGitHubConnectionState();
    setIsGitHubConnected(state.isConnected);
    setCheckingGitHub(false);
  };

  const handleConnectGitHub = async () => {
    try {
      const response = await fetch('/api/github/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!result.success) {
        if (result.error_code === 'PROVIDER_MISMATCH') {
          setShowProviderModal(true);
          return;
        }
        toast.error(result.error || 'Failed to connect GitHub');
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('GitHub connection error:', error);
      toast.error('Failed to initiate GitHub connection');
    }
  };

  async function fetchProject() {
    setLoading(true);
    const result = await getProjectById(projectId);
    if (result.success && result.data) {
      setProject(result.data);
      setFormData({
        name: result.data.name,
        github_repo_url: result.data.github_repo_url,
      });
      setAutoDeployEnabled(result.data.webhook_enabled);
      setAutoDeployBranch(result.data.auto_deploy_branch || "main");
      setWebhookUrl((result.data as any).webhook_url || `${window.location.origin}/api/github/webhook`);
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

  const handleConnectRepo = async (repoFullName: string, repoUrl: string, branch: string) => {
    const result = await connectRepoToProject(projectId, repoFullName, repoUrl, branch);
    if (result.success) {
      toast.success("Repository connected successfully");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to connect repository");
    }
  };

  const handleDisconnectRepo = async () => {
    const result = await disconnectRepo(projectId);
    if (result.success) {
      toast.success("Repository disconnected");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to disconnect repository");
    }
  };

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

  async function handleSaveWebhookUrl() {
    if (!webhookUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    setSaving(true);
    const result = await updateProjectWebhookUrl(projectId, webhookUrl);
    if (result.success) {
      toast.success("Webhook URL updated");
      fetchProject();
    } else {
      toast.error(result.error || "Failed to update webhook URL");
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
      <GradientBar />
      {/* GitHub Provider Modal */}
      <GitHubProviderModal
        open={showProviderModal}
        onOpenChange={setShowProviderModal}
      />

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

      {/* Source Repository */}
      <Card>
        <CardHeader>
          <CardTitle>Source Repository</CardTitle>
          <CardDescription>Connect a GitHub repository to deploy from</CardDescription>
        </CardHeader>
        <CardContent>
          <GitHubRepoSelector 
            projectId={projectId}
            currentRepo={(project as any).github_repo_full_name}
            onConnect={handleConnectRepo}
            onDisconnect={handleDisconnectRepo}
          />
        </CardContent>
      </Card>

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
          {!isGitHubConnected ? (
            <Alert>
              <Github className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>GitHub connection required to enable auto-deploy</span>
                <Button size="sm" onClick={handleConnectGitHub} disabled={checkingGitHub}>
                  <Github className="h-4 w-4 mr-2" />
                  Connect GitHub
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Label>Enable Auto-Deploy</Label>
                    {autoDeployEnabled ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-600"></span>
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically trigger deployments when code is pushed to GitHub
                  </p>
                </div>
                <Switch
                  checked={autoDeployEnabled}
                  onCheckedChange={async (checked) => {
                    setAutoDeployEnabled(checked);
                    setSaving(true);
                    try {
                      const result = await updateProjectAutoDeploy(projectId, checked, autoDeployBranch);
                      if (result.success) {
                        toast.success(checked ? "Auto-deploy enabled" : "Auto-deploy disabled");
                        fetchProject();
                      } else {
                        toast.error(result.error || "Failed to update auto-deploy");
                        setAutoDeployEnabled(!checked);
                      }
                    } catch (error) {
                      toast.error("Network error. Please try again.");
                      setAutoDeployEnabled(!checked);
                    }
                    setSaving(false);
                  }}
                  disabled={saving}
                />
              </div>

              {autoDeployEnabled && (
                <>
                  <Separator />

                  {/* Success message - Step 2.2 */}
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-sm text-green-800">
                      ✓ Auto-deploy is active. Push to <span className="font-mono font-semibold">{autoDeployBranch}</span> to trigger deployment.
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Deployments will be triggered only for the configured branch.
                    </p>
                  </div>

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
                      <Button
                        onClick={async () => {
                          setSaving(true);
                          try {
                            // Update branch by re-enabling with new branch
                            const response = await fetch(`/api/projects/${projectId}/webhooks`, {
                              method: "DELETE",
                            });
                            if (response.ok) {
                              const createResponse = await fetch(`/api/projects/${projectId}/webhooks`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ branch: autoDeployBranch }),
                              });
                              const data = await createResponse.json();
                              if (createResponse.ok && data.success) {
                                toast.success("Auto-deploy branch updated");
                                fetchProject();
                              } else {
                                toast.error(data.error || "Failed to update branch");
                              }
                            }
                          } catch (error) {
                            toast.error("Network error");
                          }
                          setSaving(false);
                        }}
                        disabled={saving || autoDeployBranch === project.auto_deploy_branch}
                      >
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
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="webhook-url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://your-domain.com/api/github/webhook"
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleSaveWebhookUrl} disabled={saving || webhookUrl === (project as any).webhook_url}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add this URL to your GitHub repository webhooks. Use ngrok URL for local development.
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Deployments - Step 2.3 */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>View your latest deployments</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentDeployments projectId={projectId} />
        </CardContent>
      </Card>



      {/* Maintenance Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>System utilities and synchronization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Fix Production URLs</p>
              <p className="text-sm text-muted-foreground">
                Backfill missing production alias URLs and screenshots for older deployments.
              </p>
            </div>
            <Button 
              variant="outline" 
              disabled={fixingUrls}
              onClick={async () => {
                setFixingUrls(true);
                toast.loading("Running URL backfill...", { id: "backfill-toast" });
                try {
                  const res = await fetch("/api/fix-alias-urls", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(`Fixed ${data.fixed} deployments · Failed ${data.failed}`, { id: "backfill-toast" });
                  } else {
                    toast.error(data.error || "Failed to backfill URLs", { id: "backfill-toast" });
                  }
                } catch (e) {
                  toast.error("Network error during backfill", { id: "backfill-toast" });
                } finally {
                  setFixingUrls(false);
                }
              }}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${fixingUrls ? 'animate-spin' : ''}`} />
              Fix URLs
            </Button>
          </div>
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
              <span className="block mt-2 space-y-1">
                <span className="block">• All deployments</span>
                <span className="block">• All environment variables</span>
                <span className="block">• All activity logs</span>
              </span>
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
