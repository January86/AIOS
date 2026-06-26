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

export abstract class BaseAgent {
  private _state: AgentState = AgentState.IDLE;
  protected currentTask: AgentTask | null = null;

  constructor(
    public readonly definition: AgentDefinition,
    protected readonly eventBus: InMemoryEventBus,
    protected readonly policyEngine: PolicyEngine,
    protected readonly memoryEngine: MemoryEngine
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

  protected async storeMemory(input: CreateMemoryInput): Promise<boolean> {
    try {
      const existing = await this.memoryEngine.recall({
        query: input.title,
        limit: 1,
      });
      if (existing.length > 0) return false;
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
