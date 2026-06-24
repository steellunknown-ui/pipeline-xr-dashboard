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
      case "success": return "text-green-500";
      case "error": return "text-red-500";
      case "warning": return "text-yellow-500";
      default: return "text-muted-foreground";
    }
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
