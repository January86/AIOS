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

interface LlmAnalysis {
  root_cause: string;
  severity: string;
  recommended_action: string;
  confidence: number;
}

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
    private readonly notifier?: TelegramNotifier,
    modelRouter?: ModelRouter
  ) {
    super(ARIA_DEFINITION, eventBus, policyEngine, memoryEngine, modelRouter);
  }

  private async analyzeFault(
    projectId: string,
    errorMessage: string | undefined
  ): Promise<LlmAnalysis | null> {
    const prompt = [
      `Analyze this service health check failure and provide structured analysis.`,
      `Project: ${projectId}`,
      `Error: ${errorMessage ?? "unknown error"}`,
      `Timestamp: ${new Date().toISOString()}`,
      ``,
      `Respond ONLY with valid JSON, no markdown:`,
      `{"root_cause":"...","severity":"low|medium|high|critical","recommended_action":"...","confidence":0.0}`,
    ].join("\n");

    const raw = await this.think(prompt);

    if (raw.startsWith("[LLM")) return null;

    try {
      // Strip markdown code fences if model wraps JSON
      const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
      return JSON.parse(cleaned) as LlmAnalysis;
    } catch {
      console.warn(`[ARIA] LLM returned non-JSON: ${raw.slice(0, 100)}`);
      return null;
    }
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const projectId = task.input["projectId"] as string;
    const healthy = task.input["healthy"] as boolean;
    const errorMessage = task.input["errorMessage"] as string | undefined;

    let findings: string[];
    let recommendations: string[];
    let memoryType: MemoryType;
    let contentLines: string[];

    if (healthy) {
      findings = ["Project is healthy", "All endpoints responding"];
      recommendations = [];
      memoryType = MemoryType.SUCCESS;
      contentLines = [...findings, `Checked at: ${new Date().toISOString()}`];
    } else {
      findings = [
        "Project is DOWN",
        `Health check failed: ${errorMessage ?? "unknown error"}`,
      ];
      recommendations = ["Restart service", "Check logs", "Notify DevOps agent"];
      memoryType = MemoryType.FAILURE;
      contentLines = [...findings, `Checked at: ${new Date().toISOString()}`];
      if (errorMessage) contentLines.push(`Error: ${errorMessage}`);

      // LLM fault analysis
      const analysis = await this.analyzeFault(projectId, errorMessage);
      if (analysis) {
        findings.push(`Root cause: ${analysis.root_cause}`);
        findings.push(`Severity: ${analysis.severity} (confidence: ${analysis.confidence})`);
        recommendations.unshift(analysis.recommended_action);
        contentLines.push(`LLM analysis: ${JSON.stringify(analysis)}`);
        console.log(`[ARIA] LLM analysis for ${projectId}: severity=${analysis.severity}, confidence=${analysis.confidence}`);
      }
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
