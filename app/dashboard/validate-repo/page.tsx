"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateGitHubRepo } from "../actions/github-validation";
import { getProjects, updateProject, getGitHubRepos } from "../actions/projects";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Github, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

export default function ValidateRepoPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, any>>({});
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [showRepoChooser, setShowRepoChooser] = useState<string | null>(null);
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const result = await getProjects();
    if (result.success && result.data) {
      setProjects(result.data);
    }
    setLoading(false);
  }

  async function validateProject(projectId: string, repoUrl: string) {
    setValidating(projectId);
    const result = await validateGitHubRepo(repoUrl);
    
    if (result.success && result.data) {
      setValidationResults(prev => ({ ...prev, [projectId]: result.data }));
      
      if (result.data.isValidNextJsProject) {
        toast.success("Repository validated successfully!");
      } else if (result.data.isEmpty) {
        toast.error("Repository is empty!");
      } else {
        toast.warning("Repository doesn't contain a Next.js project structure");
      }
    } else {
      if (result.needsReauth) {
        setNeedsReauth(true);
      }
      toast.error(result.error || "Validation failed");
    }
    
    setValidating(null);
  }

  async function loadGitHubRepos(projectId: string) {
    setLoadingRepos(true);
    setShowRepoChooser(projectId);
    const result = await getGitHubRepos();
    
    if (result.success && result.data) {
      setAvailableRepos(result.data);
    } else {
      if (result.needsReauth) {
        setNeedsReauth(true);
      }
      toast.error(result.error || "Failed to load repositories");
    }
    
    setLoadingRepos(false);
  }

  async function selectRepo(projectId: string, repoUrl: string, defaultBranch: string) {
    const result = await updateProject(projectId, { github_repo_url: repoUrl });
    
    if (result.success) {
      toast.success("Repository updated successfully!");
      setShowRepoChooser(null);
      loadProjects();
      // Auto-validate after selection
      setTimeout(() => validateProject(projectId, repoUrl), 500);
    } else {
      toast.error(result.error || "Failed to update repository");
    }
  }

  async function reconnectGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "repo read:user",
      },
    });
  }

  async function handleUpdateRepo(projectId: string) {
    if (!newRepoUrl.trim()) {
      toast.error("Please enter a repository URL");
      return;
    }

    const result = await updateProject(projectId, { github_repo_url: newRepoUrl });
    
    if (result.success) {
      toast.success("Repository updated successfully!");
      setEditingProject(null);
      setNewRepoUrl("");
      loadProjects();
    } else {
      toast.error(result.error || "Failed to update repository");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Repository Validation</h1>
        <p className="text-muted-foreground mt-2">
          Validate that your projects are connected to the correct GitHub repositories
        </p>
      </div>

      {needsReauth && (
        <Alert>
          <Github className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>GitHub token expired or insufficient permissions. Please reconnect.</span>
            <Button onClick={reconnectGitHub} size="sm">
              <Github className="mr-2 h-4 w-4" />
              Reconnect GitHub
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No projects found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const validation = validationResults[project.id];
            
            return (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription className="mt-2">
                        {showRepoChooser === project.id ? (
                          <div className="space-y-2 mt-2">
                            <Label>Select Repository from GitHub</Label>
                            {loadingRepos ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading repositories...</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Select onValueChange={(value) => {
                                  const repo = availableRepos.find(r => r.html_url === value);
                                  if (repo) selectRepo(project.id, repo.html_url, repo.default_branch);
                                }}>
                                  <SelectTrigger className="max-w-md">
                                    <SelectValue placeholder="Choose a repository" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableRepos.map((repo) => (
                                      <SelectItem key={repo.id} value={repo.html_url}>
                                        {repo.full_name} {repo.private && "🔒"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowRepoChooser(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : editingProject === project.id ? (
                          <div className="space-y-2 mt-2">
                            <Label>New Repository URL</Label>
                            <div className="flex gap-2">
                              <Input
                                value={newRepoUrl}
                                onChange={(e) => setNewRepoUrl(e.target.value)}
                                placeholder="https://github.com/username/repo"
                                className="max-w-md"
                              />
                              <Button onClick={() => handleUpdateRepo(project.id)}>
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingProject(null);
                                  setNewRepoUrl("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {project.github_repo_url}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadGitHubRepos(project.id)}
                            >
                              <Github className="mr-1 h-3 w-3" />
                              Choose Repo
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingProject(project.id);
                                setNewRepoUrl(project.github_repo_url);
                              }}
                            >
                              Manual Edit
                            </Button>
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => validateProject(project.id, project.github_repo_url)}
                      disabled={validating === project.id}
                    >
                      {validating === project.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        "Validate Repository"
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {validation && (
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        {validation.isValidNextJsProject ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : validation.isEmpty ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                        <span className="font-semibold">
                          {validation.isValidNextJsProject
                            ? "Valid Next.js Project"
                            : validation.isEmpty
                            ? "Empty Repository"
                            : "Not a Next.js Project"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Repository:</span>
                          <p className="font-medium">{validation.fullName}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Default Branch:</span>
                          <p className="font-medium">{validation.defaultBranch}</p>
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-sm">Project Structure:</span>
                        <div className="flex gap-2 mt-2">
                          <Badge variant={validation.hasPackageJson ? "default" : "secondary"}>
                            {validation.hasPackageJson ? "✓" : "✗"} package.json
                          </Badge>
                          <Badge variant={validation.hasNextJs ? "default" : "secondary"}>
                            {validation.hasNextJs ? "✓" : "✗"} app/pages
                          </Badge>
                          <Badge variant={validation.hasComponents ? "default" : "secondary"}>
                            {validation.hasComponents ? "✓" : "✗"} components
                          </Badge>
                        </div>
                      </div>

                      {validation.files.length > 0 && (
                        <div>
                          <span className="text-muted-foreground text-sm">Root Files:</span>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {validation.files.slice(0, 10).map((file: string) => (
                              <Badge key={file} variant="outline" className="text-xs">
                                {file}
                              </Badge>
                            ))}
                            {validation.files.length > 10 && (
                              <Badge variant="outline" className="text-xs">
                                +{validation.files.length - 10} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {validation.isValidNextJsProject && project.webhook_secret && (
                        <div className="border-t pt-4">
                          <span className="text-muted-foreground text-sm">Webhook Configuration:</span>
                          <div className="mt-2 space-y-2">
                            <div>
                              <Label className="text-xs">Webhook URL</Label>
                              <code className="block text-xs bg-muted px-2 py-1 rounded mt-1">
                                {window.location.origin}/api/github/webhook
                              </code>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Configure this in GitHub: Settings → Webhooks → Add webhook
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

