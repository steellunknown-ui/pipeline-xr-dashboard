"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitBranch, Github, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createProjectFromGitHub } from "@/app/dashboard/actions/projects";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";

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
  const [hasGitHubAuth, setHasGitHubAuth] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const router = useRouter();
  

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
      
      setRepositories(data.repositories || []);
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
        router.push(`/dashboard/projects`);
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

      <div>
        <h2 className="text-2xl font-bold">Select GitHub Repository</h2>
        <p className="text-muted-foreground">
          Choose a repository to create a new project with auto-deployment
        </p>
      </div>

      {selectedRepo && (
        <Card>
          <CardHeader>
            <CardTitle>Project Configuration</CardTitle>
            <CardDescription>
              Configure your project for {selectedRepo.full_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createProject(selectedRepo)}
                disabled={creating === selectedRepo.id || !projectName.trim()}
              >
                {creating === selectedRepo.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
              <Button variant="outline" onClick={() => setSelectedRepo(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                    setSelectedRepo(repo);
                    setProjectName(repo.name);
                  }}
                  disabled={creating !== null}
                >
                  Select
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
