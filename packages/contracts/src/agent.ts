export enum AgentState {
  IDLE = "idle",
  THINKING = "thinking",
  WORKING = "working",
  REVIEWING = "reviewing",
  BLOCKED = "blocked",
  ERROR = "error",
  OFFLINE = "offline",
}

export enum AgentRole {
  CEO = "ceo",
  CTO = "cto",
  PROJECT_MANAGER = "project_manager",
  DEVELOPER = "developer",
  QA = "qa",
  DEVOPS = "devops",
  MONITORING = "monitoring",
  SECURITY = "security",
  MEMORY = "memory",
  RESEARCH = "research",
  REPORTER = "reporter",
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  department: string;
  autonomyLevel: number;
  capabilities: string[];
  description: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  title: string;
  description: string;
  input: Record<string, unknown>;
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentReport {
  taskId: string;
  agentId: string;
  agentName: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  memoryStored: boolean;
  completedAt: string;
}
