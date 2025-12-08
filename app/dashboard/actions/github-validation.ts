"use server";

import { createClient } from "@/lib/supabase-server";

export async function validateGitHubRepo(repoUrl: string) {
  try {
    const supabase = await createClient();

    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return { success: false, error: "Unauthorized", needsReauth: false };
    }

    const githubToken = session.provider_token;
    if (!githubToken) {
      return { success: false, error: "GitHub not connected. Please sign in with GitHub.", needsReauth: true };
    }

    // Extract owner/repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return { success: false, error: "Invalid GitHub URL format", needsReauth: false };
    }

    const [, owner, repo] = match;
    const repoName = repo.replace(/\.git$/, "");

    // Check repo exists and get default branch
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (repoResponse.status === 404) {
      return { success: false, error: "Repository not found. Check the URL or your access.", needsReauth: false };
    }

    if (repoResponse.status === 401 || repoResponse.status === 403) {
      return { success: false, error: "GitHub token expired or insufficient permissions. Please reconnect GitHub.", needsReauth: true };
    }

    if (!repoResponse.ok) {
      return { success: false, error: `GitHub API error: ${repoResponse.status}`, needsReauth: false };
    }

    const repoData = await repoResponse.json();

    // Check repo contents
    const contentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!contentsResponse.ok) {
      const errorData = await contentsResponse.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.message || "Cannot access repository contents",
        needsReauth: contentsResponse.status === 401 || contentsResponse.status === 403
      };
    }

    const contents = await contentsResponse.json();
    const fileNames = Array.isArray(contents) ? contents.map((item: any) => item.name) : [];

    // Check for Next.js project structure
    const hasNextJs = fileNames.includes("app") || fileNames.includes("pages");
    const hasPackageJson = fileNames.includes("package.json");
    const hasComponents = fileNames.includes("components");

    return {
      success: true,
      data: {
        owner,
        repo: repoName,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        isEmpty: fileNames.length === 0,
        hasNextJs,
        hasPackageJson,
        hasComponents,
        files: fileNames,
        isValidNextJsProject: hasNextJs && hasPackageJson,
      },
      needsReauth: false,
    };
  } catch (error) {
    return { success: false, error: "Failed to validate repository", needsReauth: false };
  }
}
