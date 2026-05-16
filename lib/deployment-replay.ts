export interface DeploymentReplayEvent {
  timestamp: string;
  type:
    | "DEPLOYMENT_CREATED"
    | "BUILD_STARTED"
    | "INSTALL_STARTED"
    | "INSTALL_OUTPUT"
    | "BUILD_OUTPUT"
    | "BUILD_COMPLETED"
    | "BUILD_FAILED"
    | "DEPLOYMENT_SUCCESS";
  message: string;
  source: "system" | "runner";
  relativeMs: number;
}

export function deriveDeploymentReplay(
  deployment: any,
  logs: any[],
  auditLogs: any[]
): DeploymentReplayEvent[] {
  const events: DeploymentReplayEvent[] = [];
  const createdAt = new Date(deployment.created_at).getTime();

  // DEPLOYMENT_CREATED
  events.push({
    timestamp: deployment.created_at,
    type: "DEPLOYMENT_CREATED",
    message: `Deployment created from ${deployment.source || "manual"}`,
    source: "system",
    relativeMs: 0,
  });

  // BUILD_STARTED
  if (deployment.started_at) {
    const startedAt = new Date(deployment.started_at).getTime();
    events.push({
      timestamp: deployment.started_at,
      type: "BUILD_STARTED",
      message: "Build process started",
      source: "system",
      relativeMs: startedAt - createdAt,
    });
  }

  // Process logs
  let installStarted = false;
  for (const log of logs) {
    const logTime = new Date(log.created_at).getTime();
    const relativeMs = logTime - createdAt;

    // INSTALL_STARTED
    if (!installStarted && log.message.toLowerCase().includes("npm install")) {
      installStarted = true;
      events.push({
        timestamp: log.created_at,
        type: "INSTALL_STARTED",
        message: "Installing dependencies",
        source: "runner",
        relativeMs,
      });
    }

    // INSTALL_OUTPUT or BUILD_OUTPUT
    if (log.message.trim()) {
      const type = log.message.toLowerCase().includes("npm install") || 
                   log.message.toLowerCase().includes("node_modules")
        ? "INSTALL_OUTPUT"
        : "BUILD_OUTPUT";

      events.push({
        timestamp: log.created_at,
        type,
        message: log.message,
        source: "runner",
        relativeMs,
      });
    }
  }

  // Enrich with audit logs
  for (const audit of auditLogs) {
    const auditTime = new Date(audit.created_at).getTime();
    const relativeMs = auditTime - createdAt;

    if (audit.event_type === "BUILD_COMPLETED") {
      events.push({
        timestamp: audit.created_at,
        type: "BUILD_COMPLETED",
        message: audit.message,
        source: "system",
        relativeMs,
      });
    } else if (audit.event_type === "BUILD_FAILED") {
      events.push({
        timestamp: audit.created_at,
        type: "BUILD_FAILED",
        message: audit.message,
        source: "system",
        relativeMs,
      });
    }
  }

  // DEPLOYMENT_SUCCESS or BUILD_COMPLETED/FAILED
  if (deployment.completed_at) {
    const completedAt = new Date(deployment.completed_at).getTime();
    const relativeMs = completedAt - createdAt;

    if (deployment.status === "success") {
      events.push({
        timestamp: deployment.completed_at,
        type: "DEPLOYMENT_SUCCESS",
        message: "Deployment completed successfully",
        source: "system",
        relativeMs,
      });
    } else if (deployment.status === "failed") {
      events.push({
        timestamp: deployment.completed_at,
        type: "BUILD_FAILED",
        message: "Deployment failed",
        source: "system",
        relativeMs,
      });
    }
  }

  // Sort by timestamp and limit to 200 events
  return events
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 200);
}
