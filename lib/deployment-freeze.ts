/**
 * PRIORITY 11.3: Deployment Freezing (Immutability Guardrail)
 *
 * READ-ONLY freeze status derivation for deployments.
 * Successful deployments are frozen to preserve production integrity.
 * Pure function with no side effects.
 */

export interface DeploymentFreezeStatus {
    frozen: boolean;
    reason: string;
}

type DeploymentStatus = "pending" | "building" | "success" | "failed" | "cancelled";

/**
 * Derive freeze status for a deployment.
 * 
 * Rules:
 * - frozen = true if status === "success"
 * - frozen = false for all other states
 * 
 * Pure function. No side effects. No database access.
 */
export function deriveFreezeStatus(deployment: {
    status: DeploymentStatus | string;
}): DeploymentFreezeStatus {
    const isFrozen = deployment.status === "success";

    return {
        frozen: isFrozen,
        reason: isFrozen
            ? "This deployment is frozen to preserve production integrity."
            : "This deployment is still mutable.",
    };
}
