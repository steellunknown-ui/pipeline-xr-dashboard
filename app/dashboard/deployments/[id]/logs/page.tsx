"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Terminal, Rocket, Brain, RefreshCw, CheckCircle2, ChevronRight, Copy, TerminalSquare, AlertCircle, Loader2, XCircle, Clock, Zap, FileCode2, ShieldAlert, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { runDeploymentPipeline } from "@/app/dashboard/actions/deployment-pipeline";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addEnvVariable } from "@/app/dashboard/actions/environment";
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
  const [redeploying, setRedeploying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreflightCheck, setShowPreflightCheck] = useState(false);
  const [needsEnv, setNeedsEnv] = useState<"no" | "yes" | null>(null);
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [addingEnv, setAddingEnv] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // AI Fixer state
  const [showFixModal, setShowFixModal] = useState(false);
  const [fixStrategy, setFixStrategy] = useState<'direct_push' | 'pull_request'>('direct_push');
  const [isStartingFix, setIsStartingFix] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();

    const logChannel = supabase
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
          const newLog = payload.new as DeploymentLog;
          setLogs((prev) => [...prev, newLog]);
          
          // Pop up a toast for AI Fixer events so the user knows what's happening in the background
          const txt = newLog.message || '';
          if (txt.startsWith('🤖') || txt.startsWith('🧠') || txt.startsWith('📥') || txt.startsWith('✏️') || txt.startsWith('⚙️') || txt.startsWith('🔨') || txt.startsWith('🚀') || txt.startsWith('🔀')) {
            toast.info(txt, {
              duration: 4000,
              position: 'bottom-right',
              icon: '✨'
            });
          }
        }
      )
      .subscribe();

    const statusChannel = supabase
      .channel(`deployment_status:${deploymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deployments',
          filter: `id=eq.${deploymentId}`,
        },
        (payload) => {
          setDeployment((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logChannel);
      supabase.removeChannel(statusChannel);
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

  // Auto-Open AI Explanation Panel on Failure
  useEffect(() => {
    if (deployment?.status === 'failed') {
      setShowExplanation(true);
    }
  }, [deployment?.status]);

  const previousStatus = useRef<string | undefined>(deployment?.status);

  // Track status transitions
  useEffect(() => {
    if (deployment?.status) {
      if (previousStatus.current === 'deploying' && deployment.status === 'success' && deployment.project_id) {
        toast.success("Deployment successful! Redirecting to dashboard...");
        // Add a slight delay so they can see the final logs before redirecting
        setTimeout(() => {
          router.push(`/dashboard/projects/${deployment.project_id}`);
        }, 1500);
      }
      previousStatus.current = deployment.status;
    }
  }, [deployment?.status, deployment?.project_id, router]);

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

  const handleAddEnv = async () => {
    if (!envKey || !envValue || !deployment?.project_id) return toast.error("Key and Value required");
    setAddingEnv(true);
    const res = await addEnvVariable({
      key: envKey,
      value: envValue,
      environment: "production",
      project_id: deployment.project_id
    });
    setAddingEnv(false);
    if (res.success) {
      toast.success(`Added ${envKey}`);
      setEnvKey("");
      setEnvValue("");
    } else {
      toast.error(res.error || "Failed to add variable");
    }
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

  async function handleStartAiFix() {
    setIsStartingFix(true);
    try {
      const res = await fetch('/api/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId, strategy: fixStrategy })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("AI Fix Engine started!");
        setShowFixModal(false);
        // The logs will naturally update via realtime
      } else {
        toast.error(data.error || "Failed to start AI Fixer");
      }
    } catch (err) {
      toast.error("An error occurred while starting AI Fixer");
    } finally {
      setIsStartingFix(false);
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

          {deployment?.status === 'failed' && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
              size="sm"
              onClick={() => setShowFixModal(true)}
            >
              <FileCode2 className="h-4 w-4 mr-2" />
              Fix with Agent
            </Button>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogTrigger asChild>
              <Button
                disabled={running || deployment?.status === 'building'}
                size="sm"
              >
                <Rocket className="h-4 w-4 mr-2" />
                {running ? 'Running...' : 'Run Deployment'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-zinc-50 dark:bg-zinc-950 border dark:border-zinc-800">
              <DialogHeader>
                <DialogTitle>Deployment Pre-flight Check</DialogTitle>
                <DialogDescription>
                  Before we launch this project, we need to verify its configuration.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Does this project require Environment Variables?</Label>
                  <RadioGroup 
                    value={needsEnv || ""} 
                    onValueChange={(val) => setNeedsEnv(val as "yes" | "no")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2 border dark:border-zinc-800 p-3 rounded-lg flex-1 cursor-pointer" onClick={() => setNeedsEnv("no")}>
                      <RadioGroupItem value="no" id="r1" />
                      <Label htmlFor="r1" className="cursor-pointer">No, deploy immediately</Label>
                    </div>
                    <div className="flex items-center space-x-2 border dark:border-zinc-800 p-3 rounded-lg flex-1 cursor-pointer" onClick={() => setNeedsEnv("yes")}>
                      <RadioGroupItem value="yes" id="r2" />
                      <Label htmlFor="r2" className="cursor-pointer">Yes, add variables</Label>
                    </div>
                  </RadioGroup>
                </div>

                {needsEnv === "yes" && (
                  <div className="space-y-3 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 animate-in fade-in slide-in-from-top-4">
                    <h4 className="text-sm font-medium">Add Production Variables</h4>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="KEY (e.g. DATABASE_URL)" 
                        value={envKey} 
                        onChange={(e) => setEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                        className="dark:bg-zinc-950"
                      />
                      <Input 
                        placeholder="Value" 
                        value={envValue} 
                        onChange={(e) => setEnvValue(e.target.value)}
                        type="password"
                        className="dark:bg-zinc-950"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      className="w-full gap-2" 
                      onClick={handleAddEnv}
                      disabled={addingEnv || !envKey || !envValue}
                    >
                      {addingEnv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Variable
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="sm:justify-between flex-row items-center border-t dark:border-zinc-800 pt-4">
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  AI ENV Guard will automatically scan your build logs if this fails.
                </p>
                <Button 
                  onClick={handlePreflightCheck} 
                  disabled={running || !needsEnv}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {running ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Starting Build...</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Start Deployment</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      {/* AI Fixer Modal */}
      <Dialog open={showFixModal} onOpenChange={setShowFixModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              Fix Code with AI Agent
            </DialogTitle>
            <DialogDescription>
              Our Autonomous AI Agent will analyze the error, rewrite the broken code, and run a test build. Choose how you want the AI to push the fix:
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <RadioGroup value={fixStrategy} onValueChange={(val: any) => setFixStrategy(val)} className="space-y-4">
              <div className="flex items-start space-x-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 transition-colors hover:border-indigo-500/50">
                <RadioGroupItem value="direct_push" id="direct_push" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="direct_push" className="text-base font-medium cursor-pointer">
                    Direct Push (Maximum Speed)
                  </Label>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    The AI will push the fix directly to your branch (<code className="text-xs text-indigo-600 dark:text-indigo-300">{deployment?.branch}</code>). Ideal for fast iterative fixes without jumping into GitHub.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 transition-colors hover:border-indigo-500/50">
                <RadioGroupItem value="pull_request" id="pull_request" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="pull_request" className="text-base font-medium cursor-pointer">
                    Pull Request (Safe)
                  </Label>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    The AI will create a new branch and open a PR. You can review the code on GitHub before merging. 
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFixModal(false)} disabled={isStartingFix}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleStartAiFix} disabled={isStartingFix}>
              {isStartingFix ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...
                </>
              ) : (
                'Start AI Fix Loop'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
