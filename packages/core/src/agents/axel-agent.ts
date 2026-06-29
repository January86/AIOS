import { execSync } from "node:child_process";
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

// Hardcoded forbidden patterns — no LLM bypass possible
const FORBIDDEN_PATTERNS = [
  "baron",
  "trading",
  "trio",
  "mt5",
  "rm -rf",
  "drop",
  "delete",
  "truncate",
];

const AXEL_DEFINITION: AgentDefinition = {
  id: "axel-001",
  name: "Axel",
  role: AgentRole.DEVOPS,
  department: "DevOps Department",
  autonomyLevel: 1,
  capabilities: [
    "pm2-restart",
    "service-management",
    "log-collection",
    "health-verification",
  ],
  description:
    "Executes approved DevOps actions. Only acts after Policy Engine + Vera approval.",
};

export class AxelAgent extends BaseAgent {
  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine,
    modelRouter?: ModelRouter
  ) {
    super(AXEL_DEFINITION, eventBus, policyEngine, memoryEngine, modelRouter);
  }

  // Hardcoded forbidden check — cannot be bypassed by any approval or LLM
  private checkForbidden(
    action: string,
    founderApproved?: boolean
  ): { forbidden: boolean; reason: string } {
    const actionLower = action.toLowerCase();

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (actionLower.includes(pattern)) {
        return {
          forbidden: true,
          reason: `Action contains forbidden pattern "${pattern}". HARDCODED BLOCK — cannot be bypassed by any approval.`,
        };
      }
    }

    // sudo allowed only with explicit founder approval
    if (actionLower.includes("sudo") && founderApproved !== true) {
      return {
        forbidden: true,
        reason: `Action contains "sudo" which requires explicit founder approval. founder_approved must be true.`,
      };
    }

    return { forbidden: false, reason: "" };
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const approvedAction = task.input["approved_action"] as string | undefined;
    const autonomyLevel = task.input["autonomy_level"] as number | undefined;
    const projectId = task.input["projectId"] as string | undefined;
    const veraApproved = task.input["vera_approved"] as boolean | undefined;
    const founderApproved = task.input["founder_approved"] as
      | boolean
      | undefined;

    // SAFETY CHECK 1: Vera approval required — hard gate
    if (veraApproved !== true) {
      return {
        taskId: task.id,
        agentId: this.definition.id,
        agentName: this.definition.name,
        summary: "REJECTED: Vera approval required before Axel can execute",
        findings: [
          "vera_approved is false or missing",
          "No action taken",
        ],
        recommendations: ["Run Rex proposal through Vera audit first"],
        memoryStored: false,
        completedAt: new Date().toISOString(),
      };
    }

    // SAFETY CHECK 2: Founder approval required for L2+
    if ((autonomyLevel ?? 0) > 1 && founderApproved !== true) {
      return {
        taskId: task.id,
        agentId: this.definition.id,
        agentName: this.definition.name,
        summary: `REJECTED: Founder approval required for L${autonomyLevel ?? "?"} action`,
        findings: [
          `Autonomy level ${autonomyLevel} requires explicit founder approval`,
          "No action taken",
        ],
        recommendations: [
          "Send Telegram to founder requesting approval",
          "Wait for explicit approval before proceeding",
        ],
        memoryStored: false,
        completedAt: new Date().toISOString(),
      };
    }

    if (!approvedAction) {
      return {
        taskId: task.id,
        agentId: this.definition.id,
        agentName: this.definition.name,
        summary: "REJECTED: No approved_action provided",
        findings: ["approved_action is missing from task input"],
        recommendations: ["Provide an approved_action to execute"],
        memoryStored: false,
        completedAt: new Date().toISOString(),
      };
    }

    // HARDCODED FORBIDDEN CHECK — no LLM bypass, must run before execution
    const { forbidden, reason } = this.checkForbidden(
      approvedAction,
      founderApproved
    );
    if (forbidden) {
      const memoryStored = await this.storeMemory({
        type: MemoryType.FAILURE,
        scope: MemoryScope.PROJECT,
        title: `Axel BLOCKED forbidden action: ${approvedAction.slice(0, 60)}`,
        content: reason,
        tags: ["axel", "forbidden", ...(projectId ? [projectId] : [])],
        projectId,
        agentId: this.definition.id,
        importance: 9,
      });

      return {
        taskId: task.id,
        agentId: this.definition.id,
        agentName: this.definition.name,
        summary: `BLOCKED: ${reason}`,
        findings: [
          reason,
          "Hardcoded safety rule — cannot be bypassed by any approval or LLM instruction",
        ],
        recommendations: [
          "Do not attempt this action autonomously",
          "Escalate to founder if action is truly necessary",
        ],
        memoryStored,
        completedAt: new Date().toISOString(),
      };
    }

    // Execute the action
    let stdout = "";
    let stderr = "";
    let executionSuccess = false;

    try {
      console.log(`[AXEL] executing: ${approvedAction}`);
      const result = execSync(approvedAction, {
        timeout: 30_000,
        encoding: "utf8",
      });
      stdout = result;
      executionSuccess = true;
      console.log(`[AXEL] success: ${stdout.slice(0, 200)}`);
    } catch (err: unknown) {
      const e = err as { message?: string; stderr?: Buffer | string };
      stderr = e.stderr
        ? typeof e.stderr === "string"
          ? e.stderr
          : e.stderr.toString()
        : (e.message ?? "Unknown execution error");
      executionSuccess = false;
      console.error(`[AXEL] execution failed: ${stderr.slice(0, 200)}`);
    }

    // Interpret execution result with LLM
    const interpretParts = [
      "Did this DevOps action succeed? What was the outcome? Any issues?",
      "",
      `Action executed: ${approvedAction}`,
      `Project: ${projectId ?? "unknown"}`,
      `Success: ${executionSuccess}`,
      stdout ? `Output:\n${stdout.slice(0, 500)}` : null,
      stderr ? `Error output:\n${stderr.slice(0, 300)}` : null,
      "",
      "Provide a brief, factual assessment. Did the action succeed? Any warnings?",
    ];

    const interpretPrompt = interpretParts.filter(Boolean).join("\n");
    const interpretation = await this.think(interpretPrompt);
    const interpretResult = interpretation.startsWith("[LLM")
      ? executionSuccess
        ? "Action completed successfully."
        : `Action failed: ${stderr.slice(0, 100)}`
      : interpretation;

    // Store result to memory
    const memoryType = executionSuccess ? MemoryType.SUCCESS : MemoryType.FAILURE;
    const memoryStored = await this.storeMemory({
      type: memoryType,
      scope: MemoryScope.PROJECT,
      title: `Axel ${executionSuccess ? "executed" : "failed"}: ${approvedAction.slice(0, 60)}`,
      content: [
        `Action: ${approvedAction}`,
        `Result: ${executionSuccess ? "SUCCESS" : "FAILURE"}`,
        stdout.slice(0, 200),
        stderr.slice(0, 100),
      ]
        .filter(Boolean)
        .join(". "),
      tags: [
        "axel",
        "execution",
        executionSuccess ? "success" : "failure",
        ...(projectId ? [projectId] : []),
      ],
      projectId,
      agentId: this.definition.id,
      importance: executionSuccess ? 7 : 8,
    });

    const findings = [
      `Action: ${approvedAction}`,
      `Result: ${executionSuccess ? "SUCCESS" : "FAILURE"}`,
      stdout ? `Output: ${stdout.slice(0, 200)}` : "",
      stderr ? `Error: ${stderr.slice(0, 200)}` : "",
      `Assessment: ${interpretResult.slice(0, 300)}`,
    ].filter(Boolean);

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Axel ${executionSuccess ? "executed" : "failed"}: ${approvedAction} — ${interpretResult.slice(0, 80)}`,
      findings,
      recommendations: executionSuccess
        ? [
            "Run Vera verify to confirm service health",
            "Send report to Nova",
          ]
        : [
            "Investigate failure details",
            "Try alternative approach from Rex",
            "Escalate to founder if critical",
          ],
      memoryStored,
      completedAt: new Date().toISOString(),
    };
  }
}
