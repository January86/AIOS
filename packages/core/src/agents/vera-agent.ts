import {
  AgentRole,
  MemoryScope,
  MemoryType,
} from "../../../contracts/src/index.js";
import type {
  AgentDefinition,
  AgentReport,
  AgentTask,
} from "../../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { MemoryEngine } from "../../../memory/src/index.js";
import type { PolicyEngine } from "../../../policy/src/index.js";
import type { ModelRouter } from "../model-router/index.js";
import { BaseAgent } from "./base-agent.js";

interface VeraAuditResponse {
  verdict: "APPROVE" | "REJECT";
  reason: string;
  specific_concern: string;
  suggested_revision: string;
  confidence: number;
  blast_radius_violation: boolean;
}

interface VeraVerifyResponse {
  verified: boolean;
  findings: string[];
  confidence: number;
}

// Hardcoded blast radius rules — cannot be overridden by LLM
const BLAST_RADIUS: Record<
  string,
  { forbidden: string[]; maxLevel: number; reason: string }
> = {
  "baron-trading": {
    forbidden: [
      "restart",
      "modify",
      "stop",
      "touch",
      "delete",
      "change",
      "deploy",
      "rollback",
      "execute",
      "python",
      "mt5",
      "trade_config",
      "trio",
    ],
    maxLevel: 0,
    reason:
      "Financial system. Any autonomous action risks real monetary loss that cannot be reversed.",
  },
  "ha-platform": {
    forbidden: ["modify", "delete", "schema", "env", "webhook", "truncate"],
    maxLevel: 1,
    reason: "Client hotel data — active guests. Schema/data changes forbidden.",
  },
  "executive-brief": {
    forbidden: [
      "send",
      "publish",
      "modify",
      "subscriber",
      "delivery",
      "delete",
    ],
    maxLevel: 1,
    reason:
      "Government institution output. All content must be human-reviewed before publish.",
  },
  aios: {
    forbidden: [
      "policy",
      "autonomy",
      "blast_radius",
      "audit_log",
      "telegram_bot",
      "guardrail",
    ],
    maxLevel: 1,
    reason:
      "AIOS itself — modifying guardrails would compromise the entire safety system.",
  },
};

const VERA_DEFINITION: AgentDefinition = {
  id: "vera-001",
  name: "Vera",
  role: AgentRole.QA,
  department: "Quality Assurance Department",
  autonomyLevel: 1,
  capabilities: [
    "proposal-audit",
    "risk-assessment",
    "fix-verification",
    "safety-check",
    "blast-radius-check",
  ],
  description:
    "Audits Rex proposals before execution. Verifies fixes after execution. Mandatory gate.",
};

export class VeraAgent extends BaseAgent {
  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine,
    modelRouter?: ModelRouter
  ) {
    super(VERA_DEFINITION, eventBus, policyEngine, memoryEngine, modelRouter);
  }

  // Hardcoded check — not LLM-based, cannot be bypassed
  private checkBlastRadius(
    projectId: string,
    proposedAction: string
  ): { violation: boolean; reason: string } {
    const rules = BLAST_RADIUS[projectId];
    if (!rules) return { violation: false, reason: "" };

    const actionLower = proposedAction.toLowerCase();
    for (const forbidden of rules.forbidden) {
      if (actionLower.includes(forbidden)) {
        return {
          violation: true,
          reason: `BLAST RADIUS VIOLATION: "${proposedAction}" contains "${forbidden}" which is forbidden for ${projectId}. ${rules.reason}`,
        };
      }
    }
    return { violation: false, reason: "" };
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const mode = task.input["mode"] as string | undefined;
    if (mode === "verify") return this.executeVerify(task);
    return this.executeAudit(task);
  }

  private async executeAudit(task: AgentTask): Promise<AgentReport> {
    const rexProposal = task.input["rexProposal"] as string | undefined;
    const projectId = task.input["projectId"] as string | undefined;
    const deliberationRound =
      (task.input["deliberationRound"] as number | undefined) ?? 0;

    // HARDCODED blast radius check — always first, no LLM involved
    if (projectId && rexProposal) {
      const { violation, reason } = this.checkBlastRadius(
        projectId,
        rexProposal
      );
      if (violation) {
        const memoryStored = await this.storeMemory({
          type: MemoryType.EPISODIC,
          scope: MemoryScope.PROJECT,
          title: `Vera REJECTED blast-radius violation: ${projectId}`,
          content: reason,
          tags: [
            "vera",
            "audit",
            "blast-radius-violation",
            ...(projectId ? [projectId] : []),
          ],
          projectId,
          agentId: this.definition.id,
          importance: 9,
        });

        return {
          taskId: task.id,
          agentId: this.definition.id,
          agentName: this.definition.name,
          summary: `REJECTED: Blast radius violation for ${projectId}`,
          findings: [
            reason,
            "This is a hardcoded safety rule — no LLM override is possible.",
          ],
          recommendations: [
            "Do not attempt this action autonomously",
            "Escalate to founder if action is truly necessary",
          ],
          memoryStored,
          completedAt: new Date().toISOString(),
        };
      }
    }

    // LLM audit for proposals that pass the blast radius check
    const rulesForProject = projectId
      ? (BLAST_RADIUS[projectId] ?? null)
      : null;
    const rulesStr = rulesForProject
      ? JSON.stringify(
          { forbidden: rulesForProject.forbidden, maxLevel: rulesForProject.maxLevel },
          null,
          2
        )
      : "No specific rules — apply general caution";

    const systemPrompt = [
      "You are Vera, the QA auditor. Your job is to audit proposals",
      "from Rex and either APPROVE or REJECT them. You are the mandatory safety gate.",
      "Check: blast radius rules, risk level, autonomy level, potential side effects.",
      "Be thorough but fair. If rejecting, give specific actionable feedback for Rex to improve.",
      "Never approve actions that violate blast radius rules.",
      "Always output valid JSON.",
    ].join("\n");

    const prompt = [
      "Audit this Rex proposal:",
      `Proposed action: ${rexProposal ?? "unknown"}`,
      `Project: ${projectId ?? "unknown"}`,
      `Deliberation round: ${deliberationRound}`,
      "",
      `Blast radius rules for ${projectId ?? "this project"}:`,
      rulesStr,
      "",
      "Global rules:",
      "- baron-trading: FORBIDDEN all autonomous actions — financial system, real loss risk",
      "- ha-platform: L1 max autonomous (restart only), no data/schema/env changes",
      "- executive-brief: L1 max, no content/subscriber/delivery changes",
      "- aios: L1 max, no policy/guardrail changes",
      "",
      `Task: ${task.description}`,
      "",
      "Respond ONLY with valid JSON, no markdown:",
      '{"verdict":"APPROVE or REJECT","reason":"explanation","specific_concern":"if REJECT","suggested_revision":"if REJECT","confidence":0.0,"blast_radius_violation":false}',
    ].join("\n");

    const raw = await this.think(prompt, systemPrompt);

    let parsed: VeraAuditResponse | null = null;
    if (!raw.startsWith("[LLM")) {
      try {
        const cleaned = raw
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "")
          .trim();
        parsed = JSON.parse(cleaned) as VeraAuditResponse;
      } catch {
        console.warn(`[VERA] LLM returned non-JSON: ${raw.slice(0, 100)}`);
      }
    }

    // Fail safe: default REJECT when LLM unavailable
    const verdict = parsed?.verdict ?? "REJECT";
    const reason =
      parsed?.reason ?? "LLM unavailable — defaulting to REJECT for safety";
    const confidence = parsed?.confidence ?? 0.5;

    const findings = [
      `Verdict: ${verdict}`,
      `Reason: ${reason}`,
      parsed?.specific_concern ? `Concern: ${parsed.specific_concern}` : "",
      parsed?.suggested_revision
        ? `Suggested revision: ${parsed.suggested_revision}`
        : "",
    ].filter(Boolean);

    const memoryStored = await this.storeMemory({
      type: MemoryType.EPISODIC,
      scope: MemoryScope.PROJECT,
      title: `Vera audit ${verdict}: ${(rexProposal ?? task.title).slice(0, 60)}`,
      content: `${verdict}: ${reason}${parsed?.specific_concern ? `. Concern: ${parsed.specific_concern}` : ""}`,
      tags: [
        "vera",
        "audit",
        verdict.toLowerCase(),
        ...(projectId ? [projectId] : []),
      ],
      projectId,
      agentId: this.definition.id,
      importance: verdict === "REJECT" ? 8 : 6,
    });

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Vera audit: ${verdict} — ${reason.slice(0, 100)}`,
      findings,
      recommendations:
        verdict === "APPROVE"
          ? ["Proceed to Axel for execution"]
          : [
              parsed?.suggested_revision ?? "Revise proposal",
              "Rex should address Vera's specific concerns",
            ],
      memoryStored,
      completedAt: new Date().toISOString(),
    };
  }

  private async executeVerify(task: AgentTask): Promise<AgentReport> {
    const projectId = task.input["projectId"] as string | undefined;
    const actionTaken = task.input["action_taken"] as string | undefined;
    const expectedOutcome = task.input["expected_outcome"] as string | undefined;

    const systemPrompt = [
      "You are Vera, the QA auditor. Your job is to verify that an executed action",
      "produced the expected outcome. Be factual and specific. Always output valid JSON.",
    ].join("\n");

    const prompt = [
      "Verify execution result:",
      `Project: ${projectId ?? "unknown"}`,
      `Action taken: ${actionTaken ?? "unknown"}`,
      `Expected outcome: ${expectedOutcome ?? "service restored"}`,
      "",
      "Based on the action taken and project context, assess whether the action likely succeeded.",
      "",
      "Respond ONLY with valid JSON, no markdown:",
      '{"verified":true,"findings":["observation"],"confidence":0.0}',
    ].join("\n");

    const raw = await this.think(prompt, systemPrompt);

    let parsed: VeraVerifyResponse | null = null;
    if (!raw.startsWith("[LLM")) {
      try {
        const cleaned = raw
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "")
          .trim();
        parsed = JSON.parse(cleaned) as VeraVerifyResponse;
      } catch {
        console.warn(
          `[VERA] verify LLM returned non-JSON: ${raw.slice(0, 100)}`
        );
      }
    }

    const verified = parsed?.verified ?? false;
    const verifyFindings = parsed?.findings ?? [
      "Unable to verify — manual check required",
    ];
    const confidence = parsed?.confidence ?? 0.5;

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Vera verify: ${verified ? "CONFIRMED" : "UNCONFIRMED"} (confidence: ${confidence})`,
      findings: verifyFindings,
      recommendations: verified
        ? ["Mark goal as complete", "Send report to Nova"]
        : [
            "Run health check manually",
            "Escalate if service still down",
          ],
      memoryStored: false,
      completedAt: new Date().toISOString(),
    };
  }
}
