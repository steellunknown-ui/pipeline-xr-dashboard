"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitCompare, Clock, Code, Database, GitBranch, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface DeploymentChange {
  type: 'env' | 'code' | 'time' | 'source' | 'branch' | 'framework';
  key?: string;
  from?: string;
  to?: string;
  status?: 'added' | 'removed' | 'changed';
  delta?: string;
}

interface ComparisonResult {
  success: boolean;
  summary: string;
  changes: DeploymentChange[];
  confidence: number;
  current: {
    id: string;
    status: string;
    created_at: string;
  };
  previous: {
    id: string;
    status: string;
    created_at: string;
  };
  error?: string;
}

interface DeploymentComparisonProps {
  deploymentId: string;
}

export function DeploymentComparison({ deploymentId }: DeploymentComparisonProps) {
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/compare`);
      const data = await response.json();
      
      if (data.success) {
        setComparison(data);
      } else {
        setError(data.error);
        toast.error(data.error);
      }
    } catch (err) {
      setError("Failed to compare deployments");
      toast.error("Failed to compare deployments");
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'env': return <Database className="h-4 w-4" />;
      case 'code': return <Code className="h-4 w-4" />;
      case 'time': return <Clock className="h-4 w-4" />;
      case 'source': return <Package className="h-4 w-4" />;
      case 'branch': return <GitBranch className="h-4 w-4" />;
      case 'framework': return <Package className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getChangeDescription = (change: DeploymentChange) => {
    switch (change.type) {
      case 'env':
        if (change.status === 'removed') return `Environment variable ${change.key} was removed`;
        if (change.status === 'added') return `Environment variable ${change.key} was added`;
        return `Environment variable ${change.key} was changed`;
      case 'code':
        return `Code changed from ${change.from} to ${change.to}`;
      case 'time':
        return `Build duration changed by ${change.delta}`;
      case 'source':
        return `Deployment source changed from ${change.from} to ${change.to}`;
      case 'branch':
        return `Branch changed from ${change.from} to ${change.to}`;
      case 'framework':
        return `Framework changed from ${change.from} to ${change.to}`;
      default:
        return 'Unknown change';
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-500">High Confidence</Badge>;
    if (confidence >= 0.6) return <Badge className="bg-yellow-500">Medium Confidence</Badge>;
    return <Badge variant="secondary">Low Confidence</Badge>;
  };

  if (!comparison && !loading && !error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Deployment Comparison
          </CardTitle>
          <CardDescription>
            Compare this deployment with the previous one to understand what changed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCompare} disabled={loading}>
            <GitCompare className="h-4 w-4 mr-2" />
            Compare with previous deployment
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Deployment Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Deployment Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={handleCompare} className="mt-2">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Deployment Comparison
          </CardTitle>
          {comparison && getConfidenceBadge(comparison.confidence)}
        </div>
        <CardDescription>
          Comparing with deployment from {new Date(comparison!.previous.created_at).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm">{comparison!.summary}</p>
        </div>

        {/* Changes */}
        {comparison!.changes.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Changes Detected:</h4>
            {comparison!.changes.map((change, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                {getChangeIcon(change.type)}
                <span className="text-sm flex-1">{getChangeDescription(change)}</span>
                {change.status && (
                  <Badge variant={change.status === 'removed' ? 'destructive' : 'default'}>
                    {change.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {comparison!.changes.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No significant changes detected</p>
          </div>
        )}

        <Button variant="outline" onClick={handleCompare} size="sm">
          <GitCompare className="h-4 w-4 mr-2" />
          Refresh Comparison
        </Button>
      </CardContent>
    </Card>
  );
}