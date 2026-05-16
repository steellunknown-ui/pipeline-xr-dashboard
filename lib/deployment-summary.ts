export interface DeploymentSummary {
    outcome: "success" | "failed" | "building";
    headline: string;
    whatHappened: string[];
    recommendedNextStep: string;
}

export function deriveDeploymentSummary(input: {
    deployment: any;
    analysis?: any;
    attribution?: any;
    lineage?: any;
    replay?: any[];
    trustSignals?: any;
    decisionOptions?: any[];
}): DeploymentSummary | null {
    if (!input || !input.deployment) return null;

    const rawStatus = input.deployment.status;
    if (!rawStatus) return null;

    // STATUS NORMALIZATION REQUIRED:
    // success|completed => success
    // building|pending|in_progress => building
    let outcome: "success" | "failed" | "building" | null = null;
    if (rawStatus === "success" || rawStatus === "completed") {
        outcome = "success";
    } else if (rawStatus === "failed") {
        outcome = "failed";
    } else if (rawStatus === "building" || rawStatus === "pending" || rawStatus === "in_progress" || rawStatus === "queued") {
        outcome = "building";
    }

    if (!outcome) return null;

    const whatHappened: string[] = [];

    if (outcome === "success") {
        if (input.attribution?.summary) {
            whatHappened.push(input.attribution.summary);
        }

        if (input.trustSignals?.confidence) {
            const isHighTrust = input.trustSignals.confidence === 'HIGH';
            if (isHighTrust) {
                whatHappened.push("Pipeline XR detected high confidence based on recent successful deployments.");
            } else {
                whatHappened.push(`Pipeline XR detected ${input.trustSignals.confidence.toLowerCase()} confidence for this deployment.`);
            }
        } else {
            whatHappened.push("Pipeline XR is building trust signals for this project.");
        }

        return {
            outcome: "success",
            headline: "Deployment completed successfully",
            whatHappened,
            recommendedNextStep: "Monitor production or enable auto-deploy"
        };
    }

    if (outcome === "failed") {
        // FAILURE REASON fallback chain
        let failureReason = null;
        if (input.analysis?.failure_type || input.analysis?.short_reason) {
            failureReason = input.analysis.short_reason || input.analysis.failure_type;
        }
        // Sometimes the analysis might just have a string payload directly if passed wrong, but we handle the standard API output here.
        if (!failureReason && input.analysis?.summary) {
            failureReason = input.analysis.summary;
        }
        if (!failureReason && input.deployment.error_message) {
            failureReason = input.deployment.error_message;
        }
        if (!failureReason && input.replay && input.replay.length > 0) {
            const errorEvent = input.replay.find((e: any) => e.level === 'error');
            if (errorEvent) {
                failureReason = errorEvent.message || "Error found in deployment replay.";
            }
        }

        if (failureReason) {
            whatHappened.push(`Failure reason: ${failureReason}`);
        } else {
            whatHappened.push("Deployment encountered a critical error during execution.");
        }

        if (input.attribution?.summary) {
            whatHappened.push(input.attribution.summary);
        }

        return {
            outcome: "failed",
            headline: "Deployment failed before completion",
            whatHappened,
            recommendedNextStep: "Review logs or apply suggested fix"
        };
    }

    // outcome === "building"
    const currentStage = input.deployment.currentStage || rawStatus;
    whatHappened.push(`Current stage: ${currentStage}`);

    if (input.attribution?.summary) {
        whatHappened.push(input.attribution.summary);
    }

    return {
        outcome: "building",
        headline: "Deployment currently running",
        whatHappened,
        recommendedNextStep: "Continue monitoring deployment progress"
    };
}
