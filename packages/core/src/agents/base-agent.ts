import {
  ActionCategory,
  AgentState,
  PolicyDecision,
  RiskLevel,
  createCorrelationId,
  createEvent,
  EventType,
} from "../../../contracts/src/index.js";
import type {
  AgentDefinition,
  AgentReport,
  AgentTask,
  CreateMemoryInput,
} from "../../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { MemoryEngine } from "../../../memory/src/index.js";
import type { PolicyEngine } from "../../../policy/src/index.js";
import type { ModelRouter } from "../model-router/index.js";

export abstract class BaseAgent {
  private _state: AgentState = AgentState.IDLE;
  protected currentTask: AgentTask | null = null;

  constructor(
    public readonly definition: AgentDefinition,
    protected readonly eventBus: InMemoryEventBus,
    protected readonly policyEngine: PolicyEngine,
    protected readonly memoryEngine: MemoryEngine,
    protected readonly modelRouter?: ModelRouter
  ) {}

  get state(): AgentState {
    return this._state;
  }

  async setState(next: AgentState, correlationId?: string): Promise<void> {
    const previous = this._state;
    this._state = next;
    await this.eventBus.publish(
      createEvent({
        type: EventType.AGENT_STATE_CHANGED,
        source: this.definition.id,
        correlationId,
        payload: {
          agentId: this.definition.id,
          agentName: this.definition.name,
          from: previous,
          to: next,
        },
      })
    );
  }

  async assignTask(task: AgentTask): Promise<AgentReport> {
    const correlationId = createCorrelationId();

    await this.setState(AgentState.THINKING, correlationId);

    await this.eventBus.publish(
      createEvent({
        type: EventType.AGENT_TASK_ASSIGNED,
        source: this.definition.id,
        correlationId,
        payload: {
          taskId: task.id,
          agentId: this.definition.id,
          title: task.title,
          priority: task.priority,
        },
      })
    );

    const policyDecision = await this.policyEngine.evaluate({
      id: crypto.randomUUID(),
      requestedBy: this.definition.id,
      action: task.title,
      category: ActionCategory.READ,
      riskLevel: RiskLevel.LOW,
      payload: {},
      requestedAt: new Date().toISOString(),
      correlationId,
    });

    if (policyDecision.decision === PolicyDecision.DENY) {
      await this.setState(AgentState.BLOCKED, correlationId);
      throw new Error(
        `Task '${task.title}' denied by policy: ${policyDecision.reason}`
      );
    }

    await this.setState(AgentState.WORKING, correlationId);

    const startedTask: AgentTask = {
      ...task,
      startedAt: new Date().toISOString(),
    };
    this.currentTask = startedTask;

    await this.eventBus.publish(
      createEvent({
        type: EventType.AGENT_TASK_STARTED,
        source: this.definition.id,
        correlationId,
        payload: {
          taskId: task.id,
          agentId: this.definition.id,
          title: task.title,
        },
      })
    );

    const report = await this.execute(startedTask);
    this.currentTask = null;

    await this.eventBus.publish(
      createEvent({
        type: EventType.AGENT_REPORT_GENERATED,
        source: this.definition.id,
        correlationId,
        payload: {
          taskId: task.id,
          agentId: this.definition.id,
          agentName: this.definition.name,
          summary: report.summary,
          memoryStored: report.memoryStored,
        },
      })
    );

    await this.setState(AgentState.IDLE, correlationId);

    await this.eventBus.publish(
      createEvent({
        type: EventType.AGENT_TASK_COMPLETED,
        source: this.definition.id,
        correlationId,
        payload: {
          taskId: task.id,
          agentId: this.definition.id,
          title: task.title,
          memoryStored: report.memoryStored,
        },
      })
    );

    return report;
  }

  protected abstract execute(task: AgentTask): Promise<AgentReport>;

  protected buildSystemPrompt(): string {
    const caps = this.definition.capabilities.join(", ");
    return [
      `You are ${this.definition.name}, an AI agent in the AIOS autonomous system.`,
      `Role: ${this.definition.role}`,
      `Department: ${this.definition.department}`,
      `Capabilities: ${caps}`,
      "",
      "Core rules:",
      "- Never fabricate data. If you don't know, say so.",
      "- Always include a confidence score (0.0–1.0) in your analysis.",
      "- Never execute destructive actions without approval for autonomy level 2+.",
      "- Always recall relevant memory context before starting a task.",
      "- Be concise, accurate, and actionable.",
    ].join("\n");
  }

  protected async think(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.modelRouter?.isConfigured()) {
      return "[LLM not configured]";
    }
    try {
      return await this.modelRouter.complete(
        this.definition.role,
        [{ role: "user", content: prompt }],
        { systemPrompt: systemPrompt ?? this.buildSystemPrompt() }
      );
    } catch (error) {
      return `[LLM error: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  protected async storeMemory(input: CreateMemoryInput): Promise<boolean> {
    try {
      const existing = await this.memoryEngine.recall({
        query: input.title,
        limit: 1,
      });

      if (existing.length > 0) {
        const found = existing[0];
        if (found.type === input.type && found.projectId === input.projectId) {
          return false;
        }
        // State changed (e.g. FAILURE → SUCCESS) — replace stale record
        await this.memoryEngine.forget(found.id);
        console.log(`[MEMORY] updated: ${input.title}`);
      }

      await this.memoryEngine.remember(input);
      return true;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [${this.definition.id}] storeMemory failed:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}
