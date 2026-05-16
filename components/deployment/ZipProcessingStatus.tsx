"use client";

import { CheckCircle, AlertCircle, FileCode, Package, Settings } from "lucide-react";

interface ZipProcessingStatusProps {
  analysis: {
    fileCount: number;
    framework: string;
    buildCommand: string;
    hasPackageJson: boolean;
    hasNodeModules: boolean;
    configFiles: string[];
    dependencies: string[];
    envVars: string[];
  };
}

export function ZipProcessingStatus({ analysis }: ZipProcessingStatusProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <h3 className="font-semibold flex items-center gap-2">
        <FileCode className="h-4 w-4" />
        Analysis Results
      </h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Files Detected</p>
          <p className="font-medium">{analysis.fileCount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Framework</p>
          <p className="font-medium">{analysis.framework}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Build Command</p>
          <p className="font-mono text-xs">{analysis.buildCommand}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Package.json</p>
          <p className="flex items-center gap-1">
            {analysis.hasPackageJson ? (
              <><CheckCircle className="h-3 w-3 text-green-500" /> Found</>
            ) : (
              <><AlertCircle className="h-3 w-3 text-red-500" /> Missing</>
            )}
          </p>
        </div>
      </div>

      {analysis.configFiles.length > 0 && (
        <div>
          <p className="text-sm font-medium flex items-center gap-2 mb-2">
            <Settings className="h-4 w-4" />
            Config Files ({analysis.configFiles.length})
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            {analysis.configFiles.slice(0, 5).map((file, i) => (
              <div key={i} className="font-mono">{file}</div>
            ))}
          </div>
        </div>
      )}

      {analysis.envVars.length > 0 && (
        <div>
          <p className="text-sm font-medium flex items-center gap-2 mb-2">
            <Package className="h-4 w-4" />
            Environment Variables ({analysis.envVars.length})
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            {analysis.envVars.slice(0, 5).map((envVar, i) => (
              <div key={i} className="font-mono">{envVar}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
