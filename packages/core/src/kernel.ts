import { createEvent, type KernelService, type KernelState, type ServiceHealth } from "../../contracts/src/index.js";
import { InMemoryEventBus } from "../../events/src/index.js";

export interface KernelHealth {
  state: KernelState;
  services: ServiceHealth[];
  startedAt?: string;
  lastError?: string;
}

export class AIOSKernel {
  private state: KernelState = "created";
  private startedAt?: string;
  private services: KernelService[] = [];

  constructor(private readonly eventBus: InMemoryEventBus) {}

  registerService(service: KernelService): void {
    this.services.push(service);
  }

  getState(): KernelState {
    return this.state;
  }

  async boot(): Promise<void> {
    this.state = "booting";
    await this.eventBus.publish(createEvent({ type: "kernel.boot.started", source: "kernel" }));

    try {
      for (const service of this.services) {
        await service.init();
        await service.start();
        await this.eventBus.publish(
          createEvent({
            type: "kernel.service.started",
            source: "kernel",
            payload: { service: service.name },
          })
        );
      }

      this.startedAt = new Date().toISOString();
      this.state = "running";
      await this.eventBus.publish(createEvent({ type: "kernel.boot.completed", source: "kernel" }));
    } catch (error) {
      this.state = "failed";
      await this.eventBus.publish(
        createEvent({
          type: "kernel.boot.failed",
          source: "kernel",
          severity: "critical",
          payload: { error: error instanceof Error ? error.message : String(error) },
        })
      );
      throw error;
    }
  }

  async shutdown(reason = "manual"): Promise<void> {
    this.state = "shutting_down";
    await this.eventBus.publish(createEvent({ type: "kernel.shutdown.started", source: "kernel", payload: { reason } }));

    for (const service of [...this.services].reverse()) {
      await service.stop();
    }

    this.state = "stopped";
    await this.eventBus.publish(createEvent({ type: "kernel.shutdown.completed", source: "kernel" }));
  }

  async health(): Promise<KernelHealth> {
    const services = await Promise.all(this.services.map((service) => service.health()));
    return {
      state: this.state,
      services,
      startedAt: this.startedAt,
    };
  }
}
