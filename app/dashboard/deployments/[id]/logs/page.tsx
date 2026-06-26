"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Terminal, Rocket, Brain, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { runDeploymentPipeline } from "@/app/dashboard/actions/deployment-pipeline";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { DeploymentLog } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { GradientBar } from "@/components/ui/gradient-bar";
import { DeploymentTimeline } from "@/components/deployment/DeploymentTimeline";
import { DeploymentComparison } from "@/components/deployment/DeploymentComparison";
import { RollbackButton } from "@/components/deployment/RollbackButton";
import PreDeployWarning from "@/components/deployment/PreDeployWarning";
import DeploymentExplanationPanel from "@/components/deployment/DeploymentExplanationPanel";
import { DeploymentAuditTimeline } from "@/components/deployment/DeploymentAuditTimeline";
import { DeploymentReplayTimeline } from "@/components/deployment/DeploymentReplayTimeline";
import { AIFixAssistant } from "@/components/deployment/AIFixAssistant";

export default function DeploymentLogsPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [deployment, setDeployment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreflightCheck, setShowPreflightCheck] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

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
    if (!deployment || !deployment.vercel_deployment_id) return;
    if (deployment.status !== "pending" && deployment.status !== "building") return;

    let pollCount = 0;
    const maxPolls = 200; // 10 minutes (3s * 200)

    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deploymentId })
        });
        const data = await res.json();
        
        if (data.status && data.status !== deployment.status) {
          setDeployment((prev: any) => prev ? { ...prev, status: data.status, deployment_url: data.deployment_url || prev.deployment_url } : prev);
        }
        
        if (data.state === 'READY' || data.state === 'ERROR' || data.state === 'CANCELED') {
          clearInterval(interval);
        }
      } catch (err) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [deployment?.vercel_deployment_id, deployment?.status, deploymentId]);

  // Real-time Vercel Logs (SSE)
  useEffect(() => {
    if (!deployment || !deployment.vercel_deployment_id) return;
    if (deployment.status !== "building" && deployment.status !== "pending") return;

    const eventSource = new EventSource(`/api/deployments/${deploymentId}/logs`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "stdout" || data.type === "stderr") {
          const logText = data.payload.text;
          const newLog: DeploymentLog = {
            id: `vercel-${Date.now()}-${Math.random()}`,
            deployment_id: deploymentId,
            user_id: deployment.user_id,
            message: logText,
            level: data.type === "stderr" ? "error" : "info",
            created_at: new Date(data.payload.date || Date.now()).toISOString()
          };
          setLogs((prev) => [...prev, newLog]);
        } else if (data.type === "command") {
          const newLog: DeploymentLog = {
            id: `vercel-${Date.now()}-${Math.random()}`,
            deployment_id: deploymentId,
            user_id: deployment.user_id,
            message: `> ${data.payload.text}`,
            level: "info",
            created_at: new Date(data.payload.date || Date.now()).toISOString()
          };
          setLogs((prev) => [...prev, newLog]);
        }
      } catch (err) {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [deployment?.vercel_deployment_id, deployment?.status, deploymentId, deployment?.user_id]);

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

  async function handleRunDeployment() {
    setRunning(true);
    setShowConfirm(false);
    setShowPreflightCheck(false);
    toast.info("🚀 Starting deployment...");

    try {
      const result = await runDeploymentPipeline(deploymentId);
      if (result.success) {
        toast.success("🎉 Deployment completed successfully!");
        // Refresh data to show updated status
        setTimeout(() => fetchData(), 1000);
      } else {
        toast.error(result.error || "Deployment failed");
      }
    } catch (error) {
      toast.error("Failed to run deployment");
    } finally {
      setRunning(false);
    }
  }

  const handlePreflightCheck = () => {
    setShowConfirm(false);
    setShowPreflightCheck(true);
  };

  async function handleRedeploy() {
    if (!deployment) return;
    setRedeploying(true);
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/redeploy`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.success && data.newDeploymentId) {
        toast.success("New deployment created");
        router.push(`/dashboard/deployments/${data.newDeploymentId}/logs`);
      } else {
        toast.error(data.error || "Failed to create new deployment");
      }
    } catch (err) {
      toast.error("Failed to re-deploy");
    } finally {
      setRedeploying(false);
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success": return "text-green-400";
      case "error": return "text-red-400";
      case "warning": return "text-yellow-400";
      default: return "text-zinc-300";
    }
  };

  const formatLogMessage = (message: string) => {
    // Basic syntax highlighting for terminal logs
    let formatted = message
      .replace(/(ERROR|Failed|ERR!|error:)/gi, '<span class="text-red-400 font-semibold">$1</span>')
      .replace(/(WARN|Warning|warn:)/gi, '<span class="text-yellow-400 font-semibold">$1</span>')
      .replace(/(success|Done|compiled successfully)/gi, '<span class="text-green-400 font-semibold">$1</span>')
      .replace(/(npm|yarn|pnpm|npx) (run|install|build|dev)/gi, '<span class="text-blue-400">$1 $2</span>')
      .replace(/(\[.*?\])/g, '<span class="text-zinc-500">$1</span>');
      
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-green-500">Success</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "building": return <Badge className="bg-blue-500">Building</Badge>;
      case "pending": return <Badge variant="outline">Pending</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <GradientBar />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/deployments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Deployment Logs</h1>
          {deployment && (
            <div className="mt-1 space-y-1">
              <p className="text-muted-foreground">
                {deployment.projects?.name} • {deployment.branch} • {deployment.environment}
              </p>
              {deployment.deployment_url && (
                <a href={deployment.deployment_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline flex items-center gap-1">
                  {deployment.deployment_url}
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExplanation(true)}
          >
            <Brain className="h-4 w-4 mr-2" />
            Explain this deployment
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedeploy}
            disabled={redeploying || deployment?.status === 'building' || deployment?.status === 'pending'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${redeploying ? 'animate-spin' : ''}`} />
            {redeploying ? 'Creating...' : 'Re-deploy'}
          </Button>
          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogTrigger asChild>
              <Button
                disabled={running || deployment?.status === 'building'}
                size="sm"
              >
                <Rocket className="h-4 w-4 mr-2" />
                {running ? 'Running...' : 'Run Deployment'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Deployment</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to start the deployment? This will build and deploy your application to {deployment?.environment}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePreflightCheck}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Check Risks & Deploy
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {deployment && getStatusBadge(deployment.status)}
        </div>
      </div>

      {/* Pre-Deploy Risk Check */}
      {showPreflightCheck && deployment && (
        <PreDeployWarning
          projectId={deployment.project_id}
          source={deployment.source || "github"}
          commitSha={deployment.commit_sha}
          onContinue={handleRunDeployment}
          onCancel={() => setShowPreflightCheck(false)}
          isVisible={showPreflightCheck}
        />
      )}

      {/* 2. DeploymentTimeline */}
      <DeploymentTimeline deploymentId={deploymentId} />

      {/* 2.3. Rollback Button (for failed deployments) */}
      {deployment && (
        <RollbackButton
          deploymentId={deploymentId}
          deploymentStatus={deployment.status}
        />
      )}

      {/* 2.5. Deployment Comparison */}
      <DeploymentComparison deploymentId={deploymentId} />

      {/* Deployment Replay */}
      <DeploymentReplayTimeline deploymentId={deploymentId} />

      {/* Audit History */}
      <DeploymentAuditTimeline deploymentId={deploymentId} />

      {/* AI Fix Assistant */}
      {deployment && deployment.status === 'failed' && (
        <AIFixAssistant
          deploymentId={deploymentId}
          projectId={deployment.project_id}
          onFixApplied={() => fetchData()}
        />
      )}

      {/* 3. Logs */}
      <Card className="overflow-hidden border-zinc-800 bg-black/90 shadow-2xl backdrop-blur-xl relative group">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 mr-4">
              <div className="w-3 h-3 rounded-full bg-red-500/80 border border-red-500/20" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-500/20" />
              <div className="w-3 h-3 rounded-full bg-green-500/80 border border-green-500/20" />
            </div>
            <Terminal className="h-4 w-4 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Build Terminal</span>
          </div>
          <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[10px]">
            bash
          </Badge>
        </div>

        {/* Terminal Body */}
        <div className="p-4 font-mono text-sm max-h-[600px] overflow-y-auto custom-scrollbar bg-black/40">
          {loading && logs.length === 0 ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 w-full bg-zinc-800/50 rounded flex gap-4">
                  <div className="w-16 h-full bg-zinc-800 rounded" />
                  <div className="flex-1 h-full bg-zinc-800 rounded opacity-50" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
              <Terminal className="h-8 w-8 mb-2 opacity-50" />
              <p>Waiting for build output...</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 -mx-2 rounded transition-colors group/line">
                  <span className="text-zinc-600 text-[11px] mt-0.5 select-none w-16 flex-shrink-0">
                    {new Date(log.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <div className={cn("flex-1 break-all", getLevelColor(log.level))}>
                    {formatLogMessage(log.message)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={logsEndRef} className="h-4" />
        </div>
      </Card>

      {/* 4. Failure / Success panels (deployment info) */}
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

      {/* Explanation Panel */}
      <DeploymentExplanationPanel
        deploymentId={deploymentId}
        isOpen={showExplanation}
        onClose={() => setShowExplanation(false)}
      />
    </div>
  );
}
