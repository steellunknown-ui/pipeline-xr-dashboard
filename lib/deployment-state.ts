/**
 * PRIORITY 10.6 + 10.7: Deployment State Machine & Immutability Guards
 *
 * Single source of truth for:
 * - Valid deployment status values
 * - Allowed state transitions
 * - Immutability enforcement
 */

export type DeploymentStatus =
    | "pending"
    | "building"
    | "success"
    | "failed"
    | "cancelled";

/**
 * Valid state transitions.
 * Key = current state, Value = array of allowed next states.
 */
const VALID_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
    pending: ["building", "cancelled"],
    building: ["success", "failed"],
    success: [], // terminal
    failed: [],  // terminal
    cancelled: [], // terminal
};

/**
 * Terminal states - deployments in these states are immutable.
 */
const TERMINAL_STATES: DeploymentStatus[] = ["success", "failed", "cancelled"];

/**
 * Check if a state transition is valid.
 */
export function canTransition(
    from: DeploymentStatus,
    to: DeploymentStatus
): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed?.includes(to) ?? false;
}

/**
 * Assert that a state transition is valid.
 * Throws a controlled error if transition is invalid.
 */
export function assertValidTransition(
    from: DeploymentStatus,
    to: DeploymentStatus
): void {
    if (!canTransition(from, to)) {
        throw new Error(
            `Invalid state transition: ${from} → ${to}. Allowed: ${VALID_TRANSITIONS[from]?.join(", ") || "none"}`
        );
    }
}

/**
 * Check if a status is terminal (no further transitions allowed).
 */
export function isTerminal(status: DeploymentStatus): boolean {
    return TERMINAL_STATES.includes(status);
}

/**
 * Check if a deployment in this status is immutable.
 * Immutable = terminal state = success, failed, or cancelled.
 */
export function isImmutable(status: DeploymentStatus): boolean {
    return isTerminal(status);
}

/**
 * Assert that a deployment is mutable.
 * Throws if the deployment is in a terminal/immutable state.
 */
export function assertDeploymentMutable(status: DeploymentStatus): void {
    if (isImmutable(status)) {
        throw new Error(
            `Deployment is immutable: status "${status}" is a terminal state`
        );
    }
}

/**
 * Get human-readable status label.
 */
export function getStatusLabel(status: DeploymentStatus): string {
    const labels: Record<DeploymentStatus, string> = {
        pending: "Pending",
        building: "Building",
        success: "Successful",
        failed: "Failed",
        cancelled: "Cancelled",
    };
    return labels[status] || status;
}
