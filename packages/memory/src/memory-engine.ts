import {
  createCorrelationId,
  createEvent,
  EventType,
} from "../../contracts/src/index.js";
import type {
  CreateMemoryInput,
  KernelService,
  MemoryRecord,
  SearchMemoryInput,
  ServiceHealth,
  ServiceState,
} from "../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../events/src/index.js";
import { MemoryStore } from "./memory-store.js";

export class MemoryEngine implements KernelService {
  readonly name = "memory-engine";
  private serviceState: ServiceState = "created";
  private startedAt?: string;

  constructor(
    private readonly store: MemoryStore,
    private readonly eventBus: InMemoryEventBus
  ) {}

  async init(): Promise<void> {
    this.serviceState = "initializing";
  }

  async start(): Promise<void> {
    this.serviceState = "running";
    this.startedAt = new Date().toISOString();
    console.log(
      `[${new Date().toISOString()}] [memory-engine] started`
    );
  }

  async stop(): Promise<void> {
    this.serviceState = "stopped";
    console.log(
      `[${new Date().toISOString()}] [memory-engine] stopped`
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

  async remember(input: CreateMemoryInput): Promise<MemoryRecord> {
    const correlationId = createCorrelationId();
    try {
      const record = await this.store.create(input);
      await this.eventBus.publish(
        createEvent({
          type: EventType.MEMORY_CREATED,
          source: "memory-engine",
          correlationId,
          payload: {
            id: record.id,
            type: record.type,
            scope: record.scope,
            title: record.title,
            importance: record.importance,
          },
        })
      );
      return record;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [memory-engine] remember failed:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async recall(input: SearchMemoryInput): Promise<MemoryRecord[]> {
    const correlationId = createCorrelationId();
    try {
      const results = await this.store.search(input);
      await this.eventBus.publish(
        createEvent({
          type: EventType.MEMORY_SEARCHED,
          source: "memory-engine",
          correlationId,
          payload: {
            query: input.query ?? null,
            projectId: input.projectId ?? null,
            tags: input.tags ?? [],
            resultCount: results.length,
          },
        })
      );
      return results;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [memory-engine] recall failed:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async forget(id: string): Promise<void> {
    const correlationId = createCorrelationId();
    try {
      await this.store.delete(id);
      await this.eventBus.publish(
        createEvent({
          type: EventType.MEMORY_EVICTED,
          source: "memory-engine",
          correlationId,
          payload: { id },
        })
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [memory-engine] forget failed:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async runExpiry(): Promise<void> {
    const correlationId = createCorrelationId();
    try {
      const count = await this.store.expire();
      if (count > 0) {
        await this.eventBus.publish(
          createEvent({
            type: EventType.MEMORY_EXPIRED,
            source: "memory-engine",
            correlationId,
            payload: { expiredCount: count },
          })
        );
        console.log(
          `[${new Date().toISOString()}] [memory-engine] expired ${count} records`
        );
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [memory-engine] runExpiry failed:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
