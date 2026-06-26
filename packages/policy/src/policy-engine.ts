import { createEvent, EventType, PolicyDecision } from "../../contracts/src/index.js";
import type {
  AuditEntry,
  KernelService,
  PolicyDecisionRecord,
  PolicyRequest,
  ServiceHealth,
  ServiceState,
} from "../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../events/src/index.js";
import { PolicyRules } from "./policy-rules.js";

export class PolicyEngine implements KernelService {
  readonly name = "policy-engine";
  private serviceState: ServiceState = "created";
  private readonly auditLog: AuditEntry[] = [];

  constructor(private readonly eventBus: InMemoryEventBus) {}

  async init(): Promise<void> {
    this.serviceState = "initializing";
  }

  async start(): Promise<void> {
    this.serviceState = "running";
  }

  async stop(): Promise<void> {
    this.serviceState = "stopped";
  }

  async health(): Promise<ServiceHealth> {
    return {
      name: this.name,
      state: this.serviceState,
      healthy: this.serviceState === "running",
      checkedAt: new Date().toISOString(),
    };
  }

  async evaluate(request: PolicyRequest): Promise<PolicyDecisionRecord> {
    await this.eventBus.publish(
      createEvent({
        type: EventType.POLICY_REQUEST_CREATED,
        source: "policy-engine",
        correlationId: request.correlationId,
        payload: {
          requestId: request.id,
          requestedBy: request.requestedBy,
          action: request.action,
          category: request.category,
          riskLevel: request.riskLevel,
          ...(request.projectId !== undefined && { projectId: request.projectId }),
        },
      })
    );

    const decision = PolicyRules.evaluateRequest(request);

    await this.eventBus.publish(
      createEvent({
        type: EventType.POLICY_DECISION_MADE,
        source: "policy-engine",
        correlationId: request.correlationId,
        payload: {
          requestId: request.id,
          decision: decision.decision,
          reason: decision.reason,
        },
      })
    );

    const outcomeType =
      decision.decision === PolicyDecision.ALLOW
        ? EventType.POLICY_ACTION_ALLOWED
        : decision.decision === PolicyDecision.DENY
        ? EventType.POLICY_ACTION_DENIED
        : EventType.POLICY_ACTION_ESCALATED;

    await this.eventBus.publish(
      createEvent({
        type: outcomeType,
        source: "policy-engine",
        severity: decision.decision === PolicyDecision.DENY ? "warning" : "info",
        correlationId: request.correlationId,
        payload: {
          requestId: request.id,
          action: request.action,
          requestedBy: request.requestedBy,
          reason: decision.reason,
        },
      })
    );

    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      requestId: request.id,
      decision: decision.decision,
      action: request.action,
      requestedBy: request.requestedBy,
      projectId: request.projectId,
      timestamp: new Date().toISOString(),
      correlationId: request.correlationId,
    };
    this.auditLog.push(entry);

    await this.eventBus.publish(
      createEvent({
        type: EventType.POLICY_AUDIT_LOGGED,
        source: "policy-engine",
        correlationId: request.correlationId,
        payload: {
          auditId: entry.id,
          requestId: request.id,
          decision: decision.decision,
        },
      })
    );

    return decision;
  }

  getAuditLog(filter?: {
    decision?: PolicyDecision;
    requestedBy?: string;
    limit?: number;
  }): AuditEntry[] {
    let results = [...this.auditLog];
    if (filter?.decision !== undefined) {
      results = results.filter((e) => e.decision === filter.decision);
    }
    if (filter?.requestedBy !== undefined) {
      results = results.filter((e) => e.requestedBy === filter.requestedBy);
    }
    if (filter?.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }

  clearAuditLog(): void {
    this.auditLog.length = 0;
  }
}
