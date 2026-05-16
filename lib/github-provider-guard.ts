import { supabase } from "@/lib/supabase-browser";

export interface GitHubConnectionState {
  isConnected: boolean;
  username?: string;
  error?: string;
}

export async function getGitHubConnectionState(): Promise<GitHubConnectionState> {
  try {
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { isConnected: false, error: "Not authenticated" };
    }

    // Check if user has GitHub identity (either primary or linked)
    const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
    
    if (!hasGitHubIdentity) {
      return { isConnected: false };
    }

    // Get GitHub username from user metadata
    const githubIdentity = user.identities?.find(identity => identity.provider === 'github');
    const username = githubIdentity?.identity_data?.user_name || githubIdentity?.identity_data?.login;

    return { isConnected: true, username };
  } catch (error) {
    return { isConnected: false, error: "Failed to check GitHub connection" };
  }
}

export async function checkGitHubProvider(): Promise<{
  hasGitHubProvider: boolean;
  error?: string;
}> {
  try {
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { hasGitHubProvider: false, error: "Not authenticated" };
    }

    const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
    return { hasGitHubProvider: !!hasGitHubIdentity };
  } catch (error) {
    return { hasGitHubProvider: false, error: "Failed to check provider" };
  }
}
