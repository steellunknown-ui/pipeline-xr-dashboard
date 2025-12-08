export type Project = {
  id: string;
  user_id: string;
  name: string;
  github_repo_url: string;
  auto_deploy_enabled: boolean;
  auto_deploy_branch: string | null;
  webhook_secret: string | null;
  created_at: string;
  updated_at: string;
};

export type Deployment = {
  id: string;
  user_id: string;
  project_id: string;
  environment: "development" | "staging" | "production";
  branch: string;
  commit_hash?: string | null;
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  created_at: string;
};

export type DeploymentWithProject = Deployment & {
  projects: { name: string } | null;
};

export type EnvironmentVariable = {
  id: string;
  user_id: string;
  project_id?: string;
  key: string;
  value: string;
  environment: "development" | "staging" | "production";
  created_at: string;
  updated_at: string;
};

export interface ActivityLog {
  id: string;
  user_id: string;
  event: string;
  description: string | null;
  project_id: string | null;
  deployment_id: string | null;
  metadata: any;
  created_at: string;
}

export type DeploymentLog = {
  id: string;
  deployment_id: string;
  user_id: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  created_at: string;
};

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};
