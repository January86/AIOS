import { AIOSKernel } from "./kernel.js";
import { MockService } from "./services/mock-service.js";
import { InMemoryEventBus } from "../../events/src/index.js";

const eventBus = new InMemoryEventBus();

eventBus.subscribe("*", (event) => {
  console.log(`[event] ${event.timestamp} ${event.type}`);
});

const kernel = new AIOSKernel(eventBus);

kernel.registerService(new MockService("event-bus"));
kernel.registerService(new MockService("configuration"));
kernel.registerService(new MockService("project-registry"));
kernel.registerService(new MockService("monitoring"));

console.log("[AIOS] Booting kernel...");
await kernel.boot();

const health = await kernel.healthCheck();
console.log("\n[AIOS] Health Report:");
console.log(JSON.stringify(health, null, 2));

console.log("\n[AIOS] Kernel running. Press Ctrl+C to shutdown.\n");
await kernel.run();

process.exit(0);
