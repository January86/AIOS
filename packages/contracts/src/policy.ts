export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum PolicyDecision {
  ALLOW = "allow",
  DENY = "deny",
  ESCALATE = "escalate",
}

export enum ActionCategory {
  READ = "read",
  WRITE = "write",
  DEPLOY = "deploy",
  ROLLBACK = "rollback",
  RESTART = "restart",
  DELETE = "delete",
  EXECUTE = "execute",
  ESCALATE = "escalate",
}

export interface PolicyRequest {
  id: string;
  requestedBy: string;
  action: string;
  category: ActionCategory;
  riskLevel: RiskLevel;
  projectId?: string;
  payload: Record<string, unknown>;
  requestedAt: string;
  correlationId: string;
}

export interface PolicyDecisionRecord {
  requestId: string;
  decision: PolicyDecision;
  reason: string;
  decidedAt: string;
  decidedBy: string;
  correlationId: string;
}

export interface AuditEntry {
  id: string;
  requestId: string;
  decision: PolicyDecision;
  action: string;
  requestedBy: string;
  projectId?: string;
  timestamp: string;
  correlationId: string;
}
