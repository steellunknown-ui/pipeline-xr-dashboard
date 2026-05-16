import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { Octokit } from "@octokit/rest";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has GitHub identity (primary or linked)
    const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
    if (!hasGitHubIdentity) {
      return NextResponse.json({
        success: false,
        error_code: 'PROVIDER_MISMATCH',
        error: "To connect GitHub, please sign up or log in using a GitHub account.",
        signup_url: 'https://github.com/signup',
        needsReauth: true
      }, { status: 403 });
    }

    // Get GitHub access token from session (where Supabase stores OAuth tokens)
    const { data: { session } } = await supabase.auth.getSession();
    let githubToken = session?.provider_token;

    // Fallback: try to get token from GitHub identity
    if (!githubToken) {
      const githubIdentity = user.identities?.find(
        (identity: any) => identity.provider === 'github'
      );
      // The access_token might be stored in identity_data for some Supabase configurations
      githubToken = githubIdentity?.identity_data?.access_token;
    }

    if (!githubToken) {
      return NextResponse.json({
        success: false,
        error: "GitHub token not available. Please reconnect your GitHub account.",
        needsReauth: true
      }, { status: 401 });
    }

    const octokit = new Octokit({ auth: githubToken });
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      affiliation: "owner,collaborator"
    });

    const repositories = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at,
      language: repo.language,
      private: repo.private,
      owner: {
        login: repo.owner?.login || "",
      },
    }));

    return NextResponse.json({ success: true, repositories }, { status: 200 });
  } catch (err: any) {
    console.error("GitHub API error:", err);
    if (err.status === 401 || err.status === 403) {
      return NextResponse.json({
        success: false,
        error: "GitHub token expired. Please re-authenticate.",
        needsReauth: true
      }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "GitHub API failed" }, { status: 500 });
  }
}