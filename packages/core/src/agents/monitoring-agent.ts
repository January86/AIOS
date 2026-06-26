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
import type { TelegramNotifier } from "../telegram/telegram-notifier.js";
import { BaseAgent } from "./base-agent.js";

const ARIA_DEFINITION: AgentDefinition = {
  id: "monitoring-agent-001",
  name: "Aria",
  role: AgentRole.MONITORING,
  department: "Monitoring Department",
  autonomyLevel: 1,
  capabilities: [
    "health-check",
    "log-read",
    "incident-detect",
    "report-generate",
    "telegram-alert",
  ],
  description: "Monitors project health and detects incidents",
};

export class MonitoringAgent extends BaseAgent {
  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine,
    private readonly notifier?: TelegramNotifier
  ) {
    super(ARIA_DEFINITION, eventBus, policyEngine, memoryEngine);
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const projectId = task.input["projectId"] as string;
    const healthy = task.input["healthy"] as boolean;
    const errorMessage = task.input["errorMessage"] as string | undefined;

    let findings: string[];
    let recommendations: string[];
    let memoryType: MemoryType;

    if (healthy) {
      findings = ["Project is healthy", "All endpoints responding"];
      recommendations = [];
      memoryType = MemoryType.SUCCESS;
    } else {
      findings = [
        "Project is DOWN",
        `Health check failed: ${errorMessage ?? "unknown error"}`,
      ];
      recommendations = [
        "Restart service",
        "Check logs",
        "Notify DevOps agent",
      ];
      memoryType = MemoryType.FAILURE;
    }

    if (this.notifier?.isConfigured()) {
      const ts = new Date().toISOString();
      if (!healthy) {
        await this.notifier.sendAlert(
          `Project Down: ${projectId}`,
          `Health check failed\nProject: ${projectId}\nError: ${errorMessage ?? "unknown"}\nTime: ${ts}`,
          "🚨"
        );
      } else {
        await this.notifier.sendAlert(
          `Project Recovered: ${projectId}`,
          `Project is back online\nProject: ${projectId}\nTime: ${ts}`,
          "✅"
        );
      }
      console.log(`[ARIA] alert sent for ${projectId}`);
    }

    const memoryTitle = healthy
      ? `${projectId}: health check passed`
      : `${projectId}: health check failed`;

    const contentLines = [...findings, `Checked at: ${new Date().toISOString()}`];
    if (!healthy && errorMessage) contentLines.push(`Error: ${errorMessage}`);

    const memoryStored = await this.storeMemory({
      type: memoryType,
      scope: MemoryScope.PROJECT,
      title: memoryTitle,
      content: contentLines.join(". "),
      tags: ["health-check", projectId, healthy ? "healthy" : "down"],
      projectId,
      agentId: this.definition.id,
      importance: healthy ? 4 : 8,
    });

    const summary = healthy
      ? `✓ ${projectId}: HEALTHY`
      : `✗ ${projectId}: DOWN — ${errorMessage ?? "unknown error"}`;

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary,
      findings,
      recommendations,
      memoryStored,
      completedAt: new Date().toISOString(),
    };
  }
}
