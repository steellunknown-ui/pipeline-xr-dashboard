"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wand2, ShieldCheck, AlertTriangle, RotateCcw, CheckCircle2, Sparkles, Terminal } from "lucide-react";
import { DiffViewer } from "./DiffViewer";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface AIFixAssistantProps {
    deploymentId: string;
    projectId: string;
    onFixApplied?: () => void;
    // strategy passed from the parent modal
    strategy?: 'direct_push' | 'pull_request';
    aiFixStatus?: string | null;
}

interface PatchPlan {
    file: string;
    reason: string;
    confidence: number;
    oldCode: string;
    newCode: string;
    lineStart?: number;
    lineEnd?: number;
}

export function AIFixAssistant({ deploymentId, projectId, onFixApplied, aiFixStatus }: AIFixAssistantProps) {
    const router = useRouter();
    const [step, setStep] = useState<"idle" | "investigating" | "review" | "applying" | "success" | "error">("idle");
    const [plan, setPlan] = useState<PatchPlan | null>(null);
    const [approved, setApproved] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [strategy, setStrategy] = useState<'direct_push' | 'pull_request'>('direct_push');
    
    // Live Action Stream state
    const [actionLog, setActionLog] = useState<{ step: string, text: string }[]>([]);

    useEffect(() => {
        if (aiFixStatus === "env_error") {
            setErrorMsg("These environment variables are missing or invalid. Please add them in Project Settings → Environment Variables and deploy again.");
            setStep("error");
        }
    }, [aiFixStatus]);

    useEffect(() => {
        // Expose a global or triggerable function if parent wants to start it programmatically
        // Or we can just have it start when "investigating" is set by parent, but for now we'll 
        // rely on a button click inside here or pass a prop.
    }, []);

    const startInvestigation = () => {
        setStep("investigating");
        setErrorMsg("");
        setActionLog([]);
        setPlan(null);

        let resolved = false;
        const eventSource = new EventSource(`/api/ai-fix?deploymentId=${deploymentId}`);

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);

                if (data.type === "step") {
                    setActionLog(prev => [...prev, { step: data.step, text: data.text }]);
                }
                else if (data.type === "FIX_READY") {
                    resolved = true;
                    setPlan(data.fix);
                    setStep("review");
                    eventSource.close();
                }
                else if (data.type === "ENV_ERROR") {
                    resolved = true;
                    setErrorMsg(data.message);
                    setStep("error");
                    eventSource.close();
                }
                else if (data.type === "error") {
                    resolved = true;
                    setErrorMsg(data.message);
                    setStep("error");
                    eventSource.close();
                }
            } catch (err) {
                console.error("Failed to parse SSE", err);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            if (!resolved) {
                // Fetch once to get the real HTTP error message (401, 500, etc.)
                fetch(`/api/ai-fix?deploymentId=${deploymentId}`)
                    .then(async (res) => {
                        const text = await res.text().catch(() => `HTTP ${res.status}`);
                        setErrorMsg(`AI engine error (${res.status}): ${text}`);
                    })
                    .catch(() => {
                        setErrorMsg("AI engine unreachable. Check GITHUB_PAT and PIPELINE_XR_VERCEL_TOKEN are set, then retry.");
                    })
                    .finally(() => setStep("error"));
            }
        };
    };

    const handleApplyFix = async () => {
        if (!plan || !approved) return;
        setStep("applying");

        try {
            const res = await fetch(`/api/ai-fix/push`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    deploymentId, 
                    strategy,
                    fixData: plan 
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to apply fix");
            }

            setStep("success");
            toast.success("Fix pushed successfully via " + (strategy === 'direct_push' ? "Direct Push" : "Pull Request"));
            if (onFixApplied) onFixApplied();
            router.refresh();
        } catch (err: any) {
            setErrorMsg(err.message);
            setStep("review");
        }
    };

    if (step === "idle" || step === "error") {
        return (
            <Card className="relative overflow-hidden border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-orange-50/50 backdrop-blur-xl shadow-lg group transition-all duration-500 hover:shadow-xl hover:border-amber-300/50">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_2s_infinite]" />
                
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-inner">
                            <Wand2 className="h-4 w-4 text-white" />
                        </div>
                        AI Fix Assistant
                    </CardTitle>
                    <CardDescription className="text-amber-700/80">
                        Pipeline XR can deeply analyze this failure and generate an automatic patch.
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 space-y-6">
                    {errorMsg && (
                        <Alert variant="destructive" className="bg-red-50 border-red-200 backdrop-blur text-red-800">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Action Required</AlertTitle>
                            <AlertDescription>{errorMsg}</AlertDescription>
                        </Alert>
                    )}
                    
                    <RadioGroup value={strategy} onValueChange={(val: any) => setStrategy(val)} className="space-y-4">
                        <div className="flex items-start space-x-3 rounded-lg border border-amber-200/50 bg-white/50 p-4 transition-colors hover:border-amber-400/50">
                            <RadioGroupItem value="direct_push" id="direct_push" className="mt-1 border-amber-500 text-amber-600" />
                            <div className="space-y-1">
                                <Label htmlFor="direct_push" className="text-base font-medium text-amber-900 cursor-pointer">
                                    Direct Push (Maximum Speed)
                                </Label>
                                <p className="text-sm text-amber-700/80">
                                    The AI will push the fix directly to your branch. Ideal for fast iterative fixes.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3 rounded-lg border border-amber-200/50 bg-white/50 p-4 transition-colors hover:border-amber-400/50">
                            <RadioGroupItem value="pull_request" id="pull_request" className="mt-1 border-amber-500 text-amber-600" />
                            <div className="space-y-1">
                                <Label htmlFor="pull_request" className="text-base font-medium text-amber-900 cursor-pointer">
                                    Pull Request (Safe)
                                </Label>
                                <p className="text-sm text-amber-700/80">
                                    The AI will create a new branch and open a PR. You can review the code before merging.
                                </p>
                            </div>
                        </div>
                    </RadioGroup>

                    <Button 
                        onClick={startInvestigation} 
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border-0"
                    >
                        <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                        Start AI Investigation
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (step === "investigating") {
        return (
            <Card className="border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 overflow-hidden relative shadow-lg">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 animate-[shimmer_2s_infinite]" />
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-800">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                        AI Agent Investigating...
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-black/90 p-4 rounded-lg border border-zinc-800 font-mono text-sm space-y-2 h-[200px] overflow-y-auto">
                        <div className="text-zinc-500 flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
                            <Terminal className="h-4 w-4" /> pipeline-agent-v2
                        </div>
                        {actionLog.map((log, i) => (
                            <div key={i} className="text-green-400 animate-in fade-in slide-in-from-bottom-2">
                                {log.text}
                            </div>
                        ))}
                        <div className="text-zinc-500 animate-pulse">_</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if ((step === "review" || step === "applying") && plan) {
        // Map the new PatchPlan structure to DiffViewer's expected structure if needed
        const changesForDiff = [{
            filePath: plan.file,
            reason: plan.reason,
            before: plan.oldCode,
            after: plan.newCode
        }];

        return (
            <Card className="relative overflow-hidden border-blue-200/60 bg-gradient-to-br from-white to-blue-50/30 dark:from-zinc-950 dark:to-zinc-900 shadow-xl backdrop-blur-xl transition-all duration-500">
                <div className="absolute top-0 right-0 p-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <CardHeader className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <ShieldCheck className="h-5 w-5 text-white" />
                                </div>
                                Suggested Fix
                            </CardTitle>
                            <CardDescription className="mt-2 text-base">
                                {plan.reason}
                            </CardDescription>
                        </div>
                        <Badge variant={plan.confidence > 80 ? "default" : "secondary"} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 shadow-sm px-3 py-1 text-sm">
                            Confidence: {plan.confidence}%
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                    <div className="w-full">
                        <DiffViewer changes={changesForDiff} />
                    </div>

                    <div className="flex items-start space-x-3 p-5 bg-gradient-to-br from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-900/50 rounded-xl border border-border/50 shadow-sm">
                        <Checkbox
                            id="audit-confirm"
                            checked={approved}
                            onCheckedChange={(c) => setApproved(!!c)}
                            className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="audit-confirm"
                                className="text-base font-semibold leading-none cursor-pointer"
                            >
                                I approve Pipeline XR to apply this fix to GitHub
                            </label>
                            <p className="text-sm text-muted-foreground mt-1">
                                This change will modify <span className="font-mono text-xs">{plan.file}</span> via a {strategy === 'pull_request' ? "Pull Request" : "Direct Push to branch"}.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between relative z-10 border-t bg-muted/20 pt-4">
                    <Button variant="ghost" onClick={() => setStep("idle")} className="hover:bg-red-50 hover:text-red-600 transition-colors">Discard</Button>
                    <Button
                        onClick={handleApplyFix}
                        disabled={!approved || step === "applying"}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all hover:scale-[1.02] border-0"
                    >
                        {step === "applying" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Apply Fix to Repository
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (step === "success") {
        return (
            <Card className="border-green-200 bg-green-50">
                <CardHeader>
                    <CardTitle className="text-green-800 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        Fix Applied Successfully
                    </CardTitle>
                    <CardDescription className="text-green-700">
                        The patch has been pushed to GitHub using {strategy === 'pull_request' ? "a Pull Request" : "Direct Push"}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Button onClick={() => window.location.reload()} className="bg-green-600 hover:bg-green-700">
                            Refresh Deployment
                        </Button>
                    </div>
                    {strategy === 'direct_push' && (
                        <p className="mt-4 text-sm text-green-700">
                            Vercel is now building the new commit. Check the logs above.
                        </p>
                    )}
                </CardContent>
            </Card>
        );
    }

    return null;
}
