"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock } from "lucide-react";
import { getDeploymentLogs } from "../../actions/deployment-pipeline";
import { toast } from "sonner";
import type { ActivityLog } from "@/lib/types/database";

export default function DeploymentLogsPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      const result = await getDeploymentLogs(deploymentId);
      if (result.success) {
        setLogs(result.data || []);
      } else {
        toast.error(result.error || "Failed to fetch deployment logs");
      }
      setLoading(false);
    }
    fetchLogs();
  }, [deploymentId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Deployment Logs</h1>
          <p className="text-muted-foreground mt-1">Deployment ID: {deploymentId.slice(0, 8)}</p>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Log Stream</h3>
        </div>
        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No logs found for this deployment</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="capitalize">
                    {log.event_type.replace(/_/g, " ")}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
                <p className="text-sm">{log.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
