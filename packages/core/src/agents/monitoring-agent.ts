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
  ],
  description: "Monitors project health and detects incidents",
};

export class MonitoringAgent extends BaseAgent {
  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine
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

    const memoryTitle = `${projectId} health: ${healthy ? "HEALTHY" : "DOWN"}`;

    const memoryStored = await this.storeMemory({
      type: memoryType,
      scope: MemoryScope.PROJECT,
      title: memoryTitle,
      content: findings.join(". "),
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
