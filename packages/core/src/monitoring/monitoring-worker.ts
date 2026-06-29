import { createCorrelationId, createEvent, EventType } from "../../../contracts/src/index.js";
import type { ProjectHealth, ServiceHealth, ServiceState } from "../../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { ProjectRegistry } from "../../../project-runtime/src/index.js";
import { HealthCheckRunner } from "./health-check-runner.js";
import { HealthHistory } from "./health-history.js";

export class MonitoringWorker {
  readonly name = "monitoring-worker";
  private serviceState: ServiceState = "created";
  private intervalId?: ReturnType<typeof setInterval>;
  private readonly previousHealth = new Map<string, boolean>();
  private readonly healthRunner = new HealthCheckRunner();
  private readonly _healthHistory = new HealthHistory();

  constructor(
    private readonly eventBus: InMemoryEventBus,
    private readonly projectRegistry: ProjectRegistry,
    private readonly checkIntervalMs = 30_000
  ) {}

  async init(): Promise<void> {
    this.serviceState = "initializing";
  }

  async start(): Promise<void> {
    this.serviceState = "running";
    this.intervalId = setInterval(() => {
      void this.runChecks();
    }, this.checkIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
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

  async runChecks(): Promise<void> {
    const projects = this.projectRegistry.listProjects();
    const correlationId = createCorrelationId();

    for (const project of projects) {
      const previouslyHealthy =
        this.previousHealth.get(project.config.id) ?? project.health.healthy;

      await this.eventBus.publish(
        createEvent({
          type: EventType.MONITORING_CHECK_STARTED,
          source: "monitoring-worker",
          correlationId,
          payload: { projectId: project.config.id },
        })
      );

      const newHealth: ProjectHealth = await this.healthRunner.checkProjectHealth(project);

      this.projectRegistry.updateProjectHealth(project.config.id, {
        state: newHealth.state,
        healthy: newHealth.healthy,
        errorMessage: newHealth.errorMessage,
      });

      this._healthHistory.record(project.config.id, newHealth.healthy, newHealth.uptime);

      await this.eventBus.publish(
        createEvent({
          type: EventType.MONITORING_CHECK_COMPLETED,
          source: "monitoring-worker",
          correlationId,
          payload: {
            projectId: project.config.id,
            healthy: newHealth.healthy,
            state: newHealth.state,
          },
        })
      );

      // Transition: healthy → unhealthy
      if (previouslyHealthy && !newHealth.healthy) {
        await this.eventBus.publish(
          createEvent({
            type: EventType.MONITORING_PROJECT_DOWN,
            source: "monitoring-worker",
            severity: "error",
            correlationId,
            payload: {
              projectId: project.config.id,
              errorMessage: newHealth.errorMessage ?? "unreachable",
            },
          })
        );
      }

      // Transition: unhealthy → healthy
      if (!previouslyHealthy && newHealth.healthy) {
        await this.eventBus.publish(
          createEvent({
            type: EventType.MONITORING_PROJECT_RECOVERED,
            source: "monitoring-worker",
            correlationId,
            payload: { projectId: project.config.id },
          })
        );
      }

      this.previousHealth.set(project.config.id, newHealth.healthy);
    }
  }

  get healthHistory(): HealthHistory {
    return this._healthHistory;
  }
}
