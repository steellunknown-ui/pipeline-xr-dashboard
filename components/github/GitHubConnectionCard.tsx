"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getGitHubConnectionState, type GitHubConnectionState } from "@/lib/github-provider-guard";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { GitHubAlreadyLinkedModal } from "@/components/modals/GitHubAlreadyLinkedModal";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";

export function GitHubConnectionCard() {
  const [connectionState, setConnectionState] = useState<GitHubConnectionState>({ isConnected: false });
  const [loading, setLoading] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showAlreadyLinkedModal, setShowAlreadyLinkedModal] = useState(false);
  const [linking, setLinking] = useState(false);
  const router = useRouter();
  

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    const state = await getGitHubConnectionState();
    setConnectionState(state);
    setLoading(false);
  };

  const handleConnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in first");
        return;
      }

      const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
      const hasGoogleIdentity = user.identities?.some(identity => identity.provider === 'google');
      
      // If user has Google but not GitHub, offer to link GitHub
      if (hasGoogleIdentity && !hasGitHubIdentity) {
        setLinking(true);
        
        const response = await fetch('/api/github/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();
        setLinking(false);
        
        if (result.success && result.url) {
          window.location.href = result.url;
        } else if (result.error_code === 'GITHUB_ALREADY_LINKED') {
          setShowAlreadyLinkedModal(true);
        } else {
          toast.error(result.error || 'Failed to link GitHub');
        }
        return;
      }
      
      // If user has neither, show provider modal
      if (!hasGitHubIdentity) {
        setShowProviderModal(true);
        return;
      }

      // If user already has GitHub, initiate OAuth
      const response = await fetch('/api/github/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Failed to connect GitHub');
      }
    } catch (error) {
      setLinking(false);
      toast.error('Failed to initiate GitHub connection');
    }
  };

  const handleImportRepo = () => {
    router.push('/dashboard/projects/github');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-24 animate-pulse" />
              <div className="h-3 bg-muted rounded w-32 animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <GitHubProviderModal
        open={showProviderModal}
        onOpenChange={setShowProviderModal}
      />
      
      <GitHubAlreadyLinkedModal
        open={showAlreadyLinkedModal}
        onOpenChange={setShowAlreadyLinkedModal}
      />
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              connectionState.isConnected ? 'bg-green-100 text-green-600' : 'bg-muted'
            }`}>
              {connectionState.isConnected ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <Github className="h-5 w-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">
                {connectionState.isConnected ? 'GitHub connected' : 'GitHub not connected'}
              </CardTitle>
              <CardDescription>
                {connectionState.isConnected 
                  ? connectionState.username 
                    ? `@${connectionState.username}`
                    : 'Ready to import repositories'
                  : 'Connect GitHub to import repositories and enable auto-deploy'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            onClick={connectionState.isConnected ? handleImportRepo : handleConnect}
            className="w-full"
            variant={connectionState.isConnected ? "default" : "outline"}
            disabled={linking}
          >
            <Github className="mr-2 h-4 w-4" />
            {linking ? 'Connecting...' : connectionState.isConnected ? 'Import Repository' : 'Connect GitHub'}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
