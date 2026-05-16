import { ProjectClassification } from "./project-classifier";

export type DeploymentPolicyAction =
    | "DEPLOY_IMMEDIATELY"
    | "FORCE_ENV_CONFIG"
    | "SUGGEST_ENV";

export interface DeploymentPolicyResult {
    action: DeploymentPolicyAction;
    classification_risk?: string;
}

export function deriveDeploymentPolicy(classification: ProjectClassification): DeploymentPolicyResult {
    if (classification.type === "STATIC_FRONTEND") {
        // If static frontend somehow has explicit env hooks, we suggest. Otherwise deploy immediately.
        return {
            action: classification.requiresEnv ? "SUGGEST_ENV" : "DEPLOY_IMMEDIATELY"
        };
    }

    if (classification.type === "FULLSTACK" || classification.type === "FRONTEND_WITH_API") {
        return {
            action: "FORCE_ENV_CONFIG"
        };
    }

    // UNKNOWN
    return {
        action: "SUGGEST_ENV",
        classification_risk: "env_unknown"
    };
}
