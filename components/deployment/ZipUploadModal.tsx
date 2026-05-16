"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { uploadZipForDeployment, processZipBundle, runZipDeployment } from "@/app/dashboard/actions/zip-deployment";
import { createProject } from "@/app/dashboard/actions/projects";
import { toast } from "sonner";
import { ZipProcessingStatus } from "./ZipProcessingStatus";
import { FileTreeViewer } from "./FileTreeViewer";
import { useRouter } from "next/navigation";
import PreDeployWarning from "./PreDeployWarning";

interface ZipUploadModalProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ZipUploadModal({ fileInputRef }: ZipUploadModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [environment, setEnvironment] = useState("development");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [autoCreatedProject, setAutoCreatedProject] = useState(false);
  const [showPreflightWarning, setShowPreflightWarning] = useState(false);

  const router = useRouter();

  async function createProjectFromZip(zipFileName: string) {
    try {
      const projectName = zipFileName.replace('.zip', '').replace(/[^a-zA-Z0-9-_]/g, '-');

      const result = await createProject({
        name: projectName,
        github_repo_url: 'zip-upload',
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create project');
      }

      setProjectId(result.data.id);
      setProjectName(result.data.name);
      setAutoCreatedProject(true);
      toast.success(`Project "${projectName}" created`);
      return result.data.id;
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error(error.message || 'Failed to create project');
      return null;
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.zip')) {
      toast.error('Please select a valid ZIP file');
      e.target.value = ''; // Reset input
      return;
    }

    setFile(selectedFile);
    setOpen(true);

    // Reset input to allow same file selection again
    e.target.value = '';

    const newProjectId = await createProjectFromZip(selectedFile.name);

    if (newProjectId) {
      await handleUploadAndAnalyze(selectedFile, newProjectId);
    }
  }

  async function handleUploadAndAnalyze(selectedFile: File, selectedProjectId: string) {
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      toast.info('Uploading ZIP file...');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', selectedProjectId);
      formData.append('userId', user.id);

      const uploadResponse = await fetch('/api/upload-zip', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error);

      toast.success('ZIP uploaded successfully');
      setProcessing(true);

      toast.info('Analyzing project structure...');
      const processResult = await processZipBundle(uploadResult.filePath, user.id);
      if (!processResult.success) throw new Error(processResult.error);

      setAnalysis(processResult.analysis);
      toast.success('Analysis complete! Review results below.');
    } catch (error: any) {
      toast.error(error.message);
      setOpen(false);
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  }

  async function handleDeploy() {
    if (!analysis) return;

    // Show preflight warning before deploying
    setShowPreflightWarning(true);
  }

  async function executeDeploy() {
    if (!analysis) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const result = await runZipDeployment(projectId, 'uploaded', user.id, environment);
      if (!result.success) throw new Error(result.error);

      toast.success('🚀 Deployment started! Redirecting to logs...');
      setOpen(false);

      // Redirect to logs page
      router.push(`/dashboard/deployments/${result.deploymentId}/logs`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setShowPreflightWarning(false);
    }
  }

  function cancelDeploy() {
    setShowPreflightWarning(false);
  }

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setProjectId("");
      setProjectName("");
      setEnvironment("development");
      setUploading(false);
      setProcessing(false);
      setAnalysis(null);
      setAutoCreatedProject(false);
      setShowPreflightWarning(false);
    }
  }, [open]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileSelect}
        className="hidden"
        key={open ? 'open' : 'closed'} // Force re-render to reset input
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deploy from ZIP File</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {/* Loading State */}
            {(uploading || processing) && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-sm font-medium">
                  {uploading ? 'Uploading ZIP file...' : 'Analyzing project structure...'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take a few moments
                </p>
              </div>
            )}

            {/* Project Info */}
            {projectName && !uploading && !processing && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-1">Project Created</p>
                <p className="text-lg font-bold">{projectName}</p>
                <p className="text-xs text-muted-foreground mt-1">From: {file?.name}</p>
              </div>
            )}

            {/* Environment Selection */}
            {analysis && (
              <div>
                <label className="text-sm font-medium mb-2 block">Deployment Environment</label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Analysis Results */}
            {analysis && (
              <>
                <ZipProcessingStatus analysis={analysis} />
                <FileTreeViewer files={analysis.fileTree} />
                <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                  <p className="text-sm font-medium mb-2">🤖 AI Agent Ready</p>
                  <p className="text-xs text-muted-foreground">
                    Your DevOps AI will analyze this deployment and provide guidance. Click deploy to continue.
                  </p>
                </div>
                <Button onClick={handleDeploy} className="w-full" size="lg">
                  <Upload className="h-4 w-4 mr-2" />
                  Deploy to {environment.charAt(0).toUpperCase() + environment.slice(1)}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-Deploy Warning Modal */}
      {projectId && (
        <PreDeployWarning
          projectId={projectId}
          source="zip"
          onContinue={executeDeploy}
          onCancel={cancelDeploy}
          isVisible={showPreflightWarning}
        />
      )}
    </>
  );
}

