/**
 * PRIORITY 11.1: Deployment Lineage Derivation
 *
 * Derives deployment relationships from existing data.
 * NO schema changes. Read-only utility.
 */

export type DeploymentLineageType = "new" | "redeploy" | "rollback";

export interface DeploymentLineage {
    type: DeploymentLineageType;
    parentDeploymentId?: string;
    label: string;
}

/**
 * Derive lineage from deployment data.
 *
 * Rules:
 * - If rollback_from_deployment_id IS NULL → type = "new"
 * - If rollback_from_deployment_id IS NOT NULL:
 *   - If source === "rollback" → type = "rollback"
 *   - Else → type = "redeploy"
 */
export function deriveLineage(deployment: {
    rollback_from_deployment_id?: string | null;
    source?: string | null;
}): DeploymentLineage {
    const parentId = deployment.rollback_from_deployment_id;

    if (!parentId) {
        return {
            type: "new",
            label: "New deployment",
        };
    }

    const shortId = parentId.substring(0, 7);
    const isRollback = deployment.source === "rollback";

    if (isRollback) {
        return {
            type: "rollback",
            parentDeploymentId: parentId,
            label: `Rolled back from ${shortId}`,
        };
    }

    return {
        type: "redeploy",
        parentDeploymentId: parentId,
        label: `Re-deployed from ${shortId}`,
    };
}

/**
 * Get a brief history description for UI.
 */
export function getLineageDescription(lineage: DeploymentLineage): string {
    switch (lineage.type) {
        case "new":
            return "This is a new deployment.";
        case "redeploy":
            return "This deployment was re-created from a previous version.";
        case "rollback":
            return "This deployment was created as a rollback.";
        default:
            return "This is a deployment.";
    }
}
