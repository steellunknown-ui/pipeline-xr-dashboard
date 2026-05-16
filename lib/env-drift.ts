/**
 * PRIORITY 11.2: Environment Drift Detection
 *
 * READ-ONLY analysis of environment variable changes
 * between deployments. Compares KEYS ONLY, never values.
 */

import { createClient } from "@supabase/supabase-js";

export interface EnvDriftResult {
    added: string[];
    removed: string[];
    unchanged: string[];
    riskLevel: "low" | "medium" | "high";
    summary: string;
}

/**
 * Get Supabase admin client for server-side operations
 */
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error("Missing Supabase environment variables");
    }

    return createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Fetch environment variable KEYS for a project at a specific point in time.
 * Only returns key names, never values.
 */
async function getEnvKeysForDeployment(
    projectId: string,
    beforeDate: string
): Promise<string[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from("environment_variables")
        .select("key")
        .eq("project_id", projectId)
        .lte("created_at", beforeDate);

    if (error || !data) {
        return [];
    }

    // Get unique keys
    return [...new Set(data.map((row) => row.key))];
}

/**
 * Fetch current environment variable KEYS for a project.
 * Only returns key names, never values.
 */
async function getCurrentEnvKeys(projectId: string): Promise<string[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from("environment_variables")
        .select("key")
        .eq("project_id", projectId);

    if (error || !data) {
        return [];
    }

    // Get unique keys
    return [...new Set(data.map((row) => row.key))];
}

/**
 * Calculate risk level based on drift.
 */
function calculateRiskLevel(
    added: string[],
    removed: string[]
): "low" | "medium" | "high" {
    if (removed.length > 0) {
        return "high";
    }
    if (added.length > 0) {
        return "medium";
    }
    return "low";
}

/**
 * Generate a human-readable summary of the drift.
 */
function generateSummary(added: string[], removed: string[]): string {
    if (removed.length > 0 && added.length > 0) {
        return `${removed.length} environment variable${removed.length === 1 ? " was" : "s were"} removed and ${added.length} ${added.length === 1 ? "was" : "were"} added since the last successful deployment.`;
    }

    if (removed.length > 0) {
        return `${removed.length} environment variable${removed.length === 1 ? " was" : "s were"} removed since the last successful deployment.`;
    }

    if (added.length > 0) {
        return `${added.length} new environment variable${added.length === 1 ? " was" : "s were"} added.`;
    }

    return "No environment changes detected.";
}

/**
 * Analyze environment drift between current state and last successful deployment.
 *
 * @param projectId - The project to analyze
 * @param lastSuccessfulDeploymentDate - ISO date string of last successful deployment
 * @returns EnvDriftResult or null if comparison not possible
 */
export async function analyzeEnvDrift(
    projectId: string,
    lastSuccessfulDeploymentDate: string | null
): Promise<EnvDriftResult | null> {
    try {
        // If no previous successful deployment, cannot compare
        if (!lastSuccessfulDeploymentDate) {
            return null;
        }

        // Get current env keys
        const currentKeys = await getCurrentEnvKeys(projectId);

        // Get env keys at time of last successful deployment
        const previousKeys = await getEnvKeysForDeployment(
            projectId,
            lastSuccessfulDeploymentDate
        );

        // Calculate drift
        const currentSet = new Set(currentKeys);
        const previousSet = new Set(previousKeys);

        const added = currentKeys.filter((key) => !previousSet.has(key));
        const removed = previousKeys.filter((key) => !currentSet.has(key));
        const unchanged = currentKeys.filter((key) => previousSet.has(key));

        const riskLevel = calculateRiskLevel(added, removed);
        const summary = generateSummary(added, removed);

        return {
            added,
            removed,
            unchanged,
            riskLevel,
            summary,
        };
    } catch (error) {
        console.error("[env-drift] Error analyzing environment drift:", error);
        return null;
    }
}

/**
 * Get last successful deployment date for a project.
 */
export async function getLastSuccessfulDeploymentDate(
    projectId: string,
    excludeDeploymentId?: string
): Promise<string | null> {
    try {
        const supabase = getSupabaseAdmin();

        let query = supabase
            .from("deployments")
            .select("created_at")
            .eq("project_id", projectId)
            .eq("status", "success")
            .order("created_at", { ascending: false })
            .limit(1);

        if (excludeDeploymentId) {
            query = query.neq("id", excludeDeploymentId);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            return null;
        }

        return data.created_at;
    } catch {
        return null;
    }
}
