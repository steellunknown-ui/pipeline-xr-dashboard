"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Brain, X, CheckCircle, XCircle, Clock, Settings, RotateCcw, Key, Github, FileText, Play, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeploymentAction, DeploymentExplanation, DecisionOption, Provenance, TrustSignals, BenchmarkResult, ChangeImpact } from "@/lib/types/deployment-actions";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { RollbackButton } from "@/components/deployment/RollbackButton";
import { safeFetch } from "@/lib/safe-fetch";
import { DegradedModeBanner } from "@/components/system/DegradedModeBanner";
import { type DeploymentLineage, getLineageDescription } from "@/lib/deployment-lineage";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { type EnvDriftResult } from "@/lib/env-drift";
import { type DeploymentFreezeStatus } from "@/lib/deployment-freeze";
import { type DeploymentSummary } from "@/lib/deployment-summary";
import { type DeploymentMemory } from "@/lib/deployment-memory";
import { type DeploymentPrediction } from "@/lib/deployment-prediction";
import { type DeploymentConfidence } from "@/lib/deployment-confidence";
import { type OperatorState } from "@/lib/deployment-operator-state";
import { type DeploymentFocusState } from "@/lib/deployment-focus-level";
import { deriveIntelligenceVisibility } from "@/lib/intelligence-compression";
import { OperatorStateHUD } from "@/components/deployment/OperatorStateHUD";
import { type DeploymentIntentResult } from "@/lib/deployment-intent";

interface DeploymentExplanationPanelProps {
  deploymentId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Extended explanation interface to include decision options, provenance, trust signals, benchmark, change impact, and env drift
interface ExtendedExplanationData extends DeploymentExplanation {
  decisionOptions?: DecisionOption[];
  provenance?: Provenance;
  trustSignals?: TrustSignals;
  benchmark?: BenchmarkResult;
  changeImpact?: ChangeImpact;
  lineage?: DeploymentLineage;
  envDrift?: EnvDriftResult | null;
  freeze?: DeploymentFreezeStatus;
  attribution?: { cause: string; summary: string } | null;
  summary?: DeploymentSummary | null;
  memory?: DeploymentMemory | null;
  prediction?: DeploymentPrediction | null;
  confidenceCalibration?: DeploymentConfidence | null;
  operatorState?: OperatorState | null;
  focusLevel?: DeploymentFocusState | null;
  deploymentIntent?: DeploymentIntentResult | null;
}

export default function DeploymentExplanationPanel({
  deploymentId,
  isOpen,
  onClose
}: DeploymentExplanationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<ExtendedExplanationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isDegraded, setIsDegraded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && deploymentId) {
      fetchExplanation();
    }
  }, [isOpen, deploymentId]);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);
    setIsDegraded(false);

    try {
      // First get deployment status using safe fetch
      const deploymentResult = await safeFetch(`/api/deployments/${deploymentId}`);

      if (deploymentResult.degraded) {
        setIsDegraded(true);
        // Show fallback explanation for degraded mode
        setExplanation({
          status: "unknown",
          whatHappening: "We're unable to fetch live deployment details right now.",
          whyHappened: "Your deployment is still safe and unchanged.",
          nextAction: "Try refreshing in a moment, or check the logs page directly.",
          recommendedActions: [
            { type: "VIEW_LOGS", deploymentId }
          ],
          decisionOptions: [],
          provenance: undefined,
          trustSignals: undefined,
          benchmark: undefined,
          changeImpact: undefined,
          summary: null,
          memory: null,
          prediction: null,
          confidenceCalibration: null,
          operatorState: null,
          focusLevel: null
        });
        setLoading(false);
        return;
      }

      if (!deploymentResult.success || !deploymentResult.data) {
        throw new Error("Failed to fetch deployment");
      }

      const deploymentData = deploymentResult.data;
      const status = deploymentData.status || "unknown";

      let apiEndpoint = "";
      switch (status) {
        case "failed":
          apiEndpoint = `/api/deployments/${deploymentId}/analysis`;
          break;
        case "success":
          apiEndpoint = `/api/deployments/${deploymentId}/success`;
          break;
        case "building":
        case "pending":
        case "queued":
          apiEndpoint = `/api/deployments/${deploymentId}/timeline`;
          break;
        default:
          apiEndpoint = `/api/deployments/${deploymentId}/timeline`;
      }

      const response = await safeFetch(apiEndpoint);

      if (response.degraded) {
        setIsDegraded(true);
        // Show what we know so far
        setExplanation({
          status: status,
          whatHappening: "What we know so far",
          whyHappened: `• Deployment status: ${status}\n• Last known stage: ${status === 'building' ? 'building' : 'processing'}\n• What usually happens next: monitoring continues until completion`,
          nextAction: "Your deployment continues safely in the background.",
          recommendedActions: [
            { type: "VIEW_LOGS", deploymentId }
          ],
          decisionOptions: [],
          provenance: undefined,
          trustSignals: undefined,
          benchmark: undefined,
          changeImpact: undefined,
          summary: null,
          memory: null,
          prediction: null,
          confidenceCalibration: null,
          operatorState: null,
          focusLevel: null
        });
        setLoading(false);
        return;
      }

      const data = response.data;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to get explanation");
      }

      // Get project ID for actions
      const projectIdFromData = deploymentData.project_id || null;
      setProjectId(projectIdFromData);

      // Transform response based on endpoint
      let explanationData: ExtendedExplanationData;

      if (status === "failed" && data.analysis) {
        explanationData = {
          status: "failed",
          whatHappening: "Deployment failed during execution",
          whyHappened: data.analysis?.summary || "Build process encountered errors",
          nextAction: data.analysis?.fix_steps?.[0] || "Review logs and fix issues, then redeploy",
          recommendedActions: [
            { type: "VIEW_LOGS", deploymentId },
            { type: "REDEPLOY_SAME_VERSION" as const, deploymentId },
            ...(projectIdFromData ? [{ type: "ROLLBACK_PREVIEW" as const, deploymentId }] : []),
            ...(projectIdFromData ? [{ type: "REDEPLOY_MANUAL" as const, projectId: projectIdFromData }] : [])
          ],
          decisionOptions: data.decisionOptions || [],
          provenance: data.provenance || undefined,
          trustSignals: data.trustSignals || undefined,
          benchmark: data.benchmark || undefined,
          changeImpact: data.changeImpact || undefined,
          lineage: data.lineage || undefined,
          envDrift: data.envDrift || null,
          freeze: data.freeze || undefined,
          attribution: data.attribution || null,
          summary: data.summary || null,
          memory: data.memory || null,
          prediction: data.prediction || null,
          confidenceCalibration: data.confidenceCalibration || null,
          operatorState: data.operatorState || null,
          focusLevel: data.focusLevel || null,
          deploymentIntent: data.deploymentIntent || null,
        };
      } else if (status === "success" && data.analysis) {
        explanationData = {
          status: "success",
          whatHappening: "Deployment completed successfully",
          whyHappened: data.analysis?.deployment_source || "Build and deployment process completed without errors",
          nextAction: data.analysis?.next_actions?.[0] || "Your application is live and ready to use",
          recommendedActions: [
            { type: "REDEPLOY_SAME_VERSION" as const, deploymentId },
            ...(projectIdFromData ? [{ type: "OPEN_AUTO_DEPLOY_SETTINGS" as const, projectId: projectIdFromData }] : []),
            ...(projectIdFromData ? [{ type: "OPEN_ENV_EDITOR" as const, projectId: projectIdFromData }] : [])
          ],
          decisionOptions: data.decisionOptions || [],
          provenance: data.provenance || undefined,
          trustSignals: data.trustSignals || undefined,
          benchmark: data.benchmark || undefined,
          changeImpact: data.changeImpact || undefined,
          lineage: data.lineage || undefined,
          envDrift: data.envDrift || null,
          freeze: data.freeze || undefined,
          attribution: data.attribution || null,
          summary: data.summary || null,
          memory: data.memory || null,
          prediction: data.prediction || null,
          confidenceCalibration: data.confidenceCalibration || null,
          operatorState: data.operatorState || null,
          focusLevel: data.focusLevel || null,
          deploymentIntent: data.deploymentIntent || null,
        };
      } else if (data.currentStage) {
        explanationData = {
          status: status,
          whatHappening: `Deployment is currently ${data.currentStage || 'processing'}`,
          whyHappened: data.elapsedSeconds
            ? `Build process is in progress (${Math.floor(data.elapsedSeconds / 60)}m ${data.elapsedSeconds % 60}s elapsed)`
            : "Build process is still processing",
          nextAction: "Wait for deployment to complete, then check the results",
          recommendedActions: [
            { type: "VIEW_LOGS", deploymentId }
          ],
          decisionOptions: data.decisionOptions || [],
          provenance: data.provenance || undefined,
          trustSignals: data.trustSignals || undefined,
          benchmark: data.benchmark || undefined,
          changeImpact: data.changeImpact || undefined,
          lineage: data.lineage || undefined,
          envDrift: data.envDrift || null,
          freeze: data.freeze || undefined,
          attribution: data.attribution || null,
          summary: data.summary || null,
          memory: data.memory || null,
          prediction: data.prediction || null,
          confidenceCalibration: data.confidenceCalibration || null,
          operatorState: data.operatorState || null,
          focusLevel: data.focusLevel || null,
          deploymentIntent: data.deploymentIntent || null,
        };
      } else {
        // Check if this is a first deployment scenario
        const isFirstDeployment = !data.benchmark && !data.trustSignals;

        explanationData = {
          status: status,
          whatHappening: isFirstDeployment
            ? "This is your first deployment. Pipeline XR will start building intelligence as more deployments happen."
            : `Deployment status: ${status}`,
          whyHappened: isFirstDeployment
            ? "Pipeline XR learns from deployment patterns over time to provide better insights."
            : "Processing deployment request",
          nextAction: isFirstDeployment
            ? "After future deployments, you'll see comparisons, risk signals, and recommendations here."
            : "Monitor deployment progress in the logs",
          recommendedActions: [
            { type: "VIEW_LOGS", deploymentId }
          ],
          decisionOptions: [],
          provenance: undefined,
          trustSignals: undefined,
          benchmark: undefined,
          changeImpact: undefined,
          summary: null,
          memory: null,
          prediction: null,
          confidenceCalibration: null,
          operatorState: null,
          focusLevel: null
        };
      }

      setExplanation(explanationData);
    } catch (err: any) {
      setError(err.message || "Failed to explain deployment");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-700 bg-green-50 border-green-200";
      case "failed":
        return "text-red-700 bg-red-50 border-red-200";
      default:
        return "text-blue-700 bg-blue-50 border-blue-200";
    }
  };

  // STEP 6.2.4: Action Behavior (Client-Side Only)
  const handleAction = async (action: DeploymentAction) => {
    try {
      switch (action.type) {
        case "OPEN_AUTO_DEPLOY_SETTINGS":
          router.push(`/dashboard/projects/${action.projectId}/settings`);
          break;
        case "ROLLBACK_PREVIEW":
          // This will be handled by the existing RollbackButton component
          toast.info("Use the rollback button below to preview and execute rollback");
          break;
        case "OPEN_ENV_EDITOR":
          router.push(`/dashboard/projects/${action.projectId}/settings#environment`);
          break;
        case "LINK_GITHUB":
          setShowGitHubModal(true);
          break;
        case "VIEW_LOGS":
          router.push(`/dashboard/deployments/${action.deploymentId}/logs`);
          break;
        case "REDEPLOY_MANUAL":
          router.push(`/dashboard/projects/${action.projectId}`);
          break;
        case "REDEPLOY_SAME_VERSION":
          // PRIORITY 10.7: Safe re-deploy via API
          try {
            const response = await fetch(`/api/deployments/${action.deploymentId}/redeploy`, {
              method: "POST",
            });
            const data = await response.json();
            if (data.success && data.newDeploymentId) {
              toast.success("New deployment created");
              router.push(`/dashboard/deployments/${data.newDeploymentId}/logs`);
              onClose();
            } else {
              toast.error(data.error || "Failed to create new deployment");
            }
          } catch (err) {
            toast.error("Failed to re-deploy");
          }
          break;
        default:
          toast.error("Unknown action type");
      }
    } catch (error) {
      toast.error("Failed to execute action");
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "OPEN_AUTO_DEPLOY_SETTINGS":
        return <Settings className="h-4 w-4" />;
      case "ROLLBACK_PREVIEW":
        return <RotateCcw className="h-4 w-4" />;
      case "OPEN_ENV_EDITOR":
        return <Key className="h-4 w-4" />;
      case "LINK_GITHUB":
        return <Github className="h-4 w-4" />;
      case "VIEW_LOGS":
        return <FileText className="h-4 w-4" />;
      case "REDEPLOY_MANUAL":
        return <Play className="h-4 w-4" />;
      case "REDEPLOY_SAME_VERSION":
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case "OPEN_AUTO_DEPLOY_SETTINGS":
        return "Enable auto-deploy";
      case "ROLLBACK_PREVIEW":
        return "Rollback to last success";
      case "OPEN_ENV_EDITOR":
        return "Add environment variables";
      case "LINK_GITHUB":
        return "Connect GitHub";
      case "VIEW_LOGS":
        return "View logs";
      case "REDEPLOY_MANUAL":
        return "Redeploy";
      case "REDEPLOY_SAME_VERSION":
        return "Re-deploy this version";
      default:
        return "Unknown action";
    }
  };

  const getTrustBadgeColor = (confidence: string) => {
    switch (confidence) {
      case "HIGH":
        return "bg-green-100 text-green-800 border-green-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "LOW":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getConfidenceBadgeColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-green-100 text-green-800 border-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getBenchmarkBadgeColor = (confidence: string) => {
    switch (confidence) {
      case "HIGH":
        return "bg-green-100 text-green-800 border-green-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "LOW":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // PRIORITY 8.3: Impact level badge colors
  const getImpactBadgeColor = (level: string) => {
    switch (level) {
      case "LOW":
        return "bg-green-100 text-green-800 border-green-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "HIGH":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getActionTooltip = (actionType: string) => {
    switch (actionType) {
      case "OPEN_AUTO_DEPLOY_SETTINGS":
        return "Configure automatic deployments for this project";
      case "ROLLBACK_PREVIEW":
        return "Preview and rollback to the last successful deployment";
      case "OPEN_ENV_EDITOR":
        return "Manage environment variables for this project";
      case "LINK_GITHUB":
        return "Connect your GitHub account for seamless deployments";
      case "VIEW_LOGS":
        return "View detailed deployment logs and timeline";
      case "REDEPLOY_MANUAL":
        return "Trigger a new manual deployment";
      case "REDEPLOY_SAME_VERSION":
        return "Creates a new deployment using the same source and commit";
      default:
        return "Execute this action";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Deployment Explanation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Degraded Mode Banner */}
          <DegradedModeBanner show={isDegraded} />

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
              <p className="text-red-700">
                Unable to explain this deployment: {error}
              </p>
              <p className="text-sm text-red-600 mt-2">
                You can still view detailed logs and timeline information on the deployment page.
              </p>
            </div>
          ) : explanation ? (
            <div className="space-y-4">
              {/* Status Header */}
              <div className={`p-2 rounded-lg border flex items-center justify-between ${getStatusColor(explanation.status)}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon(explanation.status)}
                  <span className="font-medium capitalize text-sm">{explanation.status}</span>
                </div>
                {explanation.lineage && (
                  <Badge variant="outline" className="text-xs bg-white/50">{explanation.lineage.label}</Badge>
                )}
              </div>

              {/* PRIORITY ENV-INTENT ENGINE: Why this deployment is running */}
              {explanation.deploymentIntent && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Why this deployment is running</h3>
                  <p className="text-sm text-foreground">{explanation.deploymentIntent.summary}</p>
                </div>
              )}

              {/* PRIORITY 12.7: Operator State HUD */}
              {explanation.operatorState && (
                <OperatorStateHUD state={explanation.operatorState} />
              )}

              {/* Focus Level & Summary in a compact grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Operator Focus Level */}
                {explanation.focusLevel && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 text-xs uppercase">Focus Level</h3>
                      <Badge variant="outline" className="text-[10px] py-0">{explanation.focusLevel.level}</Badge>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{explanation.focusLevel.explanation}</p>
                  </div>
                )}

                {/* Deployment Summary */}
                {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").summary && explanation.summary && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col">
                     <h3 className="font-semibold text-slate-900 text-xs uppercase mb-2">Summary</h3>
                     <p className="text-xs font-bold text-slate-900 mb-1">{explanation.summary.headline}</p>
                     <p className="text-xs text-slate-600 truncate">Next: {explanation.summary.recommendedNextStep}</p>
                  </div>
                )}
              </div>

              {/* Core Context (What/Why/Next) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase mb-1">What's happening</h3>
                  <p className="text-xs text-gray-700">{explanation.whatHappening}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase mb-1">Why this happened</h3>
                  <p className="text-xs text-gray-700">{explanation.whyHappened}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase mb-1">Next action</h3>
                  <p className="text-xs text-gray-700">{explanation.nextAction}</p>
                </div>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="intelligence">
                  <AccordionTrigger className="text-sm font-semibold py-2">
                    Advanced Intelligence Insights
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">

              {/* PRIORITY 8.1: Trust Signals */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").trustSignals && explanation.trustSignals && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Why Pipeline XR recommends this</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getTrustBadgeColor(explanation.trustSignals.confidence)}`}
                    >
                      {explanation.trustSignals.confidence} confidence
                    </Badge>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {explanation.trustSignals.signals.successRatePercent !== null ||
                      explanation.trustSignals.signals.lastSuccessfulDeployment ||
                      explanation.trustSignals.signals.failureCount > 0 ||
                      explanation.trustSignals.signals.sourceConsistency ? (
                      <ul className="space-y-1 text-sm text-slate-700">
                        {explanation.trustSignals.signals.successRatePercent !== null && (
                          <li className="flex items-start gap-2">
                            <span className="text-slate-400 mt-1">•</span>
                            <span>This project has a {explanation.trustSignals.signals.successRatePercent}% success rate recently</span>
                          </li>
                        )}
                        {explanation.trustSignals.signals.lastSuccessfulDeployment && (
                          <li className="flex items-start gap-2">
                            <span className="text-slate-400 mt-1">•</span>
                            <span>Last successful deployment was {explanation.trustSignals.signals.lastSuccessfulDeployment}</span>
                          </li>
                        )}
                        {explanation.trustSignals.signals.failureCount > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="text-slate-400 mt-1">•</span>
                            <span>This commit failed {explanation.trustSignals.signals.failureCount} time{explanation.trustSignals.signals.failureCount === 1 ? '' : 's'} before</span>
                          </li>
                        )}
                        {explanation.trustSignals.signals.sourceConsistency && (
                          <li className="flex items-start gap-2">
                            <span className="text-slate-400 mt-1">•</span>
                            <span>Deployments have been consistent from the same source</span>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Not enough history to establish confidence yet.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 6.4: Confidence & Provenance */}
              {explanation.provenance && explanation.provenance.based_on.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Why Pipeline XR is confident</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getConfidenceBadgeColor(explanation.provenance.confidence_level)}`}
                    >
                      {explanation.provenance.confidence_level} confidence
                    </Badge>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 mb-2">Based on observed deployments:</p>
                    <ul className="space-y-1">
                      {explanation.provenance.based_on.map((evidence, index) => (
                        <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                          <span className="text-blue-400 mt-1">•</span>
                          <span>{evidence}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* PRIORITY 8.2: Benchmark Comparison */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").memory && explanation.benchmark && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">How this deployment compares</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getBenchmarkBadgeColor(explanation.benchmark.relativeConfidence)}`}
                    >
                      {explanation.benchmark.relativeConfidence} confidence
                    </Badge>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600 mb-2">Compared to recent deployments:</p>
                    <ul className="space-y-1 text-sm text-purple-800">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-400 mt-1">•</span>
                        <span>{explanation.benchmark.successPercentile}% success rate in recent history</span>
                      </li>
                      {explanation.benchmark.buildTimeComparison !== 'similar' && (
                        <li className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>Build time was {explanation.benchmark.buildTimeComparison} than recent deployments</span>
                        </li>
                      )}
                      {explanation.benchmark.failureFrequency > 0 && (
                        <li className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>This commit has failed {explanation.benchmark.failureFrequency} time{explanation.benchmark.failureFrequency === 1 ? '' : 's'} recently</span>
                        </li>
                      )}
                      {explanation.benchmark.consistency && (
                        <li className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span>Deployment pattern matches recent successful deployments</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").memory && !explanation.benchmark && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">How this deployment compares</h3>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                      Not enough deployment history to compare yet
                    </p>
                  </div>
                </div>
              )}

              {/* PRIORITY 8.3: Change Impact Summary */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").prediction && explanation.changeImpact && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">🧠 What changed since last deployment</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getImpactBadgeColor(explanation.changeImpact.impactLevel)}`}
                    >
                      {explanation.changeImpact.impactLevel} impact
                    </Badge>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-700 mb-2">
                      {explanation.changeImpact.summary}
                    </p>
                    {explanation.changeImpact.reasons.length > 0 && (
                      <ul className="space-y-1 text-sm text-slate-600">
                        {explanation.changeImpact.reasons.slice(0, 4).map((reason, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-slate-400 mt-1">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* PRIORITY 11.2: Environment Drift Detection */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").envDrift && explanation.envDrift && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Environment changes since last successful deployment</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${explanation.envDrift.riskLevel === 'high'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : explanation.envDrift.riskLevel === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          : 'bg-green-100 text-green-800 border-green-200'
                        }`}
                    >
                      {explanation.envDrift.riskLevel.toUpperCase()} risk
                    </Badge>
                  </div>
                  <div className={`p-3 rounded-lg border ${explanation.envDrift.riskLevel === 'high'
                    ? 'bg-red-50 border-red-200'
                    : explanation.envDrift.riskLevel === 'medium'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-green-50 border-green-200'
                    }`}>
                    <p className="text-sm text-slate-700 mb-2">
                      {explanation.envDrift.summary}
                    </p>
                    {(explanation.envDrift.removed.length > 0 || explanation.envDrift.added.length > 0) && (
                      <ul className="space-y-1 text-sm text-slate-600">
                        {explanation.envDrift.removed.length > 0 && (
                          <li className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span>{explanation.envDrift.removed.length} variable{explanation.envDrift.removed.length === 1 ? '' : 's'} removed</span>
                          </li>
                        )}
                        {explanation.envDrift.added.length > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-1 flex-shrink-0">+</span>
                            <span>{explanation.envDrift.added.length} variable{explanation.envDrift.added.length === 1 ? '' : 's'} added</span>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* PRIORITY 12.2: Why this deployment ran (Attribution) */}
              {explanation.attribution && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Why this deployment ran</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {explanation.attribution.summary}
                  </p>
                </div>
              )}

              {/* PRIORITY 12.5: Deployment Prediction Engine */}
              {explanation.prediction && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Predictive risk (based on past behavior)</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${explanation.prediction.riskLevel === "HIGH"
                        ? "border-red-200 text-red-700 bg-red-50"
                        : explanation.prediction.riskLevel === "MEDIUM"
                          ? "border-amber-200 text-amber-700 bg-amber-50"
                          : "border-green-200 text-green-700 bg-green-50"
                        }`}
                    >
                      {explanation.prediction.riskLevel} risk
                    </Badge>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700">
                    <p className="mb-3 font-medium">
                      {explanation.prediction.summary}
                    </p>
                    {explanation.prediction.signals.length > 0 && (
                      <ul className="space-y-2 text-sm mb-4">
                        {explanation.prediction.signals.map((signal, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-slate-400">•</span>
                            <span>{signal}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-500 italic">
                        Derived from recent deployment patterns. This does not block deployments.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PRIORITY 12.6: Confidence Calibration Engine */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").confidence && explanation.confidenceCalibration && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">How confident Pipeline XR is</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs ${explanation.confidenceCalibration.level === "HIGH"
                        ? "border-blue-200 text-blue-700 bg-blue-50"
                        : explanation.confidenceCalibration.level === "MEDIUM"
                          ? "border-slate-300 text-slate-700 bg-slate-100"
                          : "border-gray-200 text-gray-500 bg-gray-50"
                        }`}
                    >
                      {explanation.confidenceCalibration.level}
                    </Badge>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700">
                    <p className="mb-3 font-medium">
                      {explanation.confidenceCalibration.summary}
                    </p>
                    {explanation.confidenceCalibration.reasoning.length > 0 && (
                      <ul className="space-y-2 text-sm">
                        {explanation.confidenceCalibration.reasoning.map((signal, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-slate-400">•</span>
                            <span>{signal}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* PRIORITY 12.4: Deployment Memory Engine */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").memory && explanation.memory && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">What Pipeline XR remembers about this project</h3>
                    <span className="text-xs text-slate-500 uppercase tracking-wider">{explanation.memory.memoryConfidence} confidence</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700">
                    <p className="mb-3 font-medium">
                      {explanation.memory.summary}
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex gap-2">
                        <span className="text-slate-400">•</span>
                        <span>Overall success rate: <strong>{explanation.memory.successRatePercent}%</strong> based on {explanation.memory.totalDeploymentsAnalyzed} deployments</span>
                      </li>
                      {explanation.memory.averageBuildTimeSeconds && (
                        <li className="flex gap-2">
                          <span className="text-slate-400">•</span>
                          <span>Average build time: <strong>{Math.floor(explanation.memory.averageBuildTimeSeconds / 60)}m {explanation.memory.averageBuildTimeSeconds % 60}s</strong></span>
                        </li>
                      )}
                      {explanation.memory.mostStableSource && (
                        <li className="flex gap-2">
                          <span className="text-slate-400">•</span>
                          <span>Most stable source: <strong className="capitalize">{explanation.memory.mostStableSource}</strong></span>
                        </li>
                      )}
                      {explanation.memory.commonFailureReason && (
                        <li className="flex gap-2">
                          <span className="text-slate-400">•</span>
                          <span>Most common error: <strong>{explanation.memory.commonFailureReason}</strong> (failed {explanation.memory.recentFailureCount} times recently)</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* STEP 6.3.3: Decision Intelligence */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").decision && explanation.decisionOptions && explanation.decisionOptions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">What happens if you choose each option?</h3>
                  {explanation.decisionOptions.length > 0 ? (
                    <div className="space-y-3">
                      {explanation.decisionOptions.map((option, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{option.action}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getRiskBadgeColor(option.risk_level)}`}
                                >
                                  {option.risk_level} risk
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {Math.round(option.confidence * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{option.description}</p>
                              <p className="text-xs text-gray-500">{option.reason}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                      Not enough data to compare options yet
                    </p>
                  )}
                </div>
              )}

                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* STEP 6.2.3: Quick Actions */}
              {explanation.recommendedActions && explanation.recommendedActions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                  <TooltipProvider>
                    <div className="flex flex-wrap gap-2">
                      {explanation.recommendedActions.map((action, index) => {
                        const isDangerousAction = isDegraded && (action.type === 'ROLLBACK_PREVIEW' || action.type === 'REDEPLOY_MANUAL');

                        return (
                          <Tooltip key={index}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleAction(action)}
                                disabled={isDangerousAction}
                                className={`flex items-center gap-2 ${isDangerousAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {getActionIcon(action.type)}
                                {getActionLabel(action.type)}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isDangerousAction ? 'Unavailable while system is recovering' : getActionTooltip(action.type)}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                </div>
              )}

              {/* Show rollback component for failed deployments - disabled in degraded mode */}
              {deriveIntelligenceVisibility(explanation.focusLevel?.level || "WATCH").fixAssistant && explanation.status === "failed" && projectId && (
                <div className="pt-2">
                  {isDegraded ? (
                    <div className="relative">
                      <RollbackButton
                        deploymentId={deploymentId}
                        deploymentStatus={explanation.status}
                      />
                      <div className="absolute inset-0 bg-white/50 rounded cursor-not-allowed flex items-center justify-center">
                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                          Unavailable while system is recovering
                        </span>
                      </div>
                    </div>
                  ) : (
                    <RollbackButton
                      deploymentId={deploymentId}
                      deploymentStatus={explanation.status}
                    />
                  )}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* GitHub Provider Modal */}
      <GitHubProviderModal
        open={showGitHubModal}
        onOpenChange={setShowGitHubModal}
      />
    </Dialog>
  );
}