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
import { BaseAgent } from "./base-agent.js";
import { MonitoringAgent } from "./monitoring-agent.js";
import { ReporterAgent } from "./reporter-agent.js";

export class AgentRuntime implements KernelService {
  readonly name = "agent-runtime";
  private serviceState: ServiceState = "created";
  private startedAt?: string;
  private readonly agents = new Map<string, BaseAgent>();

  constructor(
    private readonly eventBus: InMemoryEventBus,
    private readonly policyEngine: PolicyEngine,
    private readonly memoryEngine: MemoryEngine
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
      this.memoryEngine
    );
    const nova = new ReporterAgent(
      this.eventBus,
      this.policyEngine,
      this.memoryEngine
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

    console.log(
      `[${new Date().toISOString()}] [agent-runtime] stopped`
    );
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
}
