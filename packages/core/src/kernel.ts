import { createEvent, EventType, KernelState } from "../../contracts/src/index.js";
import type { KernelService, ServiceHealth } from "../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../events/src/index.js";
import { ServiceRegistry } from "./service-registry.js";

export type KernelHealthStatus = "healthy" | "degraded" | "critical";

export interface KernelHealthReport {
  status: KernelHealthStatus;
  state: KernelState;
  services: ServiceHealth[];
  startedAt?: string;
  lastError?: string;
  checkedAt: string;
}

export class AIOSKernel {
  private state: KernelState = KernelState.IDLE;
  private startedAt?: string;
  private lastError?: string;
  readonly registry: ServiceRegistry;

  constructor(private readonly eventBus: InMemoryEventBus) {
    this.registry = new ServiceRegistry(eventBus);
  }

  registerService(service: KernelService): void {
    this.registry.registerService(service);
  }

  getState(): KernelState {
    return this.state;
  }

  private log(msg: string): void {
    console.log(`[${new Date().toISOString()}] [kernel] ${msg}`);
  }

  private async transition(to: KernelState): Promise<void> {
    const from = this.state;
    this.state = to;
    this.log(`state: ${from} → ${to}`);
  }

  async boot(): Promise<void> {
    if (this.state !== KernelState.IDLE && this.state !== KernelState.STOPPED) {
      throw new Error(`Cannot boot from state: ${this.state}`);
    }

    await this.transition(KernelState.BOOTING);
    await this.eventBus.publish(
      createEvent({ type: EventType.KERNEL_BOOT_STARTED, source: "kernel", payload: { state: this.state } })
    );

    try {
      for (const service of this.registry.listServices()) {
        await service.init();
        await service.start();
        this.registry.markStarted(service.name);
        await this.eventBus.publish(
          createEvent({
            type: EventType.KERNEL_SERVICE_STARTED,
            source: "kernel",
            payload: { name: service.name },
          })
        );
      }

      this.startedAt = new Date().toISOString();
      await this.transition(KernelState.RUNNING);
      await this.eventBus.publish(
        createEvent({
          type: EventType.KERNEL_BOOT_COMPLETED,
          source: "kernel",
          payload: { startedAt: this.startedAt },
        })
      );
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      await this.transition(KernelState.ERROR);
      await this.eventBus.publish(
        createEvent({
          type: EventType.KERNEL_ERROR_OCCURRED,
          source: "kernel",
          severity: "critical",
          payload: { error: this.lastError },
        })
      );
      throw error;
    }
  }

  async shutdown(reason = "manual"): Promise<void> {
    if (this.state === KernelState.STOPPED || this.state === KernelState.SHUTTING_DOWN) {
      return;
    }

    await this.transition(KernelState.SHUTTING_DOWN);
    await this.eventBus.publish(
      createEvent({
        type: EventType.KERNEL_SHUTDOWN_STARTED,
        source: "kernel",
        payload: { reason },
      })
    );

    for (const service of [...this.registry.listServices()].reverse()) {
      await service.stop();
    }

    await this.transition(KernelState.STOPPED);
    await this.eventBus.publish(
      createEvent({ type: EventType.KERNEL_SHUTDOWN_COMPLETED, source: "kernel" })
    );
  }

  async recover(): Promise<void> {
    if (this.state !== KernelState.ERROR) {
      throw new Error(`Cannot recover from state: ${this.state}`);
    }

    await this.eventBus.publish(
      createEvent({ type: EventType.KERNEL_RECOVERY_STARTED, source: "kernel" })
    );

    this.lastError = undefined;
    await this.transition(KernelState.IDLE);
    await this.boot();

    await this.eventBus.publish(
      createEvent({ type: EventType.KERNEL_RECOVERY_COMPLETED, source: "kernel" })
    );
  }

  async healthCheck(): Promise<KernelHealthReport> {
    const services = await this.registry.healthAll();
    const anyUnhealthy = services.some((s) => !s.healthy);

    let status: KernelHealthStatus;
    if (this.state === KernelState.ERROR) {
      status = "critical";
    } else if (anyUnhealthy) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    const report: KernelHealthReport = {
      status,
      state: this.state,
      services,
      startedAt: this.startedAt,
      lastError: this.lastError,
      checkedAt: new Date().toISOString(),
    };

    await this.eventBus.publish(
      createEvent({
        type: EventType.KERNEL_HEALTH_CHECKED,
        source: "kernel",
        payload: { status, serviceCount: services.length },
      })
    );

    return report;
  }

  // Blocks until SIGINT or SIGTERM, then shuts down gracefully.
  run(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Keep the event loop alive until a signal is received.
      const keepAlive = setInterval(() => {}, 1_000);

      const handle = (signal: string) => {
        clearInterval(keepAlive);
        this.log(`received ${signal}, initiating graceful shutdown`);
        void this.shutdown(signal).then(resolve);
      };
      process.once("SIGINT", () => handle("SIGINT"));
      process.once("SIGTERM", () => handle("SIGTERM"));
    });
  }
}
