export enum ProjectState {
  UNKNOWN = "unknown",
  REGISTERED = "registered",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
  ARCHIVED = "archived",
}

export enum ProjectTier {
  BASIC = "basic",
  STANDARD = "standard",
  UPSCALE = "upscale",
  ENTERPRISE = "enterprise",
}

export interface ProjectConfig {
  id: string;
  name: string;
  description: string;
  tier: ProjectTier;
  path: string;
  port?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectHealth {
  projectId: string;
  state: ProjectState;
  healthy: boolean;
  lastCheckedAt: string;
  uptime?: number;
  errorMessage?: string;
}

export interface ProjectRecord {
  config: ProjectConfig;
  health: ProjectHealth;
  registeredAt: string;
  metadata: Record<string, unknown>;
}
