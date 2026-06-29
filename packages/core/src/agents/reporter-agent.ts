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
    private readonly notifier?: TelegramNotifier,
    modelRouter?: ModelRouter
  ) {
    super(NOVA_DEFINITION, eventBus, policyEngine, memoryEngine, modelRouter);
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    if ("goalText" in task.input) {
      return this.executeGoalAck(task);
    }
    return this.executeReport(task);
  }

  private async executeGoalAck(task: AgentTask): Promise<AgentReport> {
    const goalText = task.input["goalText"] as string;
    const fromUser = task.input["fromUser"] as string;
    const receivedAt = task.input["receivedAt"] as string;

    const prompt = [
      `A new goal has been submitted to AIOS. Generate a brief acknowledgment summary.`,
      ``,
      `Goal: ${goalText}`,
      `From: ${fromUser}`,
      `Received at: ${receivedAt}`,
      ``,
      `Respond with exactly one sentence starting with "Goal received:" summarizing what the goal is about, then append " Will be processed by Apex in v2.5.0." Keep the total response under 2 sentences.`,
    ].join("\n");

    const llmResponse = await this.think(prompt);
    const summary = llmResponse.startsWith("[LLM")
      ? `Goal received: ${goalText.slice(0, 80)}. Will be processed by Apex in v2.5.0.`
      : llmResponse;

    console.log(`[NOVA] goal ack for ${fromUser}: ${summary.slice(0, 80)}`);

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary,
      findings: [`Goal from ${fromUser}: ${goalText}`],
      recommendations: ["Apex will decompose in v2.5.0"],
      memoryStored: false,
      completedAt: new Date().toISOString(),
    };
  }

  private async executeReport(task: AgentTask): Promise<AgentReport> {
    const reports = task.input["reports"] as AgentReport[];

    const total = reports.length;
    const failures = reports.filter((r) =>
      r.findings.some((f) => f.includes("DOWN"))
    ).length;
    const healthy = total - failures;

    const timestamp = new Date().toISOString();

    // Try LLM narrative summary
    let summary: string;
    const llmPrompt = [
      `Generate a concise, friendly Telegram message summarizing this AIOS operational status.`,
      ``,
      `Timestamp: ${timestamp}`,
      `Projects monitored: ${total}`,
      `Healthy: ${healthy}`,
      `Issues: ${failures}`,
      ``,
      `Project details:`,
      ...reports.map((r) => `• ${r.summary}`),
      ``,
      `Requirements: friendly tone, specific project names, actionable next steps if issues exist, under 250 words, emojis welcome.`,
    ].join("\n");

    const llmResponse = await this.think(llmPrompt, this.buildSystemPrompt());

    if (llmResponse.startsWith("[LLM")) {
      // Fallback to structured format
      const lines = [
        `AIOS Status Report — ${timestamp}`,
        `  Projects monitored: ${total}`,
        `  Healthy: ${healthy}`,
        `  Issues: ${failures}`,
        ...reports.map((r) => `  • ${r.summary}`),
      ];
      summary = lines.join("\n");
    } else {
      summary = llmResponse;
    }

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
