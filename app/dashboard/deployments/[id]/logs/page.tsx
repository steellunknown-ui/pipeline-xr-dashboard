"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Terminal } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { toast } from "sonner";
import type { DeploymentLog } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export default function DeploymentLogsPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [deployment, setDeployment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`deployment_logs:${deploymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deployment_logs',
          filter: `deployment_id=eq.${deploymentId}`,
        },
        (payload) => {
          setLogs((prev) => [...prev, payload.new as DeploymentLog]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deploymentId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  async function fetchData() {
    setLoading(true);
    
    const [logsRes, deploymentRes] = await Promise.all([
      supabase
        .from('deployment_logs')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('deployments')
        .select('*, projects(name)')
        .eq('id', deploymentId)
        .single(),
    ]);

    if (logsRes.data) setLogs(logsRes.data);
    if (deploymentRes.data) setDeployment(deploymentRes.data);
    if (logsRes.error || deploymentRes.error) toast.error('Failed to load logs');
    setLoading(false);
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success": return "text-green-500";
      case "error": return "text-red-500";
      case "warning": return "text-yellow-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-500">Completed</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "in_progress": return <Badge className="bg-blue-500">Running</Badge>;
      case "queued": return <Badge variant="outline">Queued</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/deployments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Deployment Logs</h1>
          {deployment && (
            <p className="text-muted-foreground mt-1">
              {deployment.projects?.name} • {deployment.branch} • {deployment.environment}
            </p>
          )}
        </div>
        {deployment && getStatusBadge(deployment.status)}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-4 w-4" />
          <h3 className="font-semibold">Build Output</h3>
        </div>
        
        <div className="bg-black rounded-lg p-4 font-mono text-sm max-h-[600px] overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full bg-gray-800" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-gray-500">No logs yet. Click Run to start deployment.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-3 py-1">
                <span className="text-gray-500 text-xs">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <span className={cn("flex-1", getLevelColor(log.level))}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </Card>

      {deployment && (
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{deployment.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Environment</p>
              <p className="font-medium capitalize">{deployment.environment}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Branch</p>
              <p className="font-medium font-mono">{deployment.branch}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(deployment.created_at).toLocaleString()}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
