"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Copy, CheckCircle, XCircle, Clock, Github, FileArchive, Brain } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface FailureAnalysisProps {
  deploymentId: string;
  onExplain?: () => void;
}

interface AnalysisData {
  deployment: {
    id: string;
    source: string;
    status: string;
    branch: string;
    commit_sha?: string;
    project_name?: string;
  };
  analysis: {
    failure_type: string;
    short_reason: string;
    detailed_reason: string;
    probable_cause: string;
    fix_steps: string[];
    confidence: number;
  };
  ai_used: boolean;
  logs_analyzed: number;
}

const getFailureTypeColor = (type: string) => {
  switch (type) {
    case 'BUILD_ERROR': return 'bg-red-100 text-red-800 border-red-200';
    case 'INSTALL_ERROR': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'ENV_ERROR': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'PERMISSION_ERROR': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'PORT_ERROR': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'SYNTAX_ERROR': return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'TIMEOUT_ERROR': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'github': return <Github className="h-4 w-4" />;
    case 'zip': return <FileArchive className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

export function FailureAnalysisPanel({ deploymentId, onExplain }: FailureAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, [deploymentId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/deployments/${deploymentId}/analysis`);
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to analyze deployment');
        return;
      }
      
      setAnalysis(data);
    } catch (err) {
      setError('Failed to load failure analysis');
    } finally {
      setLoading(false);
    }
  };

  const copyFixSteps = () => {
    if (!analysis) return;
    
    const fixText = analysis.analysis.fix_steps
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n');
    
    navigator.clipboard.writeText(fixText);
    toast.success('Fix steps copied to clipboard');
  };

  if (loading) {
    return (
      <Card className="relative overflow-hidden border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-pink-50/50 backdrop-blur-xl shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-200/20 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite]" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-800">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-inner">
              <AlertTriangle className="h-4 w-4 text-white animate-pulse" />
            </div>
            Analyzing Failure...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative z-10">
          <Skeleton className="h-6 w-48 bg-rose-200/50" />
          <Skeleton className="h-4 w-full bg-rose-200/50" />
          <Skeleton className="h-4 w-3/4 bg-rose-200/50" />
          <div className="space-y-2 pt-2 border-t border-rose-200/30">
            <Skeleton className="h-4 w-full bg-rose-200/50" />
            <Skeleton className="h-4 w-full bg-rose-200/50" />
            <Skeleton className="h-4 w-2/3 bg-rose-200/50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Analysis Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchAnalysis} variant="outline" size="sm" className="mt-2">
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <Card className="relative overflow-hidden border-rose-200/60 bg-gradient-to-br from-white to-rose-50/30 dark:from-zinc-950 dark:to-zinc-900 shadow-xl backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:border-rose-300/50">
      <div className="absolute top-0 right-0 p-32 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <CardHeader className="relative z-10 pb-4">
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                        <AlertTriangle className="h-5 w-5 text-white" />
                    </div>
                    Failure Analysis
                </CardTitle>
                <CardDescription className="mt-2 text-base">
                Automated root cause analysis of this deployment
                </CardDescription>
            </div>
            {analysis.ai_used && (
                <Badge variant="outline" className="bg-gradient-to-r from-rose-100 to-pink-100 text-rose-800 border-rose-200/50 shadow-sm animate-pulse flex items-center gap-1.5 px-3 py-1">
                    <Brain className="h-3.5 w-3.5" />
                    AI Enhanced
                </Badge>
            )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 relative z-10">
        {/* Deployment Info */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            {getSourceIcon(analysis.deployment.source)}
            <span className="capitalize">{analysis.deployment.source}</span>
          </div>
          {analysis.deployment.branch && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Branch:</span>
              <code className="bg-muted px-1 rounded text-xs">{analysis.deployment.branch}</code>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Confidence:</span>
            <span className="font-medium">{Math.round(analysis.analysis.confidence * 100)}%</span>
          </div>
        </div>

        {/* Failure Type */}
        <div>
          <Badge className={getFailureTypeColor(analysis.analysis.failure_type)}>
            {analysis.analysis.failure_type.replace('_', ' ')}
          </Badge>
        </div>

        {/* Short Reason */}
        <div>
          <h4 className="font-medium text-sm mb-2">What Failed</h4>
          <p className="text-sm">{analysis.analysis.short_reason}</p>
        </div>

        {/* Detailed Reason */}
        <div>
          <h4 className="font-medium text-sm mb-2">Why It Failed</h4>
          <p className="text-sm text-muted-foreground">{analysis.analysis.detailed_reason}</p>
        </div>

        {/* Probable Cause */}
        <div>
          <h4 className="font-medium text-sm mb-2">Probable Cause</h4>
          <p className="text-sm font-medium text-red-600">{analysis.analysis.probable_cause}</p>
        </div>

        {/* Fix Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">How to Fix</h4>
            <div className="flex gap-2">
              {onExplain && (
                <Button onClick={onExplain} variant="ghost" size="sm">
                  <Brain className="h-3 w-3 mr-1" />
                  Re-explain
                </Button>
              )}
              <Button onClick={copyFixSteps} variant="outline" size="sm">
                <Copy className="h-3 w-3 mr-1" />
                Copy Fix
              </Button>
            </div>
          </div>
          <ol className="space-y-2 text-sm">
            {analysis.analysis.fix_steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Analysis Info */}
        <div className="pt-4 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
          <span>Deep scanned {analysis.logs_analyzed} log entries</span>
        </div>
      </CardContent>
    </Card>
  );
}