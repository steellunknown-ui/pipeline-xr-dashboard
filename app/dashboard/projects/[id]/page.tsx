import { redirect } from "next/navigation";
import { getProjectById } from "@/app/dashboard/actions/projects";
import { getSupabaseServer } from "@/lib/supabase-server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Activity, Clock, ShieldCheck, Zap, Github } from "lucide-react";
import Link from "next/link";
import { GradientBar } from "@/components/ui/gradient-bar";
import { ProjectHealthMonitor } from "@/components/deployment/ProjectHealthMonitor";
import { DeployButton } from "@/components/deployment/DeployButton";
import { FixChromeBlockingButton } from "@/components/deployment/FixChromeBlockingButton";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const result = await getProjectById(resolvedParams.id);

  if (!result.success || !result.data) {
    redirect("/dashboard/projects");
  }

  const project = result.data;
  
  // Fetch the real deployment URL from the latest successful deployment
  const supabase = await getSupabaseServer();
  const { data: latestDeploy } = await supabase
    .from("deployments")
    .select("deployment_url, alias_url, alias_status, preview_image_url")
    .eq("project_id", project.id)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // ONLY use alias_url or production_alias_url for UI
  const liveUrl = latestDeploy?.alias_url || project.production_alias_url;
  const isPending = latestDeploy?.alias_status === 'pending';
  const isFailed = latestDeploy?.alias_status === 'failed';
  
  // Use pre-generated preview image or fallback
  const previewImage = latestDeploy?.preview_image_url || (liveUrl ? `https://api.microlink.io/?url=${encodeURIComponent(liveUrl)}&screenshot=true&meta=false&embed=screenshot.url` : null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            Healthy & Online
          </p>
        </div>
        <div className="flex gap-2">
          <DeployButton projectId={project.id} />
          <Link href={`/dashboard/projects/${project.id}/settings`}>
            <Button variant="outline">Settings</Button>
          </Link>
          <Button 
            asChild={!!liveUrl} 
            disabled={!liveUrl} 
            className="gap-2 bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {liveUrl ? (
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                Visit Site <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <span className="flex items-center gap-2">
                {isPending ? "Assigning URL..." : "URL Unavailable"}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Massive Preview Box */}
        <Card className="lg:col-span-2 overflow-hidden border-zinc-800 bg-black text-white">
          <GradientBar />
          <CardHeader className="border-b border-zinc-800 bg-zinc-950">
            <CardTitle className="flex justify-between items-center text-white">
              <span>Live Preview</span>
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Production
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full aspect-[16/9] bg-zinc-900 flex items-center justify-center relative group">
               {previewImage ? (
                 <img 
                   src={previewImage} 
                   alt="Project Preview"
                   className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                 />
               ) : (
                 <div className="text-zinc-500 flex flex-col items-center gap-2">
                   {isPending ? (
                     <>
                       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                       <p className="text-sm">Fetching production URL...</p>
                     </>
                   ) : (
                     <p className="text-sm">Preview Unavailable</p>
                   )}
                 </div>
               )}
               <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />
            </div>
            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
               <div className="flex items-center gap-2 text-sm text-zinc-400 font-mono truncate max-w-[80%]">
                 <ExternalLink className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                 {liveUrl ? (
                   <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors truncate">
                     {liveUrl}
                   </a>
                 ) : (
                   <span className="text-zinc-600 italic">
                     {isPending ? "Waiting for Vercel to assign production alias..." : "Production alias could not be fetched."}
                   </span>
                 )}
               </div>
               {project.github_repo_url && (
                 <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer">
                   <Badge variant="outline" className="border-zinc-700 hover:bg-zinc-800 cursor-pointer text-zinc-300">
                     <Github className="w-3 h-3 mr-1" /> Source
                   </Badge>
                 </a>
               )}
            </div>
          </CardContent>
        </Card>

        {/* Health Monitoring Metrics */}
        <div className="space-y-6">
          <ProjectHealthMonitor url={liveUrl} />
          
          <Card className="border-zinc-800 bg-black text-white p-6">
            <h3 className="text-lg font-semibold mb-2">Environment Variables</h3>
            <p className="text-sm text-zinc-400 mb-4">Manage secrets and configuration for this project.</p>
            <Link href={`/dashboard/projects/${project.id}/environment`}>
              <Button variant="outline" className="w-full">Manage Environment</Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
