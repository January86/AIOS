import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { InMemoryEventBus } from "../../../packages/events/src/index.js";
import { MemoryEngine, MemoryStore } from "../../../packages/memory/src/index.js";
import { PolicyEngine } from "../../../packages/policy/src/index.js";
import { ProjectRegistry } from "../../../packages/project-runtime/src/index.js";
import { AIOSKernel } from "../../../packages/core/src/kernel.js";
import { AgentRuntime } from "../../../packages/core/src/agents/index.js";
import { MonitoringWorker } from "../../../packages/core/src/monitoring/index.js";
import { MockService } from "../../../packages/core/src/services/mock-service.js";
import { TelegramNotifier } from "../../../packages/core/src/telegram/index.js";
import { ProjectTier } from "../../../packages/contracts/src/index.js";
import { createServer } from "./server.js";

// ── Telegram ──────────────────────────────────────────────────────────────────

const notifier = new TelegramNotifier();

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const eventBus = new InMemoryEventBus();
const kernel = new AIOSKernel(eventBus);
const projectRegistry = new ProjectRegistry(eventBus);
const monitoringWorker = new MonitoringWorker(eventBus, projectRegistry, 30_000);
const policyEngine = new PolicyEngine(eventBus);

const adapter = new PrismaPg(process.env["DATABASE_URL"] as string);
const prisma = new PrismaClient({ adapter });
const memoryStore = new MemoryStore(prisma);
const memoryEngine = new MemoryEngine(memoryStore, eventBus);

const agentRuntime = new AgentRuntime(eventBus, policyEngine, memoryEngine, notifier);

kernel.registerService(new MockService("event-bus"));
kernel.registerService(new MockService("configuration"));
kernel.registerService(projectRegistry);
kernel.registerService(monitoringWorker);
kernel.registerService(policyEngine);
kernel.registerService(memoryEngine);
kernel.registerService(agentRuntime);

// ── Boot ──────────────────────────────────────────────────────────────────────

console.log("[API] Booting AIOS kernel...");
await kernel.boot();

// ── Register projects ─────────────────────────────────────────────────────────

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

// ── Wire monitoring auto-trigger ──────────────────────────────────────────────

agentRuntime.subscribeToMonitoring();

// ── Start Express ─────────────────────────────────────────────────────────────

const app = createServer({
  kernel,
  projectRegistry,
  agentRuntime,
  eventBus,
  memoryEngine,
  policyEngine,
  telegramConfigured: notifier.isConfigured(),
});

const PORT = 3333;
const httpServer = app.listen(PORT, () => {
  console.log(`[API] AIOS Command Center API running on http://localhost:${PORT}`);
  console.log(`[API]   GET  http://localhost:${PORT}/api/health`);
  console.log(`[API]   GET  http://localhost:${PORT}/api/system/state`);
  console.log(`[API]   GET  http://localhost:${PORT}/api/projects`);
  console.log(`[API]   GET  http://localhost:${PORT}/api/agents`);
  console.log(`[API]   GET  http://localhost:${PORT}/api/events`);
  console.log(`[API]   GET  http://localhost:${PORT}/api/events/stream  (SSE)`);
  console.log(`[API]   GET  http://localhost:${PORT}/api/memory`);
  console.log(`[API]   POST http://localhost:${PORT}/api/policy/evaluate`);
  console.log(`[API] Telegram: ${notifier.isConfigured() ? "configured ✓" : "not configured"}`);
});

// ── Startup Telegram alert ────────────────────────────────────────────────────

void notifier.sendAlert(
  "AIOS Online",
  "AIOS Alpha v2.0.0 is running\nKernel: healthy\nServices: 7\nProjects monitored: 2\nAgents: Aria, Nova",
  "🚀"
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\n[API] Received ${signal}, shutting down...`);
  httpServer.close();
  await kernel.shutdown(signal);
  await prisma.$disconnect();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

// Keep the event loop alive
setInterval(() => {}, 1_000);
