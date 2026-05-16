export interface DeploymentMemory {
    successRatePercent: number | null;
    averageBuildTimeSeconds: number | null;
    mostStableSource: "github" | "zip" | "manual" | null;
    commonFailureReason: string | null;
    recentFailureCount: number;
    totalDeploymentsAnalyzed: number;
    memoryConfidence: "LOW" | "MEDIUM" | "HIGH";
    summary: string;
}

export function deriveDeploymentMemory(input: {
    deployments: Array<{
        status: string;
        source?: string | null;
        error_message?: string | null;
        started_at?: string | null;
        completed_at?: string | null;
    }>;
}): DeploymentMemory | null {
    if (!input.deployments || input.deployments.length < 2) {
        return null;
    }

    const deployments = input.deployments;
    const totalDeployments = deployments.length;

    // 2) successRatePercent
    const successfulDeployments = deployments.filter(d =>
        d.status === 'success' || d.status === 'completed'
    ).length;
    const successRatePercent = totalDeployments > 0
        ? Math.round((successfulDeployments / totalDeployments) * 100)
        : 0;

    // 3) averageBuildTimeSeconds
    let totalBuildTime = 0;
    let validTimestampsCount = 0;

    for (const d of deployments) {
        if (d.started_at && d.completed_at) {
            const start = new Date(d.started_at).getTime();
            const end = new Date(d.completed_at).getTime();
            if (!isNaN(start) && !isNaN(end) && end >= start) {
                totalBuildTime += (end - start) / 1000;
                validTimestampsCount++;
            }
        }
    }

    const averageBuildTimeSeconds = validTimestampsCount > 0
        ? Math.round(totalBuildTime / validTimestampsCount)
        : null;

    // 4) mostStableSource
    const sourceStats: Record<string, { total: number; success: number }> = {};

    for (const d of deployments) {
        if (d.source) {
            if (!sourceStats[d.source]) {
                sourceStats[d.source] = { total: 0, success: 0 };
            }
            sourceStats[d.source].total++;
            if (d.status === 'success' || d.status === 'completed') {
                sourceStats[d.source].success++;
            }
        }
    }

    let mostStableSource: "github" | "zip" | "manual" | null = null;
    let highestSuccessRatio = -1;
    let tie = false;

    for (const [source, stats] of Object.entries(sourceStats)) {
        // Only consider sources with at least 1 deployment
        if (stats.total > 0) {
            const ratio = stats.success / stats.total;
            // Allow only known sources that match the literal type as best effort,
            // though typically they will align with these depending on codebase values.
            const normalizedSource = source.toLowerCase();
            const isValidSource = normalizedSource === 'github' || normalizedSource === 'zip' || normalizedSource === 'manual';

            if (isValidSource) {
                if (ratio > highestSuccessRatio) {
                    highestSuccessRatio = ratio;
                    mostStableSource = normalizedSource as any;
                    tie = false;
                } else if (ratio === highestSuccessRatio) {
                    tie = true;
                }
            }
        }
    }

    if (tie) {
        mostStableSource = null;
    }

    // 5) commonFailureReason
    let failedCount = 0;
    let envFails = 0;
    let moduleFails = 0;
    let timeoutFails = 0;
    let otherFails = 0;

    for (const d of deployments) {
        if (d.status === 'failed' && d.error_message) {
            failedCount++;
            const msg = d.error_message.toLowerCase();
            if (msg.includes('env')) {
                envFails++;
            } else if (msg.includes('module')) {
                moduleFails++;
            } else if (msg.includes('timeout')) {
                timeoutFails++;
            } else {
                otherFails++;
            }
        }
    }

    let commonFailureReason: string | null = null;
    if (failedCount > 0) {
        const max = Math.max(envFails, moduleFails, timeoutFails, otherFails);
        if (max === envFails) commonFailureReason = "Environment configuration";
        else if (max === moduleFails) commonFailureReason = "Missing dependency";
        else if (max === timeoutFails) commonFailureReason = "Build timeout";
        else commonFailureReason = "Build or configuration issue";
    }

    // 6) recentFailureCount (failures in last 5 deployments)
    // Assuming deployments array is ordered latest first or we just take the first 5
    // Usually the API fetched is ordered by created_at DESC.
    const recentDeployments = deployments.slice(0, 5);
    const recentFailureCount = recentDeployments.filter(d => d.status === 'failed').length;

    // 7) memoryConfidence
    let memoryConfidence: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (totalDeployments >= 10) {
        memoryConfidence = "HIGH";
    } else if (totalDeployments >= 5) {
        memoryConfidence = "MEDIUM";
    }

    // 8) summary
    const summary = `Based on recent deployments, this project succeeds ${successRatePercent}% of the time.`;

    return {
        successRatePercent,
        averageBuildTimeSeconds,
        mostStableSource,
        commonFailureReason,
        recentFailureCount,
        totalDeploymentsAnalyzed: totalDeployments,
        memoryConfidence,
        summary
    };
}
