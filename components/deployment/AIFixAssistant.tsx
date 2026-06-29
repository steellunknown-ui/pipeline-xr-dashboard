"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wand2, ShieldCheck, AlertTriangle, RotateCcw, CheckCircle2, Sparkles } from "lucide-react";
import { DiffViewer } from "./DiffViewer";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AIFixAssistantProps {
    deploymentId: string;
    projectId: string;
    onFixApplied?: () => void;
}

interface PatchPlan {
    title: string;
    summary: string;
    confidence: number;
    changes: {
        filePath: string;
        reason: string;
        before: string;
        after: string;
    }[];
    fix_steps?: string[];
}

export function AIFixAssistant({ deploymentId, projectId, onFixApplied }: AIFixAssistantProps) {
    const router = useRouter();
    const [step, setStep] = useState<"idle" | "loading_preview" | "review" | "applying" | "success" | "error">("idle");
    const [plan, setPlan] = useState<PatchPlan | null>(null);
    const [approved, setApproved] = useState(false);
    const [fixId, setFixId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    const handlePreviewFix = async () => {
        setStep("loading_preview");
        setErrorMsg("");

        try {
            const res = await fetch(`/api/deployments/${deploymentId}/fix/preview`, {
                method: "POST",
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to generate fix preview");
            }

            setPlan(data.plan);
            setStep("review");
        } catch (err: any) {
            setErrorMsg(err.message);
            setStep("idle"); // reset to allow retry
            // showing error inside idle state or separate error state?
            // Let's show alert below button.
        }
    };

    const handleApplyFix = async () => {
        if (!plan || !approved) return;
        setStep("applying");

        try {
            const res = await fetch(`/api/deployments/${deploymentId}/fix/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approved: true, plan }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to apply fix");
            }

            setFixId(data.fixId);
            setStep("success");
            toast.success("Fix applied successfully");
            if (onFixApplied) onFixApplied();
            router.refresh();
        } catch (err: any) {
            setErrorMsg(err.message);
            setStep("review"); // Go back to review on error
        }
    };

    const handleUndoFix = async () => {
        if (!fixId) return;
        // Undo logic...
        try {
            const res = await fetch(`/api/deployments/${deploymentId}/fix/undo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fixId }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Fix undone");
                setStep("idle");
                setFixId(null);
                setPlan(null);
                router.refresh();
            } else {
                toast.error(data.error || "Undo failed");
            }
        } catch (e) {
            toast.error("Undo request failed");
        }
    };

    if (step === "idle" || step === "loading_preview") {
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
                <CardContent className="relative z-10">
                    {errorMsg && (
                        <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200 backdrop-blur">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{errorMsg}</AlertDescription>
                        </Alert>
                    )}
                    <Button 
                        onClick={handlePreviewFix} 
                        disabled={step === "loading_preview"} 
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border-0"
                    >
                        {step === "loading_preview" ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Running deep analysis...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                                Analyze & Suggest Fix
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if ((step === "review" || step === "applying") && plan) {
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
                                {plan.summary}
                            </CardDescription>
                        </div>
                        <Badge variant={plan.confidence > 0.8 ? "default" : "secondary"} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 shadow-sm px-3 py-1 text-sm">
                            Confidence: {Math.round(plan.confidence * 100)}%
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                    {plan.changes.length === 0 ? (
                        <Alert className="bg-gradient-to-r from-amber-50 to-yellow-50/50 border-amber-200/50 shadow-sm backdrop-blur-sm">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            <AlertTitle className="text-amber-800 font-semibold text-base">Workspace Unavailable</AlertTitle>
                            <AlertDescription className="text-amber-700/90 mt-2">
                                <p>We analyzed the logs but couldn't apply an automatic patch because this deployment was triggered via GitHub, so the local workspace is gone.</p>
                                <p className="mt-2 font-medium">Please review the manual fix steps below:</p>
                                {plan.fix_steps && plan.fix_steps.length > 0 && (
                                    <ul className="list-disc pl-5 mt-3 space-y-2 bg-white/50 p-4 rounded-lg border border-amber-100/50 shadow-inner">
                                        {plan.fix_steps.map((step, i) => (
                                            <li key={i} className="text-amber-900">{step}</li>
                                        ))}
                                    </ul>
                                )}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <div className="w-full">
                                <DiffViewer changes={plan.changes} />
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
                                        I approve Pipeline XR to apply this fix
                                    </label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        This change will safely modify {plan.changes.length} file(s) in your repository. You can undo this action later.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between relative z-10 border-t bg-muted/20 pt-4">
                    <Button variant="ghost" onClick={() => setStep("idle")} className="hover:bg-red-50 hover:text-red-600 transition-colors">Discard</Button>
                    {plan.changes.length > 0 && (
                        <Button
                            onClick={handleApplyFix}
                            disabled={!approved || step === "applying"}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all hover:scale-[1.02] border-0"
                        >
                            {step === "applying" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Apply Fix to Repository
                        </Button>
                    )}
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
                        The patch has been safely applied to your workspace.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Button onClick={() => router.push(`/dashboard/projects/${projectId}/deployments`)} className="bg-green-600 hover:bg-green-700">
                            Top Return to Deployments
                        </Button>
                        <Button variant="outline" onClick={handleUndoFix} className="border-green-200 hover:bg-green-100 text-green-800">
                            <RotateCcw className="mr-2 h-4 w-4" /> Undo Fix
                        </Button>
                    </div>
                    <p className="mt-4 text-sm text-green-700">
                        To see this fix in action, please <strong>Redeploy</strong> using the button at the top of the page.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return null;
}
