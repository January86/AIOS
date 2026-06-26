import { ActionCategory, PolicyDecision, RiskLevel } from "../../contracts/src/index.js";
import type { PolicyDecisionRecord, PolicyRequest } from "../../contracts/src/index.js";

const RESTRICTED_ACTIONS: string[] = [
  "drop_database",
  "delete_all_projects",
  "format_disk",
  "kill_kernel",
];

export class PolicyRules {
  static evaluateRequest(request: PolicyRequest): PolicyDecisionRecord {
    const now = new Date().toISOString();

    const base = {
      requestId: request.id,
      decidedAt: now,
      decidedBy: "policy-engine",
      correlationId: request.correlationId,
    };

    // Restricted actions are always denied regardless of risk level.
    if (RESTRICTED_ACTIONS.includes(request.action)) {
      return {
        ...base,
        decision: PolicyDecision.DENY,
        reason: `Action '${request.action}' is in the restricted actions list`,
      };
    }

    if (request.riskLevel === RiskLevel.CRITICAL) {
      return {
        ...base,
        decision: PolicyDecision.DENY,
        reason: "CRITICAL risk level actions are always denied",
      };
    }

    if (request.riskLevel === RiskLevel.HIGH) {
      if (request.category === ActionCategory.DELETE) {
        return {
          ...base,
          decision: PolicyDecision.DENY,
          reason: "HIGH risk DELETE actions are denied",
        };
      }
      if (
        request.category === ActionCategory.DEPLOY ||
        request.category === ActionCategory.ROLLBACK
      ) {
        return {
          ...base,
          decision: PolicyDecision.ESCALATE,
          reason: `HIGH risk ${request.category} actions require escalation`,
        };
      }
    }

    // MEDIUM and LOW → ALLOW
    return {
      ...base,
      decision: PolicyDecision.ALLOW,
      reason: `${request.riskLevel} risk ${request.category} action allowed`,
    };
  }
}
