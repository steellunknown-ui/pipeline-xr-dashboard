export type EnvStatus =
    | "NOT_REQUIRED"
    | "REQUIRED_MISSING"
    | "CONFIGURED";

export interface EnvState {
    status: EnvStatus;
    reason: string;
    envCount: number;
}

export function deriveEnvState(input: {
    requiresEnv: boolean;
    envCount: number;
}): EnvState {
    const { requiresEnv, envCount } = input;

    if (!requiresEnv) {
        return {
            status: "NOT_REQUIRED",
            reason: "Project classification determined environment variables are not required.",
            envCount
        };
    }

    if (requiresEnv && envCount === 0) {
        return {
            status: "REQUIRED_MISSING",
            reason: "Environment variables are required but none have been configured yet.",
            envCount
        };
    }

    // requiresEnv && envCount > 0
    return {
        status: "CONFIGURED",
        reason: "Environment variables are correctly configured.",
        envCount
    };
}
