"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { disableDeploymentProtection } from "@/app/dashboard/actions/vercel-protection";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";

export function FixChromeBlockingButton({ vercelProjectId, isVercelPreview }: { vercelProjectId: string, isVercelPreview: boolean }) {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [fixed, setFixed] = useState(false);

  if (!isVercelPreview || dismissed || fixed) return null;

  async function handleFix() {
    setLoading(true);
    const result = await disableDeploymentProtection(vercelProjectId);
    if (result.success) {
      toast.success("Done! URLs will now open in all browsers.");
      setFixed(true);
    } else {
      toast.error("Failed to update Vercel settings. You may need to do it manually in Vercel Dashboard.");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-semibold mb-1">Seeing 'blocked' in Chrome?</p>
          <p className="opacity-90">
            Vercel Deployment Protection blocks preview URLs in Chrome. 
            <a href="https://vercel.com/docs/security/deployment-protection" target="_blank" rel="noopener noreferrer" className="underline ml-1 hover:text-yellow-700">Learn more</a>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          size="sm"
          className="bg-yellow-500/20 border-yellow-500/30 hover:bg-yellow-500/30 text-yellow-700 w-full sm:w-auto"
          onClick={handleFix}
          disabled={loading}
        >
          {loading ? "Fixing..." : "Fix Chrome Blocking"}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-600 hover:bg-yellow-500/20" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
