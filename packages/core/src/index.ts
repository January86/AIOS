import { ProjectTier } from "../../contracts/src/index.js";
import { InMemoryEventBus } from "../../events/src/index.js";
import { ProjectRegistry } from "../../project-runtime/src/index.js";
import { AIOSKernel } from "./kernel.js";
import { MockService } from "./services/mock-service.js";

const eventBus = new InMemoryEventBus();

// Demo: wildcard subscriber — receives every event the bus publishes.
const unsubscribe = eventBus.subscribe("*", (_event) => {
  // wildcard handler registered — demonstrates subscribe() and UnsubscribeFn
});

const kernel = new AIOSKernel(eventBus);
const projectRegistry = new ProjectRegistry(eventBus);

kernel.registerService(new MockService("event-bus"));
kernel.registerService(new MockService("configuration"));
kernel.registerService(projectRegistry);
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

// Unsubscribe the demo handler before continuing
unsubscribe();

// --- Project Registry demo ---
const now = new Date().toISOString();

projectRegistry.registerProject({
  id: "ha-platform",
  name: "Hospitality AI Platform",
  description: "AI-powered platform for hospitality management",
  tier: ProjectTier.UPSCALE,
  path: "/home/administrator/projects/ha-platform",
  port: 3000,
  tags: ["production", "hospitality"],
  createdAt: now,
  updatedAt: now,
});

projectRegistry.registerProject({
  id: "executive-brief",
  name: "Executive Brief",
  description: "AI-curated executive news briefings",
  tier: ProjectTier.STANDARD,
  path: "/home/administrator/projects/executive-brief",
  port: 3001,
  tags: ["production", "news"],
  createdAt: now,
  updatedAt: now,
});

const projects = projectRegistry.listProjects();
console.log(`\n[AIOS] Registered projects (${projects.length}):`);
for (const p of projects) {
  console.log(`  ${p.config.id} | ${p.config.name} | tier=${p.config.tier} | state=${p.health.state}`);
}

const haPlatform = projectRegistry.getProject("ha-platform");
console.log("\n[AIOS] Project detail — ha-platform:");
console.log(JSON.stringify(haPlatform, null, 2));

// --- Health check ---
const health = await kernel.healthCheck();
console.log("\n[AIOS] Health Report:");
console.log(JSON.stringify(health, null, 2));

console.log("\n[AIOS] Kernel running. Press Ctrl+C to shutdown.\n");
await kernel.run();

process.exit(0);
