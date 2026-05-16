export interface OperatorState {
    mode: "IDLE" | "RUNNING" | "RECOVERING" | "FAILED" | "STABLE";
    headline: string;
    signals: string[];
    recommendedFocus: string;
}

export function deriveOperatorState(input: {
    deployment: any;
    replay?: any[] | null;
    prediction?: any | null;
    confidence?: any | null;
    freeze?: any | null;
    lineage?: any | null;
}): OperatorState | null {
    const { deployment, freeze, lineage } = input;
    const status = deployment?.status;
    const isFrozen = freeze?.frozen === true;

    if (!status) {
        return {
            mode: "IDLE",
            headline: "System is idle",
            signals: ["No active deployment state detected"],
            recommendedFocus: "Awaiting next operational command"
        };
    }

    // Check for RECOVERING
    // If the current deployment is running/pending AND it's a redeploy meant to fix a previous failure
    // or if the *last* deployment failed, and this is a new one... The prompt says: "failed deployment + redeploy lineage exists"
    // Since we don't have lineage explicit in this prompt for derivation arguments, we'll infer it if it's currently building but previous failed.
    // The simplest interpretation of "failed deployment + redeploy lineage exists" in this context is if 
    // the current deployment is fixing something. Wait, the prompt says "redeploy lineage exists". Let's check `deployment.lineage` or similar if passed,
    // but let's stick to what's provided. Actually, we don't have recentDeployments in the input signature specified by the prompt:
    // `deriveOperatorState(input: { deployment: any; replay?: any[] | null; prediction?: any | null; confidence?: any | null; freeze?: any | null; })`
    // We can look at `deployment.status === "failed"`. Wait, if deployment status is failed, it's FAILED mode.
    // Wait, if "redeploy lineage exists" -> it means it's a new deployment attempting to recover. Let's assume if `deployment.is_rollback` or something.
    // Actually, we can just say if the current deployment's status is "building" but we know the *previous* failed... 
    // without `recentDeployments` we might not know previous.
    // Let's rely on standard fields. We will use a fallback or an implicit check. 
    // Actually, if we pass `deployment.lineage` down, we can check it. Let's accept `lineage?: any` as well since the prompt implies lineage.

    const isRecovering = input.deployment?.is_rollback || input.deployment?.pipeline_run_type === "recovery" || (lineage && (lineage.isRedeploy || lineage.isRollback || (lineage.label && lineage.label.toLowerCase().includes("redeploy"))));
    // As a safe fallback, we'll just check if there's a specific 'recovery' flag or if lineage says it's recovering.
    // The user might pass `lineage` in `deployment: { ...deployment, lineage }` from the UI or API.

    if (status === "building" || status === "pending" || status === "in_progress") {
        // We could make this smarter if lineage is passed, but for now:
        const signals = [];
        if (deployment.currentStage) {
            signals.push(`Current stage: ${deployment.currentStage}`);
        } else {
            signals.push("Execution engine is actively processing the deployment");
        }

        if (isRecovering || input.deployment?.lineage?.isRecovery || input.deployment?.isRecovery) {
            return {
                mode: "RECOVERING",
                headline: "System is recovering from a previous failure",
                signals,
                recommendedFocus: "Monitor new deployment stability"
            };
        }

        return {
            mode: "RUNNING",
            headline: "Deployment is actively running",
            signals,
            recommendedFocus: "Monitor logs and wait for completion"
        };
    }

    if (status === "failed") {
        const signals = [];
        const reason = deployment.error_message || "Unknown error encountered during execution";
        signals.push(reason);

        return {
            mode: "FAILED",
            headline: "Deployment stopped before completion",
            signals,
            recommendedFocus: "Review failure signals before retrying"
        };
    }

    if ((status === "success" || status === "completed") && isFrozen) {
        return {
            mode: "STABLE",
            headline: "Deployment is stable and frozen",
            signals: ["Production integrity lock engaged"],
            recommendedFocus: "Observe production behavior"
        };
    }

    if (status === "success" || status === "completed") {
        return {
            mode: "STABLE",
            headline: "System is stable",
            signals: ["Deployment completed without errors"],
            recommendedFocus: "System is operating normally"
        };
    }

    return {
        mode: "IDLE",
        headline: "System is idle",
        signals: [`Current state: ${status}`],
        recommendedFocus: "Awaiting next operational command"
    };
}
