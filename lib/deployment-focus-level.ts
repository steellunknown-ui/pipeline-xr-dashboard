export type OperatorFocusLevel =
    | "STABLE"
    | "WATCH"
    | "FOCUS"
    | "HIGH_ATTENTION";

export interface DeploymentFocusState {
    level: OperatorFocusLevel;
    headline: string;
    explanation: string;
    signals: string[];
}

export function deriveDeploymentFocusLevel(input: {
    deployment: {
        status: string;
        error_message?: string | null;
        [key: string]: any;
    };
    prediction?: any | null;
    trustSignals?: any | null;
    confidenceCalibration?: any | null;
    operatorState?: any | null;
    envDrift?: any | null;
    memory?: any | null;
}): DeploymentFocusState | null {
    const {
        deployment,
        prediction,
        trustSignals,
        confidenceCalibration,
        operatorState,
        envDrift,
        memory
    } = input;

    if (!deployment || !deployment.status) {
        return null;
    }

    // 1) HIGH_ATTENTION
    if (
        deployment.status === "failed" ||
        prediction?.riskLevel === "HIGH" ||
        operatorState?.mode === "FAILED" ||
        envDrift?.riskLevel === "HIGH"
    ) {
        const signals: string[] = [];
        if (deployment.status === "failed" || operatorState?.mode === "FAILED") signals.push("Recent deployment failed");
        if (prediction?.riskLevel === "HIGH") signals.push("High risk pattern detected in historical predictions");
        if (envDrift?.riskLevel === "HIGH") signals.push("Environment changes increased execution risk");

        return {
            level: "HIGH_ATTENTION",
            headline: "High attention recommended",
            explanation: "This deployment shows signals that require immediate review.",
            signals: Array.from(new Set(signals))
        };
    }

    // 2) FOCUS
    if (
        deployment.status === "building" ||
        deployment.status === "pending" ||
        deployment.status === "in_progress" ||
        prediction?.riskLevel === "MEDIUM" ||
        operatorState?.mode === "RECOVERING"
    ) {
        const signals: string[] = [];
        if (deployment.status === "building" || deployment.status === "pending" || deployment.status === "in_progress") {
            signals.push("Deployment currently running");
        }
        if (operatorState?.mode === "RECOVERING") signals.push("System recovering from previous issue");
        if (prediction?.riskLevel === "MEDIUM") signals.push("Medium risk indicators present in historical patterns");

        return {
            level: "FOCUS",
            headline: "Focused monitoring recommended",
            explanation: "Deployment is active or recovering. Monitor progress and outcomes.",
            signals: Array.from(new Set(signals))
        };
    }

    // 3) WATCH
    const hasLowConfidence = confidenceCalibration?.level === "LOW";
    const hasLowTrust = trustSignals?.recommendationConfidence === "LOW";
    const hasModerateSuccess = memory?.successRatePercent !== undefined && memory.successRatePercent < 70;

    if (hasLowConfidence || hasLowTrust || hasModerateSuccess) {
        const signals: string[] = [];
        if (hasLowConfidence) signals.push("Limited historical confidence");
        if (hasLowTrust) signals.push("Trust signals indicate low baseline certainty");
        if (hasModerateSuccess) signals.push("Recent success rate is moderate");

        return {
            level: "WATCH",
            headline: "Keep under observation",
            explanation: "System is stable but historical data suggests light monitoring.",
            signals: Array.from(new Set(signals))
        };
    }

    // 4) STABLE (default)
    return {
        level: "STABLE",
        headline: "System stable",
        explanation: "Deployment patterns look healthy. No immediate attention required.",
        signals: [
            "Recent deployments are consistent",
            "No elevated risk detected"
        ]
    };
}
