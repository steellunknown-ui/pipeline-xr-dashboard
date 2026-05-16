"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RotateCcw, GitCommit, Calendar, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import PreDeployWarning from "./PreDeployWarning";

interface RollbackPreview {
  deployment_id: string;
  commit_sha: string;
  source: string;
  created_at: string;
  deployment_url?: string;
}

interface RollbackButtonProps {
  deploymentId: string;
  deploymentStatus: string;
}

export function RollbackButton({ deploymentId, deploymentStatus }: RollbackButtonProps) {
  const [preview, setPreview] = useState<RollbackPreview | null>(null);
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [showPreflightWarning, setShowPreflightWarning] = useState(false);
  const router = useRouter();

  // Only show for failed deployments
  if (deploymentStatus !== "failed") {
    return null;
  }

  const handleGetPreview = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: false })
      });

      const data = await response.json();
      
      if (data.success) {
        setPreview(data.rollback_to);
        setReason(data.reason);
        setShowDialog(true);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to get rollback preview");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRollback = async () => {
    // Show preflight warning before executing rollback
    setShowDialog(false);
    setShowPreflightWarning(true);
  };

  const executeRollback = async () => {
    setExecuting(true);
    
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success("Rollback initiated successfully");
        setShowPreflightWarning(false);
        // Redirect to new deployment
        router.push(`/dashboard/deployments/${data.deployment.id}/logs`);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to execute rollback");
    } finally {
      setExecuting(false);
      setShowPreflightWarning(false);
    }
  };

  const cancelRollback = () => {
    setShowPreflightWarning(false);
    setShowDialog(true); // Return to confirmation dialog
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'github': return '🐙';
      case 'zip': return '📦';
      case 'manual': return '⚙️';
      default: return '📁';
    }
  };

  return (
    <>
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Deployment Failed
          </CardTitle>
          <CardDescription className="text-yellow-700">
            You can rollback to the last working version to restore functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleGetPreview}
            disabled={loading}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {loading ? 'Loading...' : 'Rollback to last working version'}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Confirm Rollback
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="text-sm">
                <p className="font-medium text-foreground mb-2">Rollback Reason:</p>
                <p className="text-muted-foreground">{reason}</p>
              </div>
              
              {preview && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="font-medium text-foreground">Rolling back to:</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <GitCommit className="h-4 w-4" />
                      <span className="font-mono">{preview.commit_sha?.substring(0, 7) || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>{getSourceIcon(preview.source)} {preview.source}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(preview.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground pt-2 border-t">
                This will create a new deployment with the same configuration as the last successful deployment.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRollback}
              disabled={executing}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {executing ? 'Rolling back...' : 'Confirm Rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Pre-Deploy Warning Modal */}
      {preview && (
        <PreDeployWarning
          projectId={deploymentId} // Using deployment ID as project context
          source={preview.source as 'github' | 'zip' | 'manual'}
          commitSha={preview.commit_sha}
          onContinue={executeRollback}
          onCancel={cancelRollback}
          isVisible={showPreflightWarning}
        />
      )}
    </>
  );
}