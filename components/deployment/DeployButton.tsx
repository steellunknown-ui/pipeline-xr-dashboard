"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Rocket, Loader2, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { triggerVercelDeploy } from "@/app/dashboard/actions/deployments";
import { addEnvVariable } from "@/app/dashboard/actions/environment";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface DeployButtonProps {
  projectId: string;
}

export function DeployButton({ projectId }: DeployButtonProps) {
  const [deploying, setDeploying] = useState(false);
  const [open, setOpen] = useState(false);
  const [needsEnv, setNeedsEnv] = useState<"no" | "yes" | null>(null);
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [addingEnv, setAddingEnv] = useState(false);
  const router = useRouter();

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const result = await triggerVercelDeploy({
        projectId,
        environment: "production",
      });

      if (result.success && result.data) {
        toast.success("Deployment started!");
        router.push(`/dashboard/deployments/${result.data.id}/logs`);
      } else {
        toast.error(result.error || "Failed to start deployment");
        setDeploying(false);
      }
    } catch (error) {
      toast.error("Failed to start deployment");
      setDeploying(false);
    }
  };

  const handleAddEnv = async () => {
    if (!envKey || !envValue) return toast.error("Key and Value required");
    setAddingEnv(true);
    const res = await addEnvVariable({
      key: envKey,
      value: envValue,
      environment: "production",
      project_id: projectId
    });
    setAddingEnv(false);
    if (res.success) {
      toast.success(`Added ${envKey}`);
      setEnvKey("");
      setEnvValue("");
    } else {
      toast.error(res.error || "Failed to add variable");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-zinc-100 text-black hover:bg-zinc-200">
          <Rocket className="w-4 h-4" /> Deploy Now
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-zinc-50 dark:bg-zinc-950 border dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle>Deployment Pre-flight Check</DialogTitle>
          <DialogDescription>
            Before we launch this project, we need to verify its configuration.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Does this project require Environment Variables?</Label>
            <RadioGroup 
              value={needsEnv || ""} 
              onValueChange={(val) => setNeedsEnv(val as "yes" | "no")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 border dark:border-zinc-800 p-3 rounded-lg flex-1 cursor-pointer" onClick={() => setNeedsEnv("no")}>
                <RadioGroupItem value="no" id="r1" />
                <Label htmlFor="r1" className="cursor-pointer">No, deploy immediately</Label>
              </div>
              <div className="flex items-center space-x-2 border dark:border-zinc-800 p-3 rounded-lg flex-1 cursor-pointer" onClick={() => setNeedsEnv("yes")}>
                <RadioGroupItem value="yes" id="r2" />
                <Label htmlFor="r2" className="cursor-pointer">Yes, add variables</Label>
              </div>
            </RadioGroup>
          </div>

          {needsEnv === "yes" && (
            <div className="space-y-3 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 animate-in fade-in slide-in-from-top-4">
              <h4 className="text-sm font-medium">Add Production Variables</h4>
              <div className="flex gap-2">
                <Input 
                  placeholder="KEY (e.g. DATABASE_URL)" 
                  value={envKey} 
                  onChange={(e) => setEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  className="dark:bg-zinc-950"
                />
                <Input 
                  placeholder="Value" 
                  value={envValue} 
                  onChange={(e) => setEnvValue(e.target.value)}
                  type="password"
                  className="dark:bg-zinc-950"
                />
              </div>
              <Button 
                type="button" 
                variant="secondary" 
                className="w-full gap-2" 
                onClick={handleAddEnv}
                disabled={addingEnv || !envKey || !envValue}
              >
                {addingEnv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Variable
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                You can add as many variables as you need before deploying.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between flex-row items-center border-t dark:border-zinc-800 pt-4">
          <p className="text-xs text-muted-foreground max-w-[200px]">
            AI ENV Guard will automatically scan your build logs if this fails.
          </p>
          <Button 
            onClick={handleDeploy} 
            disabled={deploying || !needsEnv}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {deploying ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting Build...</>
            ) : (
              <><Rocket className="w-4 h-4" /> Start Deployment</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
