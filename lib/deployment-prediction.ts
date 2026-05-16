export interface DeploymentPrediction {
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    summary: string;
    signals: string[];
}

export function deriveDeploymentPrediction(input: {
    deployment: any;
    recentDeployments: any[];
    memory?: any | null;
    trustSignals?: any | null;
    envDrift?: any | null;
    attribution?: any | null;
}): DeploymentPrediction | null {
    const { deployment, recentDeployments, memory, envDrift } = input;

    if (!recentDeployments || recentDeployments.length < 3) {
        return null;
    }

    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    let confidence: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    const signals: string[] = [];

    const totalDeployments = recentDeployments.length;

    // Confidence Rules
    if (totalDeployments >= 10) {
        confidence = "HIGH";
    } else if (totalDeployments >= 5) {
        confidence = "MEDIUM";
    } else {
        confidence = "LOW";
    }

    // Pre-calculate data for rules
    const failedDeployments = recentDeployments.filter(d => d.status === 'failed');

    let sameCommitFails = 0;
    if (deployment.commit_sha) {
        sameCommitFails = recentDeployments.filter(d =>
            d.status === 'failed' && d.commit_sha === deployment.commit_sha
        ).length;
    }

    let last3Failed = false;
    if (recentDeployments.length >= 3) {
        // Assuming recentDeployments is sorted newest first
        const last3 = recentDeployments.slice(0, 3);
        last3Failed = last3.every(d => d.status === 'failed');
    }

    let buildTimeRegression = false;
    if (memory?.averageBuildTimeSeconds && deployment.started_at) {
        // If the current deployment has completed, we can check it. 
        // For active deployments, we might have to rely on elapsed time, 
        // but the requirement says "build time regression > 2x average memory build time"
        // We'll check if it has a completed_at or calculate from elapsed if available.
        // For safety, we only check if completed.
        if (deployment.completed_at) {
            const currentBuildTime = (new Date(deployment.completed_at).getTime() - new Date(deployment.started_at).getTime()) / 1000;
            if (currentBuildTime > (memory.averageBuildTimeSeconds * 2)) {
                buildTimeRegression = true;
            }
        }
    }

    let successRate = 0;
    if (memory?.successRatePercent !== undefined && memory?.successRatePercent !== null) {
        successRate = memory.successRatePercent;
    } else {
        const successCount = recentDeployments.filter(d => d.status === 'success' || d.status === 'completed').length;
        successRate = (successCount / totalDeployments) * 100;
    }

    const isDifferentSource = memory?.mostStableSource && deployment.source &&
        deployment.source.toLowerCase() !== memory.mostStableSource.toLowerCase();

    const recentFailuresExist = recentDeployments.slice(0, 5).some(d => d.status === 'failed');

    // HIGH RISK RULES
    if (sameCommitFails >= 2) {
        riskLevel = "HIGH";
        signals.push(`Commit ${deployment.commit_sha?.substring(0, 7) || 'this commit'} has failed ${sameCommitFails} times previously.`);
    }
    if (envDrift?.riskLevel === "HIGH") {
        riskLevel = "HIGH";
        signals.push("High environment drift detected.");
    }
    if (last3Failed) {
        riskLevel = "HIGH";
        signals.push("The last 3 deployments for this project have failed.");
    }
    if (buildTimeRegression) {
        riskLevel = "HIGH";
        signals.push("Current build time is more than double the historical average.");
    }

    // MEDIUM RISK RULES
    if (riskLevel !== "HIGH") {
        if (successRate < 60) {
            riskLevel = "MEDIUM";
            signals.push(`Recent success rate is below average (${Math.round(successRate)}%).`);
        }
        if (isDifferentSource) {
            riskLevel = "MEDIUM";
            signals.push(`Deployment source (${deployment.source}) differs from the historically stable source (${memory.mostStableSource}).`);
        }
        if (recentFailuresExist && !last3Failed) {
            riskLevel = "MEDIUM";
            signals.push("There have been intermittent failures in recent deployments.");
        }
    }

    // LOW RISK RULES (implicit if not HIGH or MEDIUM)
    if (riskLevel === "LOW") {
        if (successRate >= 80) {
            signals.push(`High historical success rate (${Math.round(successRate)}%).`);
        }
        if (memory?.mostStableSource && deployment.source && deployment.source.toLowerCase() === memory.mostStableSource.toLowerCase()) {
            signals.push(`Using the historically stable deployment source (${deployment.source}).`);
        }
        const lastDeploy = recentDeployments[0];
        if (lastDeploy && (lastDeploy.status === 'success' || lastDeploy.status === 'completed')) {
            signals.push("The previous deployment was successful.");
        }

        if (signals.length === 0) {
            signals.push("No significant risk patterns detected.");
        }
    }

    // Deduplicate signals just in case
    const uniqueSignals = Array.from(new Set(signals));

    let summary = "";
    if (riskLevel === "HIGH") {
        summary = "This deployment resembles patterns that previously resulted in failures.";
    } else if (riskLevel === "MEDIUM") {
        summary = "Some risk signals are present based on recent deployment history.";
    } else {
        summary = "Historically this deployment pattern has been stable.";
    }

    return {
        riskLevel,
        confidence,
        summary,
        signals: uniqueSignals
    };
}
