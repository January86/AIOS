import type { AIOSEvent } from "../../contracts/src/index.js";

export type EventHandler = (event: AIOSEvent) => Promise<void> | void;

export class InMemoryEventBus {
  private handlers = new Map<string, EventHandler[]>();

  subscribe(type: string, handler: EventHandler): void {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  async publish(event: AIOSEvent): Promise<void> {
    const directHandlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get("*") ?? [];
    for (const handler of [...directHandlers, ...wildcardHandlers]) {
      await handler(event);
    }
  }
}
