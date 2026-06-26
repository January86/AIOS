import { createEvent, EventType, ProjectState } from "../../contracts/src/index.js";
import type {
  KernelService,
  ProjectConfig,
  ProjectHealth,
  ProjectRecord,
  ServiceHealth,
  ServiceState,
} from "../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../events/src/index.js";

export class ProjectRegistry implements KernelService {
  readonly name = "project-registry";
  private serviceState: ServiceState = "created";
  private readonly projects = new Map<string, ProjectRecord>();

  constructor(private readonly eventBus: InMemoryEventBus) {}

  async init(): Promise<void> {
    this.serviceState = "initializing";
  }

  async start(): Promise<void> {
    this.serviceState = "running";
  }

  async stop(): Promise<void> {
    this.serviceState = "stopped";
  }

  async health(): Promise<ServiceHealth> {
    return {
      name: this.name,
      state: this.serviceState,
      healthy: this.serviceState === "running",
      checkedAt: new Date().toISOString(),
    };
  }

  registerProject(config: ProjectConfig): ProjectRecord {
    if (this.projects.has(config.id)) {
      throw new Error(`Project already registered: ${config.id}`);
    }
    const now = new Date().toISOString();
    const record: ProjectRecord = {
      config,
      health: {
        projectId: config.id,
        state: ProjectState.REGISTERED,
        healthy: true,
        lastCheckedAt: now,
      },
      registeredAt: now,
      metadata: {},
    };
    this.projects.set(config.id, record);
    void this.eventBus.publish(
      createEvent({
        type: EventType.PROJECT_REGISTERED,
        source: "project-registry",
        payload: { projectId: config.id, name: config.name, tier: config.tier },
      })
    );
    return record;
  }

  unregisterProject(id: string): void {
    if (!this.projects.has(id)) {
      throw new Error(`Project not found: ${id}`);
    }
    this.projects.delete(id);
    void this.eventBus.publish(
      createEvent({
        type: EventType.PROJECT_UNREGISTERED,
        source: "project-registry",
        payload: { projectId: id },
      })
    );
  }

  getProject(id: string): ProjectRecord | undefined {
    return this.projects.get(id);
  }

  listProjects(): ProjectRecord[] {
    return [...this.projects.values()];
  }

  updateProjectHealth(id: string, health: Partial<ProjectHealth>): void {
    const record = this.projects.get(id);
    if (!record) {
      throw new Error(`Project not found: ${id}`);
    }
    record.health = {
      ...record.health,
      ...health,
      lastCheckedAt: new Date().toISOString(),
    };
    void this.eventBus.publish(
      createEvent({
        type: EventType.PROJECT_HEALTH_UPDATED,
        source: "project-registry",
        payload: {
          projectId: id,
          healthy: record.health.healthy,
          state: record.health.state,
        },
      })
    );
  }
}
