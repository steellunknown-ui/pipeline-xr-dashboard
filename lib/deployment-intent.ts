export type DeploymentIntent =
  | "FIRST_DEPLOY"
  | "CODE_CHANGE"
  | "ENV_CHANGE"
  | "REDEPLOY"
  | "RECOVERY";

export interface DeploymentIntentResult {
  intent: DeploymentIntent;
  summary: string;
}

export function deriveDeploymentIntent(input: {
  currentDeployment: any;
  previousDeployment?: any;
  envOutdated?: boolean;
  lineage?: any;
}): DeploymentIntentResult {
  if (!input.previousDeployment) {
    return {
      intent: "FIRST_DEPLOY",
      summary: "This is the first deployment for this project."
    };
  }

  if (input.envOutdated === true) {
    return {
      intent: "ENV_CHANGE",
      summary: "Environment variables changed since last deployment."
    };
  }

  if (input.lineage && input.lineage.type === "redeploy") {
    return {
      intent: "REDEPLOY",
      summary: "This deployment was triggered as a redeploy."
    };
  }

  if (input.previousDeployment.status === "failed" || input.previousDeployment.status === "FAILED") {
    return {
      intent: "RECOVERY",
      summary: "Deployment triggered to recover from a previous failure."
    };
  }

  return {
    intent: "CODE_CHANGE",
    summary: "New code changes detected."
  };
}
