export interface DeploymentConfidence {
    level: "HIGH" | "MEDIUM" | "LOW";
    evidenceCount: number;
    reasoning: string[];
    summary: string;
}

export function deriveDeploymentConfidence(input: {
    deployment: any;
    recentDeployments: any[];
    memory?: any | null;
    trustSignals?: any | null;
    prediction?: any | null;
}): DeploymentConfidence | null {
    const { recentDeployments, memory, trustSignals, prediction } = input;

    if (!recentDeployments || recentDeployments.length < 2) {
        return null;
    }

    const totalDeployments = recentDeployments.length;
    let score = 0;
    const reasoning: string[] = [];

    // Data Volume Evidence
    if (totalDeployments >= 3) {
        score += 1;
        reasoning.push(`Based on ${totalDeployments} previous deployments`);
    } else {
        reasoning.push(`Limited historical data available (${totalDeployments} deployments)`);
    }
    if (totalDeployments >= 5) score += 1;
    if (totalDeployments >= 10) score += 1;

    // Success Rate / Consistency Evidence
    let successRate = 0;
    if (memory?.successRatePercent !== undefined && memory?.successRatePercent !== null) {
        successRate = memory.successRatePercent;
    } else {
        const successCount = recentDeployments.filter(d => d.status === 'success' || d.status === 'completed').length;
        successRate = (successCount / totalDeployments) * 100;
    }

    if (successRate >= 70) {
        score += 1;
        reasoning.push("Recent deployments show stable success rate");
    } else if (successRate < 50) {
        score -= 1;
        reasoning.push("Historical success rate is unstable");
    }

    // Trust & Prediction Consistency
    if (trustSignals?.confidence === "HIGH" || trustSignals?.recommendationConfidence === "HIGH") {
        score += 1;
        reasoning.push("Trust signals indicate high confidence");
    }

    if (prediction?.confidence === "HIGH") {
        score += 1;
        reasoning.push("Prediction confidence is high due to consistent patterns");
    }

    // Penalize for high predictive risk
    if (prediction?.riskLevel === "HIGH") {
        score -= 1;
        reasoning.push("High predictive risk reduces overall certainty");
    }

    // Clamp minimum score to 0
    score = Math.max(0, score);

    let level: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    let summary = "";

    if (score >= 5) {
        level = "HIGH";
        summary = "Confidence is high because this project has strong historical consistency.";
    } else if (score >= 3) {
        level = "MEDIUM";
        summary = "Confidence is moderate. Some historical signals exist but patterns are still forming.";
        if (totalDeployments < 5) reasoning.push("Patterns are still stabilizing");
    } else {
        level = "LOW";
        summary = "Confidence is limited due to low history or unstable outcomes.";
    }

    // Deduplicate reasoning just in case
    const uniqueReasoning = Array.from(new Set(reasoning));

    return {
        level,
        evidenceCount: totalDeployments,
        reasoning: uniqueReasoning,
        summary
    };
}
