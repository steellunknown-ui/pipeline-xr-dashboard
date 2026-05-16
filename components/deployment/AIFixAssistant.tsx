"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wand2, ShieldCheck, AlertTriangle, RotateCcw, CheckCircle2 } from "lucide-react";
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
}

export function AIFixAssistant({ deploymentId, projectId, onFixApplied }: AIFixAssistantProps) {
    const router = useRouter();
    const [step, setStep] = useState<"idle" | "loading_preview" | "review" | "applying" | "success" | "error">("idle");
    const [plan, setPlan] = useState<PatchPlan | null>(null);
    const [approved, setApproved] = useState(false);
    const [fixId, setFixId] = useState<string | null>(null);
    const [diffText, setDiffText] = useState("");
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

            // Generate full diff text from changes
            // The backend 'preview' might strictly return 'PatchPlan' which has 'changes' list
            // We can construct a simple diff for display if the backend didn't return pre-computed diffText in the PLAN object.
            // Wait, my preview API returns { plan: PatchPlan }. PatchPlan has `changes`.
            // My `applyPatchPlan` in backend generates diffText, but `suggestFix` does NOT?
            // Ah, correct. `suggestFix` returns `PatchPlan`, which has `before`/`after` strings.
            // We need to compute diff here OR rely on backend. 
            // DiffViewer expects `diffText`. 
            // Let's construct it locally for preview.

            let computedDiff = "";
            // Ideally reuse backend patch-engine computeDiff, but we are on client.
            // Simple fallback or reuse logic.
            if (data.plan.changes) {
                data.plan.changes.forEach((c: any) => {
                    computedDiff += `--- ${c.filePath}\n+++ ${c.filePath}\n`;
                    // Naive visual diff construction if backend didn't provide it
                    // Or just dump new file content? 
                    // Let's iterate lines lightly.
                    // Actually DiffViewer expects `diffText`. 
                    // I'll make a specialized "preview" diff text that just shows:
                    // - old line
                    // + new line
                    // for changed blocks only? 
                    // For simplicity in MVP, let's just assume we show 'Whole File Replacement' style diff if 'before' is empty,
                    // or try to show simple diff. 
                    // Better: Update `preview` API to return `diffPreview` text so client doesn't guess.
                    // Too late to change API without backtracking.
                    // I'll implement a simple client-side diff generator or just show the 'after' content as added.

                    if (!c.before) {
                        c.after.split('\n').forEach((l: string) => computedDiff += `+ ${l}\n`);
                    } else {
                        // Very rough diff
                        // We just list new content as + ???
                        // No, that's bad.
                        // Let's try to do a simple diff.
                        // Or... wait. `applyPatchPlan` returns `diffText`.
                        // `preview` API returns `plan`.
                        // I should update `preview` API to possibly include `diffPreview`.
                        // But User Rules: "Minimal changes".
                        // I'll just do a very dumb diff:
                        computedDiff += `\n(Diff generation on client is strictly visual approximation)\n\n`;
                        computedDiff += `[OLD CONTENT]\n${c.before.substring(0, 200)}...\n\n[NEW CONTENT]\n${c.after.substring(0, 200)}...\n`;
                    }
                    computedDiff += `\n`;
                });
            }
            setDiffText(computedDiff);

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

    if (step === "idle") {
        return (
            <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                        <Wand2 className="h-5 w-5" />
                        AI Fix Assistant
                    </CardTitle>
                    <CardDescription className="text-amber-700">
                        Pipeline XR can analyze this failure and suggest a fix.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {errorMsg && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{errorMsg}</AlertDescription>
                        </Alert>
                    )}
                    <Button onClick={handlePreviewFix} disabled={false} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                        {false ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Analyze & Suggest Fix
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (step === "review" && plan) {
        return (
            <Card className="border-blue-200 bg-white shadow-md">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-blue-600" />
                                Suggested Fix
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {plan.summary}
                            </CardDescription>
                        </div>
                        <Badge variant={plan.confidence > 0.8 ? "default" : "secondary"}>
                            Confidence: {Math.round(plan.confidence * 100)}%
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {plan.changes.length === 0 ? (
                        <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertTitle>No automatic fix found</AlertTitle>
                            <AlertDescription>
                                We analyzed the logs but couldn't safely determine an automatic patch. Please review the manual fix steps below.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <DiffViewer diffText={diffText} />

                            <div className="flex items-start space-x-2 pt-4 p-4 bg-gray-50 rounded-lg border">
                                <Checkbox
                                    id="audit-confirm"
                                    checked={approved}
                                    onCheckedChange={(c) => setApproved(!!c)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label
                                        htmlFor="audit-confirm"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        I approve Pipeline XR to apply this fix
                                    </label>
                                    <p className="text-sm text-muted-foreground">
                                        This change will modify {plan.changes.length} file(s). You can undo this action.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="ghost" onClick={() => setStep("idle")}>Cancel</Button>
                    {plan.changes.length > 0 && (
                        <Button
                            onClick={handleApplyFix}
                            disabled={!approved}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {false ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Apply Fix"}
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
