import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const resolvedParams = await params;
    const { owner, repo } = resolvedParams;
    const supabase = await getSupabaseServer();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }
    
    if (!session.provider_token) {
      return NextResponse.json(
        { error: "GitHub session expired. Please sign out and sign in again with GitHub to restore repo access." },
        { status: 401 }
      );
    }
    
    const provider_token = session.provider_token;
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        Authorization: `token ${provider_token}`,
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "GitHub session expired. Please sign out and sign in again with GitHub to restore repo access." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `GitHub API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const branches = await response.json();
    
    const mappedBranches = branches.map((branch: any) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected
    }));
    
    return NextResponse.json(mappedBranches);
  } catch (error) {
    console.error("Error fetching GitHub branches:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
