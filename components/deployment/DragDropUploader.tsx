"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileArchive, CheckCircle2, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { createProjectFromZip } from "@/app/dashboard/actions/projects";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function DragDropUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const validateFile = (file: File) => {
    if (file.type !== "application/zip" && !file.name.endsWith(".zip")) {
      toast.error("Please upload a .zip file");
      return false;
    }
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast.error("File size must be less than 50MB");
      return false;
    }
    return true;
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10); // Start progress

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const projectName = file.name.replace('.zip', '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

      setProgress(40);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pipeline-xr-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(70);

      // Get public URL (assuming the bucket is public, or we use signed URLs)
      const { data: urlData } = supabase.storage
        .from('pipeline-xr-uploads')
        .getPublicUrl(filePath);

      setProgress(85);

      // Create Project
      const res = await createProjectFromZip({
        name: projectName,
        zip_url: urlData.publicUrl
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      setProgress(100);
      toast.success("Project uploaded and created successfully!");
      
      setTimeout(() => {
        router.push(`/dashboard/projects/${res.data.id}/settings`);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload project");
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && !uploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center w-full p-12 transition-all duration-300 border-2 border-dashed rounded-xl cursor-pointer
          ${isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border bg-card/50 hover:bg-card/80 hover:border-border/80'}
          ${file ? 'cursor-default' : ''}
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".zip,application/zip"
          className="hidden"
          disabled={uploading || !!file}
        />

        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center text-center space-y-4"
            >
              <div className="p-4 rounded-full bg-primary/10 text-primary">
                <UploadCloud className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Upload Source Code</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop a .zip file, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-2 opacity-75">
                  Max file size: 50MB. (Netlify-style deployment)
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center w-full"
            >
              <div className="flex items-center justify-between w-full max-w-md p-4 bg-background border rounded-lg shadow-sm">
                <div className="flex items-center space-x-4">
                  <div className="p-2 rounded-md bg-blue-500/10 text-blue-500">
                    <FileArchive className="w-6 h-6" />
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-sm font-medium truncate w-48">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                {!uploading && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {uploading && (
                <div className="w-full max-w-md mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {!uploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                  className="mt-6 px-8 py-2.5 bg-primary text-primary-foreground font-medium rounded-md shadow hover:bg-primary/90 transition-colors flex items-center space-x-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Deploy</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
