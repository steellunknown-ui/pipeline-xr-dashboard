"use server";

import { getSupabaseServer } from "@/lib/supabase-server";

export async function connectRepoToProject(
  projectId: string,
  repoFullName: string,
  repoUrl: string,
  defaultBranch: string,
  repoId?: number,
  owner?: string,
  framework?: string
) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }
    
    const { error } = await supabase
      .from("projects")
      .update({
        github_repo_full_name: repoFullName,
        github_repo_url: repoUrl,
        github_default_branch: defaultBranch,
        github_connected_at: new Date().toISOString(),
        github_repo_id: repoId,
        github_owner: owner,
        framework: framework,
      })
      .eq("id", projectId)
      .eq("user_id", user.id);
      
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Error connecting repo to project:", error);
    return { success: false, error: error.message || "An unexpected error occurred" };
  }
}

export async function disconnectRepo(projectId: string) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }
    
    const { error } = await supabase
      .from("projects")
      .update({
        github_repo_full_name: null,
        github_repo_url: null,
        github_default_branch: null,
        github_connected_at: null,
      })
      .eq("id", projectId)
      .eq("user_id", user.id);
      
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Error disconnecting repo:", error);
    return { success: false, error: error.message || "An unexpected error occurred" };
  }
}
