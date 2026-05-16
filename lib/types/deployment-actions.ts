// STEP 6.2.1: Define Action Types (Frontend-Only)
// Deterministic action map for recommended fixes

export type DeploymentAction =
  | { type: "OPEN_AUTO_DEPLOY_SETTINGS"; projectId: string }
  | { type: "ROLLBACK_PREVIEW"; deploymentId: string }
  | { type: "OPEN_ENV_EDITOR"; projectId: string }
  | { type: "LINK_GITHUB" }
  | { type: "VIEW_LOGS"; deploymentId: string }
  | { type: "REDEPLOY_MANUAL"; projectId: string }
  | { type: "REDEPLOY_SAME_VERSION"; deploymentId: string };

export interface DeploymentExplanation {
  status: string;
  whatHappening: string;
  whyHappened: string;
  nextAction: string;
  recommendedActions?: DeploymentAction[];
}

// STEP 6.3: Decision Intelligence Types
export interface DecisionOption {
  action: string;
  description: string;
  risk_level: "low" | "medium" | "high";
  confidence: number; // 0.0 - 1.0
  reason: string;
}

// STEP 6.4: Confidence & Provenance Types
export interface Provenance {
  based_on: string[]; // max 3 human-readable facts
  evidence_count: number;
  confidence_level: "low" | "medium" | "high";
}

// PRIORITY 8.1: Trust Signals Types
export interface TrustSignals {
  success: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  signals: {
    successRatePercent: number | null;
    lastSuccessfulDeployment: string | null;
    failureCount: number;
    sourceConsistency: boolean;
  };
}

// PRIORITY 8.2: Benchmark Types
export interface BenchmarkResult {
  relativeConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  successPercentile: number;
  buildTimeComparison: 'faster' | 'slower' | 'similar';
  failureFrequency: number;
  consistency: boolean;
  summary: string;
}

// PRIORITY 8.3: Change Impact Types
export interface ChangeImpact {
  hasPrevious: boolean;
  summary: string;
  changeTypes: string[];
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  confidence: number;
}