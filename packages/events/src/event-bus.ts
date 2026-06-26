import { createEvent } from "../../contracts/src/index.js";
import type { AIOSEvent } from "../../contracts/src/index.js";
import { EventType } from "../../contracts/src/index.js";

export type UnsubscribeFn = () => void;
export type EventHandler = (event: AIOSEvent) => Promise<void> | void;

const MAX_STORE_SIZE = 1000;

export class InMemoryEventBus {
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly eventStore: AIOSEvent[] = [];

  subscribe(type: EventType | "*", handler: EventHandler): UnsubscribeFn {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type) ?? [];
      const filtered = current.filter((h) => h !== handler);
      if (filtered.length === 0) {
        this.handlers.delete(type);
      } else {
        this.handlers.set(type, filtered);
      }
    };
  }

  async publish(event: AIOSEvent): Promise<void> {
    this.store(event);
    await this.dispatch(event);
  }

  // Synchronously constructs and stores the event, dispatches handlers async (fire-and-forget).
  publishRaw(
    type: EventType,
    payload?: Record<string, unknown>,
    correlationId?: string
  ): AIOSEvent {
    const event = createEvent({ type, source: "event-bus", payload, correlationId });
    this.store(event);
    void this.dispatch(event);
    return event;
  }

  getEvents(filter?: { type?: EventType; since?: string; limit?: number }): AIOSEvent[] {
    let results = [...this.eventStore];
    if (filter?.type !== undefined) {
      results = results.filter((e) => e.type === filter.type);
    }
    if (filter?.since !== undefined) {
      const since = filter.since;
      results = results.filter((e) => e.timestamp >= since);
    }
    if (filter?.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }

  getEvent(id: string): AIOSEvent | undefined {
    return this.eventStore.find((e) => e.id === id);
  }

  clearEvents(): void {
    this.eventStore.length = 0;
  }

  private store(event: AIOSEvent): void {
    if (this.eventStore.length >= MAX_STORE_SIZE) {
      this.eventStore.shift();
    }
    this.eventStore.push(event);
    console.log(`[event] ${event.timestamp} ${event.type} ${event.correlationId}`);
  }

  private async dispatch(event: AIOSEvent): Promise<void> {
    const directHandlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get("*") ?? [];
    for (const handler of [...directHandlers, ...wildcardHandlers]) {
      await handler(event);
    }
  }
}
