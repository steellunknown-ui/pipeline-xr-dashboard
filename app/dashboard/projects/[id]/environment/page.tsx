import { redirect } from "next/navigation";
import { getProjectById } from "@/app/dashboard/actions/projects";
import { EnvironmentVariablesPanel } from "@/components/deployment/EnvironmentVariablesPanel";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ProjectEnvironmentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const result = await getProjectById(resolvedParams.id);

  if (!result.success || !result.data) {
    redirect("/dashboard/projects");
  }

  const project = result.data;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/projects/${project.id}`}>
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Environment Variables</h1>
          <p className="text-muted-foreground mt-1">
            Manage environment variables and secrets for {project.name}
          </p>
        </div>
      </div>

      {/* 
        This is now on its own dedicated page with max-w-4xl so it isn't squeezed.
        The UI will look wide, spacious, and much cleaner!
      */}
      <EnvironmentVariablesPanel projectId={project.id} />
    </div>
  );
}
