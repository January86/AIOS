import {
  AgentState,
  EventType,
  createEvent,
} from "../../../contracts/src/index.js";
import type {
  AgentReport,
  AgentTask,
  KernelService,
  ServiceHealth,
  ServiceState,
} from "../../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { MemoryEngine } from "../../../memory/src/index.js";
import type { PolicyEngine } from "../../../policy/src/index.js";
import type { ModelRouter } from "../model-router/index.js";
import type { TelegramNotifier } from "../telegram/telegram-notifier.js";
import { BaseAgent } from "./base-agent.js";
import { MonitoringAgent } from "./monitoring-agent.js";
import { ReporterAgent } from "./reporter-agent.js";

export class AgentRuntime implements KernelService {
  readonly name = "agent-runtime";
  private serviceState: ServiceState = "created";
  private startedAt?: string;
  private readonly agents = new Map<string, BaseAgent>();
  private taskInProgress = false;

  constructor(
    private readonly eventBus: InMemoryEventBus,
    private readonly policyEngine: PolicyEngine,
    private readonly memoryEngine: MemoryEngine,
    private readonly notifier?: TelegramNotifier,
    private readonly modelRouter?: ModelRouter
  ) {}

  async init(): Promise<void> {
    this.serviceState = "initializing";
  }

  async start(): Promise<void> {
    this.serviceState = "running";
    this.startedAt = new Date().toISOString();

    const aria = new MonitoringAgent(
      this.eventBus,
      this.policyEngine,
      this.memoryEngine,
      this.notifier,
      this.modelRouter
    );
    const nova = new ReporterAgent(
      this.eventBus,
      this.policyEngine,
      this.memoryEngine,
      this.notifier,
      this.modelRouter
    );

    this.registerAgent(aria);
    this.registerAgent(nova);

    await this.eventBus.publish(
      createEvent({
        type: EventType.AGENT_STARTED,
        source: "agent-runtime",
        payload: { agentCount: this.agents.size },
      })
    );

    console.log(
      `[${new Date().toISOString()}] [agent-runtime] started with ${this.agents.size} agents`
    );
  }

  async stop(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.setState(AgentState.OFFLINE);
    }
    this.serviceState = "stopped";

    await this.eventBus.publish(
      createEvent({
        type: EventType.AGENT_STOPPED,
        source: "agent-runtime",
        payload: { agentCount: this.agents.size },
      })
    );

    console.log(`[${new Date().toISOString()}] [agent-runtime] stopped`);
  }

  async health(): Promise<ServiceHealth> {
    return {
      name: this.name,
      state: this.serviceState,
      healthy: this.serviceState === "running",
      startedAt: this.startedAt,
      checkedAt: new Date().toISOString(),
    };
  }

  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.definition.id, agent);
    this.eventBus.publishRaw(EventType.AGENT_REGISTERED, {
      agentId: agent.definition.id,
      name: agent.definition.name,
      role: agent.definition.role,
      department: agent.definition.department,
    });
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  listAgents(): { id: string; name: string; role: string; state: AgentState }[] {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.definition.id,
      name: a.definition.name,
      role: a.definition.role,
      state: a.state,
    }));
  }

  async assignTask(agentId: string, task: AgentTask): Promise<AgentReport> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`);
    }
    return agent.assignTask(task);
  }

  subscribeToMonitoring(): void {
    this.eventBus.subscribe(EventType.MONITORING_PROJECT_DOWN, (event) => {
      const projectId = event.payload["projectId"] as string;
      const errorMessage = event.payload["errorMessage"] as string;

      if (this.taskInProgress) return;
      const aria = this.agents.get("monitoring-agent-001");
      if (!aria || aria.state === AgentState.WORKING) return;

      this.taskInProgress = true;

      const ariaTask: AgentTask = {
        id: crypto.randomUUID(),
        agentId: "monitoring-agent-001",
        title: `Check ${projectId} health`,
        description: `Investigate health failure for ${projectId}`,
        input: { projectId, healthy: false, errorMessage, state: "error" },
        priority: "high",
        createdAt: new Date().toISOString(),
      };

      aria
        .assignTask(ariaTask)
        .then((ariaReport) => {
          const nova = this.agents.get("reporter-agent-001");
          if (!nova || nova.state === AgentState.WORKING) return;

          const novaTask: AgentTask = {
            id: crypto.randomUUID(),
            agentId: "reporter-agent-001",
            title: "Generate incident report",
            description: "Consolidated incident report from Aria findings",
            input: { reports: [ariaReport] },
            priority: "medium",
            createdAt: new Date().toISOString(),
          };
          return nova.assignTask(novaTask);
        })
        .catch((e: unknown) => {
          console.error(
            "[agent-runtime] DOWN task chain failed:",
            e instanceof Error ? e.message : String(e)
          );
        })
        .finally(() => {
          this.taskInProgress = false;
        });
    });

    this.eventBus.subscribe(EventType.MONITORING_PROJECT_RECOVERED, (event) => {
      const projectId = event.payload["projectId"] as string;

      if (this.taskInProgress) return;
      const aria = this.agents.get("monitoring-agent-001");
      if (!aria || aria.state === AgentState.WORKING) return;

      this.taskInProgress = true;

      const ariaTask: AgentTask = {
        id: crypto.randomUUID(),
        agentId: "monitoring-agent-001",
        title: `Check ${projectId} recovery`,
        description: `Confirm recovery for ${projectId}`,
        input: { projectId, healthy: true, errorMessage: "", state: "active" },
        priority: "medium",
        createdAt: new Date().toISOString(),
      };

      aria
        .assignTask(ariaTask)
        .then((ariaReport) => {
          const nova = this.agents.get("reporter-agent-001");
          if (!nova || nova.state === AgentState.WORKING) return;

          const novaTask: AgentTask = {
            id: crypto.randomUUID(),
            agentId: "reporter-agent-001",
            title: "Generate incident report",
            description: "Recovery confirmation report from Aria findings",
            input: { reports: [ariaReport] },
            priority: "low",
            createdAt: new Date().toISOString(),
          };
          return nova.assignTask(novaTask);
        })
        .catch((e: unknown) => {
          console.error(
            "[agent-runtime] RECOVERED task chain failed:",
            e instanceof Error ? e.message : String(e)
          );
        })
        .finally(() => {
          this.taskInProgress = false;
        });
    });

    console.log(
      `[${new Date().toISOString()}] [agent-runtime] subscribed to monitoring events`
    );
  }
}
