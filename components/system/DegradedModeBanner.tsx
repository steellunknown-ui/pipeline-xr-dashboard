"use client";

import { useState } from "react";
import { X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DegradedModeBannerProps {
  show: boolean;
  className?: string;
}

export function DegradedModeBanner({ show, className }: DegradedModeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) {
    return null;
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-blue-600" />
        <p className="text-sm text-blue-800">
          Some live data is temporarily unavailable. Showing last known information.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDismissed(true)}
        className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}