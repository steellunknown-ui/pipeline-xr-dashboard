import { createHash } from 'crypto';

export function deriveEnvFingerprint(envVars: { key: string }[]): string {
    if (!envVars || envVars.length === 0) {
        return 'hash_empty';
    }

    // Use ONLY env keys, sort alphabetically, join with "|"
    const sortedKeys = envVars
        .map(env => env.key)
        .sort()
        .join('|');

    // Generate stable deterministic hash
    const hash = createHash('sha256').update(sortedKeys).digest('hex');

    return `hash_${hash.substring(0, 16)}`;
}

export function deriveEnvOutdatedState(input: {
    deploymentFingerprint?: string | null;
    currentFingerprint?: string | null;
}): { outdated: boolean; reason: string } {
    const { deploymentFingerprint, currentFingerprint } = input;

    // If both are missing, they are technically in sync (no envs)
    if (!deploymentFingerprint && !currentFingerprint) {
        return { outdated: false, reason: "No environment variables present." };
    }

    // Treat missing as "hash_empty" for comparison purposes
    const depHash = deploymentFingerprint || 'hash_empty';
    const currHash = currentFingerprint || 'hash_empty';

    if (depHash !== currHash) {
        return {
            outdated: true,
            reason: "Environment variable keys have been added, removed, or changed since this deployment."
        };
    }

    return {
        outdated: false,
        reason: "Environment variables match the deployed state."
    };
}
