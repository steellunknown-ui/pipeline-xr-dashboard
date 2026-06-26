"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Github, Loader2, Search, TriangleAlert, Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
  language: string | null;
}

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

interface GitHubRepoSelectorProps {
  projectId: string;
  currentRepo?: string | null;
  onConnect: (repoFullName: string, repoUrl: string, branch: string) => void;
  onDisconnect: () => void;
}

export function GitHubRepoSelector({
  projectId,
  currentRepo,
  onConnect,
  onDisconnect
}: GitHubRepoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Repos state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection state
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  
  // Branches state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Vercel conflict state
  const [vercelConflict, setVercelConflict] = useState<{
    alreadyDeployed: boolean;
    projectName?: string;
  } | null>(null);
  
  // Connecting status
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch repos when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchRepos();
      resetSelection();
    }
  }, [isOpen]);

  const resetSelection = () => {
    setSelectedRepo(null);
    setSelectedBranch("");
    setBranches([]);
    setVercelConflict(null);
    setSearchQuery("");
  };

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401 && data.error === "GitHub session expired. Please sign out and sign in again with GitHub to restore repo access.") {
          toast.error(data.error, { duration: 10000 });
          setIsOpen(false);
          return;
        }
        throw new Error(data.error || "Failed to fetch repositories");
      }
      
      if (Array.isArray(data)) {
        setRepos(data);
      } else if (data.data) {
        setRepos(data.data);
      } else {
        setRepos([]);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch repositories");
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch); // Set default first
    
    // Fetch branches and check Vercel conflict in parallel
    setLoadingBranches(true);
    setVercelConflict(null);
    
    try {
      const [owner, repoName] = repo.full_name.split("/");
      
      const [branchesRes, vercelRes] = await Promise.all([
        fetch(`/api/github/repos/${owner}/${repoName}/branches`),
        fetch("/api/github/check-deployed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoFullName: repo.full_name })
        })
      ]);
      
      // Handle Branches response
      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        setBranches(branchesData);
      } else if (branchesRes.status === 401) {
         const errorData = await branchesRes.json();
         if (errorData.error === "GitHub session expired. Please sign out and sign in again with GitHub to restore repo access.") {
             toast.error(errorData.error);
         }
      }
      
      // Handle Vercel conflict response
      if (vercelRes.ok) {
        const vercelData = await vercelRes.json();
        if (vercelData.alreadyDeployed) {
          setVercelConflict({
            alreadyDeployed: true,
            projectName: vercelData.projectName
          });
        }
      }
    } catch (error) {
      console.error("Error fetching repo details", error);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedRepo || !selectedBranch) return;
    
    setIsConnecting(true);
    try {
      await onConnect(selectedRepo.full_name, selectedRepo.html_url, selectedBranch);
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to connect repository");
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredRepos = useMemo(() => {
    if (!searchQuery) return repos;
    const lowerQuery = searchQuery.toLowerCase();
    return repos.filter(r => 
      r.full_name.toLowerCase().includes(lowerQuery) || 
      (r.description && r.description.toLowerCase().includes(lowerQuery))
    );
  }, [repos, searchQuery]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  if (currentRepo) {
    return (
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md text-primary">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium flex items-center gap-2">
                {currentRepo}
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Connected
                </Badge>
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Automatically syncing code changes
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Change Repo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Connect Repository</DialogTitle>
                  <DialogDescription>
                    Select a GitHub repository to connect to your Pipeline XR project.
                  </DialogDescription>
                </DialogHeader>
                
                {/* Repos List View */}
                {!selectedRepo ? (
                  <div className="flex flex-col space-y-4">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search repositories..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <ScrollArea className="h-[400px] border rounded-md">
                      {loadingRepos ? (
                        <div className="p-4 space-y-4">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex flex-col gap-2">
                              <Skeleton className="h-5 w-1/3" />
                              <Skeleton className="h-4 w-2/3" />
                            </div>
                          ))}
                        </div>
                      ) : filteredRepos.length > 0 ? (
                        <div className="divide-y">
                          {filteredRepos.map((repo) => (
                            <div 
                              key={repo.id}
                              className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleSelectRepo(repo)}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold">{repo.name}</p>
                                  {repo.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                      {repo.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <div className={`w-2 h-2 rounded-full ${repo.language ? "bg-primary" : "bg-muted"}`} />
                                      {repo.language || "Unknown"}
                                    </span>
                                    <span>•</span>
                                    <span>Updated {formatDate(repo.updated_at)}</span>
                                  </div>
                                </div>
                                <Badge variant={repo.private ? "secondary" : "outline"}>
                                  {repo.private ? "Private" : "Public"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          No repositories found.
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                ) : (
                  // Repo Configuration View
                  <div className="flex flex-col space-y-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Github className="w-5 h-5" />
                          {selectedRepo.full_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Configure branch settings for deployment
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRepo(null)}>
                        Change
                      </Button>
                    </div>

                    {vercelConflict?.alreadyDeployed && (
                      <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-900">
                        <TriangleAlert className="h-4 w-4 stroke-yellow-600" />
                        <AlertTitle className="text-yellow-800">Potential Conflict</AlertTitle>
                        <AlertDescription className="text-yellow-700">
                          This repo is already deployed on Vercel as <strong>{vercelConflict.projectName}</strong>. Connecting will still work but deployments may conflict.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-3">
                      <label className="text-sm font-medium">Production Branch</label>
                      {loadingBranches ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <Select 
                          value={selectedBranch} 
                          onValueChange={setSelectedBranch}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.name} value={branch.name}>
                                {branch.name} {branch.name === selectedRepo.default_branch && "(Default)"}
                              </SelectItem>
                            ))}
                            {branches.length === 0 && (
                              <SelectItem value={selectedRepo.default_branch}>
                                {selectedRepo.default_branch} (Default)
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs text-muted-foreground">
                        We will deploy whenever you push to this branch.
                      </p>
                    </div>
                  </div>
                )}
                
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  {selectedRepo && (
                    <Button 
                      onClick={handleConnect} 
                      disabled={isConnecting || !selectedBranch}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => onDisconnect()}
            >
              <Link2Off className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Github className="w-4 h-4 mr-2" />
          Connect Repository
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Repository</DialogTitle>
          <DialogDescription>
            Select a GitHub repository to connect to your Pipeline XR project.
          </DialogDescription>
        </DialogHeader>
        
        {/* Repos List View */}
        {!selectedRepo ? (
          <div className="flex flex-col space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <ScrollArea className="h-[400px] border rounded-md">
              {loadingRepos ? (
                <div className="p-4 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : filteredRepos.length > 0 ? (
                <div className="divide-y">
                  {filteredRepos.map((repo) => (
                    <div 
                      key={repo.id}
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleSelectRepo(repo)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{repo.name}</p>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${repo.language ? "bg-primary" : "bg-muted"}`} />
                              {repo.language || "Unknown"}
                            </span>
                            <span>•</span>
                            <span>Updated {formatDate(repo.updated_at)}</span>
                          </div>
                        </div>
                        <Badge variant={repo.private ? "secondary" : "outline"}>
                          {repo.private ? "Private" : "Public"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No repositories found.
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          // Repo Configuration View
          <div className="flex flex-col space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  {selectedRepo.full_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configure branch settings for deployment
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRepo(null)}>
                Change
              </Button>
            </div>

            {vercelConflict?.alreadyDeployed && (
              <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-900">
                <TriangleAlert className="h-4 w-4 stroke-yellow-600" />
                <AlertTitle className="text-yellow-800">Potential Conflict</AlertTitle>
                <AlertDescription className="text-yellow-700">
                  This repo is already deployed on Vercel as <strong>{vercelConflict.projectName}</strong>. Connecting will still work but deployments may conflict.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium">Production Branch</label>
              {loadingBranches ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select 
                  value={selectedBranch} 
                  onValueChange={setSelectedBranch}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name} {branch.name === selectedRepo.default_branch && "(Default)"}
                      </SelectItem>
                    ))}
                    {branches.length === 0 && (
                      <SelectItem value={selectedRepo.default_branch}>
                        {selectedRepo.default_branch} (Default)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                We will deploy whenever you push to this branch.
              </p>
            </div>
          </div>
        )}
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {selectedRepo && (
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting || !selectedBranch}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
