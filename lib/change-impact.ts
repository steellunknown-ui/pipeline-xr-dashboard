// PRIORITY 8.3: Human-Readable Change Impact Summary
// READ-ONLY deterministic analysis using ONLY real deployment data

export interface ChangeImpact {
    hasPrevious: boolean;
    summary: string;
    changeTypes: string[];
    impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
    confidence: number;
}

interface DeploymentData {
    id: string;
    commit_sha?: string | null;
    commit_hash?: string | null;
    source?: string | null;
    status?: string;
    build_duration?: number | null;
    created_at?: string;
}

export function analyzeDeploymentChangeImpact(
    currentDeployment: DeploymentData,
    previousDeployment: DeploymentData | null,
    recentDeployments: DeploymentData[]
): ChangeImpact {
    // First deployment case
    if (!previousDeployment) {
        return {
            hasPrevious: false,
            summary: "This is the first deployment for this project.",
            changeTypes: [],
            impactLevel: 'LOW',
            reasons: ["No previous deployment to compare against"],
            confidence: 1.0
        };
    }

    const changeTypes: string[] = [];
    const reasons: string[] = [];
    let riskScore = 0;

    // Normalize commit hash field (API uses both commit_sha and commit_hash)
    const currentCommit = currentDeployment.commit_sha || currentDeployment.commit_hash;
    const previousCommit = previousDeployment.commit_sha || previousDeployment.commit_hash;

    // CODE CHANGE: commit differs
    if (currentCommit && previousCommit && currentCommit !== previousCommit) {
        changeTypes.push('code');
        reasons.push("New code changes detected compared to previous deployment");
        riskScore += 1;
    } else if (currentCommit && previousCommit && currentCommit === previousCommit) {
        reasons.push("Same commit as previous deployment");
    }

    // SOURCE CHANGE: deployment source differs
    if (currentDeployment.source && previousDeployment.source &&
        currentDeployment.source !== previousDeployment.source) {
        changeTypes.push('source');
        reasons.push(`Deployment source changed from ${previousDeployment.source} to ${currentDeployment.source}`);
        riskScore += 1;
    }

    // TIMING CHANGE: build time regression
    if (currentDeployment.build_duration && previousDeployment.build_duration) {
        const timeDiff = currentDeployment.build_duration / previousDeployment.build_duration;
        if (timeDiff > 2) {
            changeTypes.push('timing');
            reasons.push("Build time is significantly longer than previous deployment");
            riskScore += 2;
        } else if (timeDiff < 0.5) {
            reasons.push("Build completed faster than previous deployment");
        }
    }

    // Check for recent failures with same commit
    const commitFailures = recentDeployments.filter(d => {
        const dCommit = d.commit_sha || d.commit_hash;
        return dCommit === currentCommit && d.status === 'failed';
    }).length;

    if (commitFailures > 0) {
        reasons.push(`This commit has failed ${commitFailures} time${commitFailures === 1 ? '' : 's'} recently`);
        riskScore += 2;
    }

    // Check if previous deployment failed
    if (previousDeployment.status === 'failed') {
        reasons.push("Previous deployment failed");
        riskScore += 1;
    }

    // Calculate impact level
    let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= 4) {
        impactLevel = 'HIGH';
    } else if (riskScore >= 2) {
        impactLevel = 'MEDIUM';
    }

    // Generate human-readable summary
    const summary = generateSummary(changeTypes, impactLevel, previousDeployment.status);

    // Confidence based on available data
    let confidence = 1.0;
    if (!currentCommit && !previousCommit) confidence -= 0.2;
    if (!currentDeployment.source || !previousDeployment.source) confidence -= 0.1;
    if (!currentDeployment.build_duration || !previousDeployment.build_duration) confidence -= 0.1;
    confidence = Math.max(0.5, confidence);

    return {
        hasPrevious: true,
        summary,
        changeTypes,
        impactLevel,
        reasons: reasons.length > 0 ? reasons : ["No significant changes detected"],
        confidence
    };
}

function generateSummary(
    changeTypes: string[],
    impactLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    previousStatus?: string
): string {
    if (changeTypes.length === 0) {
        if (previousStatus === 'success') {
            return "This deployment is similar to the previous successful deployment.";
        }
        return "No significant changes detected compared to the previous deployment.";
    }

    const changes: string[] = [];
    if (changeTypes.includes('code')) changes.push('code changes');
    if (changeTypes.includes('source')) changes.push('source change');
    if (changeTypes.includes('timing')) changes.push('build time difference');

    const changeText = changes.join(' and ');

    if (impactLevel === 'HIGH') {
        return `This deployment includes ${changeText}. Based on recent history, this warrants careful attention.`;
    } else if (impactLevel === 'MEDIUM') {
        return `This deployment includes ${changeText}. Compared to the previous deployment, there are notable differences.`;
    }

    return `This deployment includes ${changeText}, consistent with your recent deployment patterns.`;
}
