/**
 * PRIORITY 9.3: Deployment Activity Derivation
 * 
 * Derives "activity events" from existing deployments table.
 * NO persistence - derived at runtime only.
 */

export type DeploymentActivityType = "started" | "success" | "failed" | "rollback";

export interface DeploymentActivity {
    id: string;
    type: DeploymentActivityType;
    deploymentId: string;
    projectId: string;
    projectName?: string;
    message: string;
    timestamp: string;
    source: "github" | "zip" | "manual";
}

interface DeploymentRecord {
    id: string;
    status: string;
    source?: string;
    project_id?: string;
    commit_sha?: string;
    commit_message?: string;
    branch?: string;
    created_at: string;
    projects?: {
        id: string;
        name: string;
    };
}

/**
 * Derives a DeploymentActivity from a deployment record.
 * Uses deterministic rules based on status and source.
 */
export function deriveDeploymentActivity(
    deployment: DeploymentRecord
): DeploymentActivity {
    const source = (deployment.source as "github" | "zip" | "manual") || "manual";
    const projectName = deployment.projects?.name || "Unknown Project";
    const projectId = deployment.project_id || deployment.projects?.id || "";

    // Determine activity type based on status
    let type: DeploymentActivityType;
    let message: string;

    switch (deployment.status) {
        case "building":
        case "pending":
        case "queued":
        case "in_progress":
            type = "started";
            message = buildStartedMessage(deployment, projectName, source);
            break;

        case "success":
        case "completed":
            type = "success";
            message = buildSuccessMessage(deployment, projectName, source);
            break;

        case "failed":
            type = "failed";
            message = buildFailedMessage(deployment, projectName, source);
            break;

        default:
            // Treat unknown statuses as started
            type = "started";
            message = `Deployment for ${projectName} is processing`;
    }

    return {
        id: `activity-${deployment.id}`,
        type,
        deploymentId: deployment.id,
        projectId,
        projectName,
        message,
        timestamp: deployment.created_at,
        source,
    };
}

/**
 * Builds message for started deployments
 */
function buildStartedMessage(
    deployment: DeploymentRecord,
    projectName: string,
    source: string
): string {
    if (source === "github" && deployment.commit_sha) {
        const shortSha = deployment.commit_sha.substring(0, 7);
        const branch = deployment.branch || "main";
        return `Deployment started for ${projectName} from GitHub (${branch}@${shortSha})`;
    }

    if (source === "zip") {
        return `Deployment started for ${projectName} from ZIP upload`;
    }

    return `Deployment started for ${projectName}`;
}

/**
 * Builds message for successful deployments
 */
function buildSuccessMessage(
    deployment: DeploymentRecord,
    projectName: string,
    source: string
): string {
    if (source === "github" && deployment.commit_sha) {
        const shortSha = deployment.commit_sha.substring(0, 7);
        return `${projectName} deployed successfully (${shortSha})`;
    }

    return `${projectName} deployed successfully`;
}

/**
 * Builds message for failed deployments
 */
function buildFailedMessage(
    deployment: DeploymentRecord,
    projectName: string,
    source: string
): string {
    if (source === "github" && deployment.commit_sha) {
        const shortSha = deployment.commit_sha.substring(0, 7);
        return `Deployment failed for ${projectName} (${shortSha})`;
    }

    return `Deployment failed for ${projectName}`;
}

/**
 * Derives multiple activities from an array of deployments.
 * Returns activities sorted by timestamp (most recent first).
 */
export function deriveDeploymentActivities(
    deployments: DeploymentRecord[]
): DeploymentActivity[] {
    return deployments
        .map(deriveDeploymentActivity)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
