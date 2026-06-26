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

const NOVA_DEFINITION: AgentDefinition = {
  id: "reporter-agent-001",
  name: "Nova",
  role: AgentRole.REPORTER,
  department: "Report Department",
  autonomyLevel: 0,
  capabilities: ["summarize", "format-report", "telegram-alert"],
  description: "Generates and sends operational reports to founder",
};

export class ReporterAgent extends BaseAgent {
  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine,
    private readonly notifier?: TelegramNotifier
  ) {
    super(NOVA_DEFINITION, eventBus, policyEngine, memoryEngine);
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const reports = task.input["reports"] as AgentReport[];

    const total = reports.length;
    const failures = reports.filter((r) =>
      r.findings.some((f) => f.includes("DOWN"))
    ).length;
    const healthy = total - failures;

    const timestamp = new Date().toISOString();
    const lines = [
      `AIOS Status Report — ${timestamp}`,
      `  Projects monitored: ${total}`,
      `  Healthy: ${healthy}`,
      `  Issues: ${failures}`,
      ...reports.map((r) => `  • ${r.summary}`),
    ];
    const summary = lines.join("\n");

    console.log(`\n[REPORT]\n${summary}`);

    if (this.notifier?.isConfigured()) {
      await this.notifier.sendAlert("AIOS Status Report", summary, "📊");
      console.log("[NOVA] Telegram alert sent");
    } else {
      console.log("[NOVA] Telegram not configured");
    }

    const memoryStored = await this.storeMemory({
      type: MemoryType.EPISODIC,
      scope: MemoryScope.GLOBAL,
      title: "AIOS Daily Status Report",
      content: summary,
      tags: ["report", "status", "daily"],
      agentId: this.definition.id,
      importance: 7,
    });

    const recommendations =
      failures > 0
        ? ["Investigate failing projects", "Run health checks"]
        : ["All systems normal"];

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary,
      findings: reports.map((r) => r.summary),
      recommendations,
      memoryStored,
      completedAt: new Date().toISOString(),
    };
  }
}
