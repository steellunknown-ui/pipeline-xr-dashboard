/**
 * PRIORITY 12.2: Deployment Change Attribution
 *
 * Deterministic causality layer that explains WHY a deployment happened.
 * READ-ONLY derivation from existing data.
 * Never throws, never blocks actions.
 */

// Canonical attribution types - exactly ONE cause per deployment
export type DeploymentCause =
    | "MANUAL_TRIGGER"
    | "GITHUB_PUSH"
    | "AUTO_DEPLOY"
    | "REDEPLOY"
    | "ROLLBACK"
    | "SYSTEM_RECOVERY";

export interface DeploymentAttribution {
    cause: DeploymentCause;
    summary: string;
}

export interface AttributionInput {
    deployment: {
        source: "github" | "zip" | "manual" | string;
        rollback_from_deployment_id?: string | null;
    };
    audit?: {
        actor_type: "user" | "system";
        actor_label?: string | null;
        metadata?: Record<string, unknown> | null;
    } | null;
    autoDeployEnabled?: boolean;
}

/**
 * Derive deployment attribution from existing data.
 *
 * Rules are applied in strict order (first match wins):
 * 1. ROLLBACK - rollback_from_deployment_id + audit.metadata.rollback
 * 2. REDEPLOY - rollback_from_deployment_id + audit.metadata.redeploy
 * 3. GITHUB_PUSH - source === "github" + actor_label === "GitHub webhook"
 * 4. AUTO_DEPLOY - source === "github" + autoDeployEnabled
 * 5. SYSTEM_RECOVERY - actor_type === "system" + metadata.recovery
 * 6. MANUAL_TRIGGER - default fallback
 *
 * Returns null if required data is missing. Never guesses.
 */
export function deriveDeploymentAttribution(
    input: AttributionInput
): DeploymentAttribution | null {
    // Validate minimum required data
    if (!input.deployment) {
        return null;
    }

    const { deployment, audit, autoDeployEnabled } = input;
    const metadata = audit?.metadata || {};

    // Rule 1: ROLLBACK
    if (deployment.rollback_from_deployment_id && metadata.rollback === true) {
        return {
            cause: "ROLLBACK",
            summary: "Rollback initiated from a previous deployment",
        };
    }

    // Rule 2: REDEPLOY
    if (deployment.rollback_from_deployment_id && metadata.redeploy === true) {
        return {
            cause: "REDEPLOY",
            summary: "Re-deployed from an earlier deployment",
        };
    }

    // Rule 3: GITHUB_PUSH
    if (
        deployment.source === "github" &&
        audit?.actor_label === "GitHub webhook"
    ) {
        return {
            cause: "GITHUB_PUSH",
            summary: "Deployment triggered by a GitHub push",
        };
    }

    // Rule 4: AUTO_DEPLOY
    if (deployment.source === "github" && autoDeployEnabled === true) {
        return {
            cause: "AUTO_DEPLOY",
            summary: "Automatically deployed from connected GitHub repository",
        };
    }

    // Rule 5: SYSTEM_RECOVERY
    if (audit?.actor_type === "system" && metadata.recovery === true) {
        return {
            cause: "SYSTEM_RECOVERY",
            summary: "Deployment triggered during system recovery",
        };
    }

    // Rule 6: MANUAL_TRIGGER (default fallback)
    return {
        cause: "MANUAL_TRIGGER",
        summary: "Deployment triggered manually",
    };
}
