import { createCorrelationId, createEvent, EventType, ProjectState } from "../../../contracts/src/index.js";
import type { ProjectHealth, ServiceHealth, ServiceState } from "../../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { ProjectRegistry } from "../../../project-runtime/src/index.js";
import { HealthCheckRunner } from "./health-check-runner.js";
import { ProcessMonitor } from "./process-monitor.js";

export class MonitoringWorker {
  readonly name = "monitoring-worker";
  private serviceState: ServiceState = "created";
  private intervalId?: ReturnType<typeof setInterval>;
  private readonly previousHealth = new Map<string, boolean>();
  private readonly processMonitor = new ProcessMonitor();
  private readonly healthRunner = new HealthCheckRunner();

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

      let newHealth: ProjectHealth;
      let responseTime: number | undefined;

      if (project.config.port !== undefined) {
        // Single call — get raw connectivity result and derive health state from it.
        const raw = await this.processMonitor.checkProcess(
          project.config.id,
          project.config.port
        );
        responseTime = raw.responseTime;
        newHealth = {
          projectId: project.config.id,
          state: raw.alive ? ProjectState.ACTIVE : ProjectState.ERROR,
          healthy: raw.alive,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: raw.alive ? undefined : raw.error,
        };
      } else {
        // No port — fall back to filesystem presence check.
        newHealth = await this.healthRunner.checkProjectHealth(project);
      }

      this.projectRegistry.updateProjectHealth(project.config.id, {
        state: newHealth.state,
        healthy: newHealth.healthy,
        errorMessage: newHealth.errorMessage,
      });

      await this.eventBus.publish(
        createEvent({
          type: EventType.MONITORING_CHECK_COMPLETED,
          source: "monitoring-worker",
          correlationId,
          payload: {
            projectId: project.config.id,
            healthy: newHealth.healthy,
            state: newHealth.state,
            ...(responseTime !== undefined && { responseTime }),
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

      // Degraded: alive but slow
      if (responseTime !== undefined && responseTime > 2_000) {
        await this.eventBus.publish(
          createEvent({
            type: EventType.MONITORING_PROJECT_DEGRADED,
            source: "monitoring-worker",
            correlationId,
            payload: { projectId: project.config.id, responseTime },
          })
        );
      }

      this.previousHealth.set(project.config.id, newHealth.healthy);
    }
  }
}
