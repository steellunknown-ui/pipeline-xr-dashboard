"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitBranch, Github, AlertCircle, TriangleAlert, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { createProjectFromGitHub } from "@/app/dashboard/actions/projects";
import { triggerVercelDeploy } from "@/app/dashboard/actions/deployments";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { addEnvVariable } from "@/app/dashboard/actions/environment";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  updated_at: string;
  language: string | null;
  private: boolean;
  owner: {
    login: string;
  };
}

export function GitHubRepoSelector() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [conflictRepo, setConflictRepo] = useState<Repository | null>(null);
  const [hasGitHubAuth, setHasGitHubAuth] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const router = useRouter();
  
  // Vercel-Style Deployment Wizard States
  const [newProject, setNewProject] = useState<any>(null);
  const [showEnvPrompt, setShowEnvPrompt] = useState(false);
  const [showEnvEditor, setShowEnvEditor] = useState(false);
  const [envInput, setEnvInput] = useState("");
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    checkGitHubAuth();
  }, []);

  const checkGitHubAuth = async () => {
    try {
      setCheckingAuth(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasGitHubAuth(false);
        setLoading(false);
        return;
      }

      // Check if user has GitHub identity
      const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
      
      if (hasGitHubIdentity) {
        // Get session for provider token
        const { data: { session } } = await supabase.auth.getSession();
        const hasToken = !!session?.provider_token;
        setHasGitHubAuth(hasToken);
        
        if (hasToken) {
          fetchRepositories();
        } else {
          setLoading(false);
        }
      } else {
        setHasGitHubAuth(false);
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to check GitHub auth:", error);
      setHasGitHubAuth(false);
      setLoading(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const connectGitHub = async () => {
    try {
      // Client-side cookie is bulletproof for the callback route to read
      document.cookie = "github_return_url=/dashboard/projects/github; path=/; max-age=300; SameSite=Lax";

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

  const fetchRepositories = async () => {
    try {
      const response = await fetch("/api/github/repos");
      const data = await response.json();
      
      if (!response.ok) {
        // Handle provider mismatch specifically
        if (data.error_code === 'PROVIDER_MISMATCH') {
          setShowProviderModal(true);
          setLoading(false);
          return;
        }
        
        if (data.needsReauth) {
          setHasGitHubAuth(false);
        }
        
        toast.error(data.error || "Failed to load repositories");
        setLoading(false);
        return;
      }
      
      // API returns a plain array
      setRepositories(Array.isArray(data) ? data : (data.repositories || []));
      
      // Fetch existing projects
      const { data: projects } = await supabase
        .from('projects')
        .select('github_repo_url')
        .not('github_repo_url', 'is', null);
      
      setExistingProjects(projects?.map(p => p.github_repo_url) || []);
      
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
      toast.error("Failed to load repositories");
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (repo: Repository) => {
    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    setCreating(repo.id);
    try {
      const result = await createProjectFromGitHub({
        name: projectName,
        full_name: repo.full_name,
        owner: repo.owner,
        default_branch: repo.default_branch,
      });

      if (result.success && result.data) {
        toast.success(`✅ Project "${projectName}" created successfully!`);
        setNewProject(result.data);
        setShowEnvPrompt(true);
      } else {
        if (result.isDuplicate) {
          toast.error(`Project already exists for ${repo.full_name}`);
        } else {
          toast.error(result.error || "Failed to create project");
        }
      }
    } catch (error) {
      toast.error("Failed to create project");
    } finally {
      setCreating(null);
    }
  };

  const handleSaveEnvsAndDeploy = async () => {
    if (!newProject) return;
    setDeploying(true);

    try {
      // Parse .env input
      if (envInput.trim()) {
        const lines = envInput.split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            // Strip quotes if any
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            
            await addEnvVariable({
              key,
              value,
              environment: "production",
              project_id: newProject.id
            });
          }
        }
        toast.success("Environment variables saved!");
      }
      
      await handleDeployNow();
    } catch (error) {
      toast.error("Failed to save environment variables");
      setDeploying(false);
    }
  };

  const handleDeployNow = async () => {
    if (!newProject) return;
    setDeploying(true);
    try {
      const result = await triggerVercelDeploy({
        projectId: newProject.id,
        environment: "production",
        branch: newProject.auto_deploy_branch || selectedRepo?.default_branch || "main"
      });

      if (result.success && result.data) {
        toast.success("Deployment started!");
        router.push(`/dashboard/deployments/${result.data.id}/logs`);
      } else {
        toast.error(result.error || "Failed to start deployment");
        setDeploying(false);
        router.push(`/dashboard/projects/${newProject.id}/settings`);
      }
    } catch (error) {
      toast.error("Failed to start deployment");
      setDeploying(false);
      router.push(`/dashboard/projects/${newProject.id}/settings`);
    }
  };

  if (checkingAuth || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show connect GitHub message if not authenticated
  if (!hasGitHubAuth) {
    return (
      <div className="space-y-6">
        {/* GitHub Provider Mismatch Modal */}
        <GitHubProviderModal
          open={showProviderModal}
          onOpenChange={setShowProviderModal}
        />

        <div>
          <h2 className="text-2xl font-bold">Import from GitHub</h2>
          <p className="text-muted-foreground">
            Connect your GitHub account to import repositories
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">GitHub Connection Required</h3>
                <p className="text-muted-foreground max-w-md">
                  To connect GitHub, please sign up or log in using a GitHub account.
                </p>
                <a 
                  href="https://github.com/signup" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-sm mt-2 inline-block"
                >
                  Create GitHub Account →
                </a>
              </div>
              <Button onClick={connectGitHub} size="lg" className="mt-4">
                <Github className="h-5 w-5 mr-2" />
                Connect GitHub OAuth
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GitHub Provider Mismatch Modal */}
      <GitHubProviderModal
        open={showProviderModal}
        onOpenChange={setShowProviderModal}
      />

      {/* Vercel-Style Env Setup Popup (Black & White Theme) */}
      <Dialog open={showEnvPrompt} onOpenChange={(o) => {
        if (!o && !deploying) {
          setShowEnvPrompt(false);
          router.push(`/dashboard/projects`);
        }
      }}>
        <DialogContent className="max-w-md bg-black text-white border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-zinc-300" />
              </div>
              Ready to Deploy
            </DialogTitle>
            <DialogDescription className="pt-3 text-base text-zinc-400">
              Does your project require <strong>Environment Variables</strong> (e.g. Database URL, API Keys)?
              <br/><br/>
              If yes, click Yes to configure them now. Otherwise, we can deploy immediately!
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:space-x-0">
            <Button 
              variant="outline" 
              className="w-full sm:w-1/2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white" 
              disabled={deploying}
              onClick={() => {
                 setShowEnvPrompt(false);
                 router.push(`/dashboard/projects/${newProject?.id}`);
              }}
            >
              Yes, Configure ENVs
            </Button>
            <Button 
              className="w-full sm:w-1/2 bg-white text-black hover:bg-zinc-200 border-0" 
              onClick={handleDeployNow}
              disabled={deploying}
            >
              {deploying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deploying...</>
              ) : (
                "No, Deploy Now 🚀"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Already Deployed Conflict Modal */}
      <Dialog open={!!conflictRepo} onOpenChange={(o) => !o && setConflictRepo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center">
                <TriangleAlert className="w-4 h-4 text-yellow-600" />
              </div>
              Repository Already Deployed
            </DialogTitle>
            <DialogDescription className="pt-2 text-base">
              The repository <strong className="text-foreground">{conflictRepo?.full_name}</strong> is already connected to an existing project in Pipeline XR.
              <br/><br/>
              Please select a different repository or manage the existing project from your dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="default" onClick={() => setConflictRepo(null)}>
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h2 className="text-2xl font-bold">Select GitHub Repository</h2>
        <p className="text-muted-foreground">
          Choose a repository to create a new project with auto-deployment
        </p>
      </div>

      {/* Black & White Create Project Popup */}
      <Dialog open={!!selectedRepo && !showEnvPrompt} onOpenChange={(o) => !o && setSelectedRepo(null)}>
        <DialogContent className="max-w-md bg-black text-white border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Create Project</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Configure your project for {selectedRepo?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-zinc-300">Project Name</Label>
              <Input
                id="projectName"
                className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-zinc-700"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button 
              variant="outline" 
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white flex-1" 
              onClick={() => setSelectedRepo(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-white text-black hover:bg-zinc-200 flex-1"
              onClick={() => selectedRepo && createProject(selectedRepo)}
              disabled={creating === selectedRepo?.id || !projectName.trim()}
            >
              {creating === selectedRepo?.id ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {repositories.map((repo) => (
          <Card key={repo.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{repo.name}</h3>
                    {repo.private && <Badge variant="secondary">Private</Badge>}
                    {repo.language && <Badge variant="outline">{repo.language}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{repo.full_name}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {repo.default_branch}
                    </div>
                    <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const repoUrl = `https://github.com/${repo.full_name}`;
                    if (existingProjects.includes(repoUrl)) {
                      setConflictRepo(repo);
                    } else {
                      setSelectedRepo(repo);
                      setProjectName(repo.name);
                    }
                  }}
                  disabled={creating !== null}
                  variant={existingProjects.includes(`https://github.com/${repo.full_name}`) ? "secondary" : "default"}
                >
                  {existingProjects.includes(`https://github.com/${repo.full_name}`) ? "Already Deployed" : "Select"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {repositories.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No repositories found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
