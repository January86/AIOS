import { createEvent } from "../../contracts/src/index.js";
import type { KernelService, ServiceHealth } from "../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../events/src/index.js";

interface RegistryEntry {
  service: KernelService;
  startedAt?: string;
}

export class ServiceRegistry {
  private readonly entries = new Map<string, RegistryEntry>();

  constructor(private readonly eventBus: InMemoryEventBus) {}

  registerService(service: KernelService): void {
    if (this.entries.has(service.name)) {
      throw new Error(`Service already registered: ${service.name}`);
    }
    this.entries.set(service.name, { service });
    void this.eventBus.publish(
      createEvent({
        type: "kernel.service.registered",
        source: "service-registry",
        payload: { name: service.name },
      })
    );
  }

  unregisterService(name: string): void {
    if (!this.entries.has(name)) {
      throw new Error(`Service not found: ${name}`);
    }
    this.entries.delete(name);
    void this.eventBus.publish(
      createEvent({
        type: "kernel.service.unregistered",
        source: "service-registry",
        payload: { name },
      })
    );
  }

  getService(name: string): KernelService | undefined {
    return this.entries.get(name)?.service;
  }

  listServices(): KernelService[] {
    return [...this.entries.values()].map((e) => e.service);
  }

  markStarted(name: string): void {
    const entry = this.entries.get(name);
    if (entry) {
      entry.startedAt = new Date().toISOString();
    }
  }

  async healthAll(): Promise<ServiceHealth[]> {
    const results: ServiceHealth[] = [];
    for (const [, entry] of this.entries) {
      const h = await entry.service.health();
      results.push({ ...h, startedAt: entry.startedAt });
    }
    return results;
  }
}
