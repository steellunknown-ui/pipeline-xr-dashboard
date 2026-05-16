import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GitCompare } from "lucide-react";

interface DisabledComparisonButtonProps {
  deploymentCount: number;
  className?: string;
}

export function DisabledComparisonButton({ deploymentCount, className }: DisabledComparisonButtonProps) {
  const isDisabled = deploymentCount < 2;
  
  if (!isDisabled) {
    return null; // Don't render if comparison is available
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={className}>
            <Button
              variant="outline"
              size="sm"
              disabled={true}
              className="opacity-50 cursor-not-allowed"
            >
              <GitCompare className="h-3 w-3 mr-1" />
              Compare
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Comparison becomes available after your second deployment.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}