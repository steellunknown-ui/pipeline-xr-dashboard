import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { repoFullName } = body;
    
    if (!repoFullName) {
      return NextResponse.json(
        { error: "repoFullName is required" },
        { status: 400 }
      );
    }

    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      console.warn("VERCEL_TOKEN is not configured");
      return NextResponse.json({ alreadyDeployed: false });
    }

    // Call Vercel API v10 with pagination limit
    const response = await fetch("https://api.vercel.com/v10/projects?limit=100", {
      headers: {
        Authorization: `Bearer ${vercelToken}`,
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.warn(`Vercel API error: ${response.status}`);
      return NextResponse.json({ alreadyDeployed: false });
    }

    const data = await response.json();
    const projects = data.projects || [];
    
    const [owner, repoName] = repoFullName.split('/');
    
    const match = projects.find((project: any) => {
      const link = project.link;
      if (!link) return false;
      
      // Method 1: construct full_name from org + repo
      if (link.org && link.repo) {
        const vercelFullName = `${link.org}/${link.repo}`;
        if (vercelFullName.toLowerCase() === repoFullName.toLowerCase()) return true;
      }
      
      // Method 2: match against repoUrl directly
      if (link.repoUrl) {
        const urlRepoFullName = link.repoUrl
          .replace('https://github.com/', '')
          .replace(/\/$/, '');
        if (urlRepoFullName.toLowerCase() === repoFullName.toLowerCase()) return true;
      }
      
      // Method 3: match repo name + org separately (case-insensitive)
      if (link.repo?.toLowerCase() === repoName?.toLowerCase() && 
          link.org?.toLowerCase() === owner?.toLowerCase()) {
        return true;
      }
      
      return false;
    });

    if (match) {
      const projectUrl = match.alias?.[0]?.domain 
        ? `https://${match.alias[0].domain}`
        : `https://${match.name}.vercel.app`;
        
      return NextResponse.json({
        alreadyDeployed: true,
        platform: "Vercel",
        projectName: match.name,
        url: projectUrl,
      });
    }
    
    return NextResponse.json({ alreadyDeployed: false });
  } catch (error) {
    console.error("Error checking Vercel deployments:", error);
    return NextResponse.json({ alreadyDeployed: false });
  }
}
