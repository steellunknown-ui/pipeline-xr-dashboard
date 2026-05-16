"use client";

import { File, Folder } from "lucide-react";

interface FileTreeViewerProps {
  files: Array<{ path: string; name: string; size: number }>;
}

export function FileTreeViewer({ files }: FileTreeViewerProps) {
  return (
    <div className="space-y-2 p-4 border rounded-lg bg-muted/50 max-h-64 overflow-y-auto">
      <h3 className="font-semibold flex items-center gap-2 sticky top-0 bg-muted/50 pb-2">
        <Folder className="h-4 w-4" />
        File Structure ({files.length} files)
      </h3>
      <div className="space-y-1 text-sm">
        {files.map((file, i) => (
          <div key={i} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <File className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono text-xs truncate">{file.path}</span>
            <span className="text-xs ml-auto">{(file.size / 1024).toFixed(1)}KB</span>
          </div>
        ))}
      </div>
    </div>
  );
}
