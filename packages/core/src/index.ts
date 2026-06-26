import { AIOSKernel } from "./kernel.js";
import { MockService } from "./services/mock-service.js";
import { InMemoryEventBus } from "../../events/src/index.js";

const eventBus = new InMemoryEventBus();

// Demo: wildcard subscriber — receives every event the bus publishes.
// The bus already logs [event] lines internally; this shows the subscriber API works.
const unsubscribe = eventBus.subscribe("*", (_event) => {
  // wildcard handler registered — demonstrates subscribe() and UnsubscribeFn
});

const kernel = new AIOSKernel(eventBus);

kernel.registerService(new MockService("event-bus"));
kernel.registerService(new MockService("configuration"));
kernel.registerService(new MockService("project-registry"));
kernel.registerService(new MockService("monitoring"));

console.log("[AIOS] Booting kernel...");
await kernel.boot();

// Demonstrate the event store: print first 5 events captured during boot
const bootEvents = eventBus.getEvents({ limit: 5 });
const totalStored = eventBus.getEvents().length;
console.log(`\n[AIOS] First 5 of ${totalStored} stored events:`);
for (const e of bootEvents) {
  console.log(`  ${e.type} [${e.correlationId}]`);
}

// Unsubscribe the demo handler before health check to show unsubscribe works
unsubscribe();

const health = await kernel.healthCheck();
console.log("\n[AIOS] Health Report:");
console.log(JSON.stringify(health, null, 2));

console.log("\n[AIOS] Kernel running. Press Ctrl+C to shutdown.\n");
await kernel.run();

process.exit(0);
