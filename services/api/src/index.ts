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
import {
  TelegramNotifier,
  TelegramGoalListener,
  GoalIntake,
} from "../../../packages/core/src/telegram/index.js";
import { ModelRouter } from "../../../packages/core/src/model-router/index.js";
import { BaronMonitor } from "../../../packages/core/src/baron/index.js";
import { DailyReporter } from "../../../packages/core/src/scheduler/index.js";
import { ProjectTier } from "../../../packages/contracts/src/index.js";
import { createServer } from "./server.js";

// ── Telegram ──────────────────────────────────────────────────────────────────

const notifier = new TelegramNotifier();

// ── Model Router ──────────────────────────────────────────────────────────────

const modelRouter = new ModelRouter();

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

const agentRuntime = new AgentRuntime(
  eventBus,
  policyEngine,
  memoryEngine,
  notifier,
  modelRouter
);
const baronMonitor = new BaronMonitor(eventBus, notifier);

kernel.registerService(new MockService("event-bus"));
kernel.registerService(new MockService("configuration"));
kernel.registerService(projectRegistry);
kernel.registerService(monitoringWorker);
kernel.registerService(policyEngine);
kernel.registerService(memoryEngine);
kernel.registerService(agentRuntime);
kernel.registerService(baronMonitor);

// ── Boot ──────────────────────────────────────────────────────────────────────

console.log("[API] Booting AIOS kernel...");
await kernel.boot();

// ── One-time memory dedup cleanup ─────────────────────────────────────────────

try {
  const deleted = await prisma.$executeRaw`
    DELETE FROM memory_records WHERE id NOT IN (
      SELECT MIN(id) FROM memory_records GROUP BY title
    )
  `;
  if (deleted > 0) console.log(`[MEMORY] cleaned up ${deleted} duplicate records`);
} catch (err) {
  console.error("[MEMORY] cleanup failed:", err instanceof Error ? err.message : String(err));
}

// ── Register projects ─────────────────────────────────────────────────────────

const now = new Date().toISOString();

projectRegistry.registerProject({
  id: "ha-platform",
  name: "Hospitality Agent Platform",
  description: "AI-powered hospitality management platform with WhatsApp integration",
  tier: ProjectTier.UPSCALE,
  path: "/home/administrator/projects/ha-platform",
  port: 3000,
  healthEndpoint: "http://157.15.40.56:3000/health",
  tags: ["production", "hospitality", "whatsapp", "ai"],
  createdAt: now,
  updatedAt: now,
});

projectRegistry.registerProject({
  id: "executive-brief",
  name: "Executive Brief (Ensiklomedia)",
  description: "AI-powered daily news briefing for government institutions in NTB",
  tier: ProjectTier.STANDARD,
  path: "/home/administrator/aios-sentinels/executive-brief",
  tags: ["production", "news", "government", "nlp"],
  createdAt: now,
  updatedAt: now,
});

projectRegistry.registerProject({
  id: "baron-trading",
  name: "Baron Trading System",
  description: "Algorithmic trading bot with LangGraph pipeline and LLM ensemble voting",
  tier: ProjectTier.ENTERPRISE,
  path: "/opt/trading-agent-trio",
  tags: ["production", "trading", "ai", "forex"],
  createdAt: now,
  updatedAt: now,
});

// ── Wire monitoring auto-trigger ──────────────────────────────────────────────

agentRuntime.subscribeToMonitoring();

// ── Daily Reporter ────────────────────────────────────────────────────────────

const dailyReporter = new DailyReporter(agentRuntime, eventBus, notifier, projectRegistry);
dailyReporter.start();

// ── Telegram Goal Listener ────────────────────────────────────────────────────

const GOAL_CHAT_ID = process.env["TELEGRAM_GOAL_CHAT_ID"] ?? "";
const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";

let goalListener: TelegramGoalListener | null = null;

if (GOAL_CHAT_ID && BOT_TOKEN) {
  try {
    goalListener = new TelegramGoalListener(BOT_TOKEN, GOAL_CHAT_ID, () => {
      // placeholder — GoalIntake overwrites this callback in its constructor
    });
    // GoalIntake wires itself to goalListener and overwrites the onGoal callback
    new GoalIntake(goalListener, notifier, agentRuntime, memoryEngine);
    goalListener.start();
    console.log(`[AIOS] Goal listener active on chat ${GOAL_CHAT_ID}`);
  } catch (error) {
    console.error(
      "[AIOS] Goal listener failed to start:",
      error instanceof Error ? error.message : String(error)
    );
  }
} else {
  console.warn("[AIOS] Goal listener not started: TELEGRAM_GOAL_CHAT_ID or TELEGRAM_BOT_TOKEN missing");
}

// ── Start Express ─────────────────────────────────────────────────────────────

const app = createServer({
  kernel,
  projectRegistry,
  agentRuntime,
  eventBus,
  memoryEngine,
  policyEngine,
  baronMonitor,
  monitoringWorker,
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
  console.log(`[API]   GET  http://localhost:${PORT}/api/baron/summary`);
  console.log(`[API]   POST http://localhost:${PORT}/api/policy/evaluate`);
  console.log(`[API] Telegram: ${notifier.isConfigured() ? "configured ✓" : "not configured"}`);
  console.log(`[API] ModelRouter: ${modelRouter.isConfigured() ? "OpenRouter ✓" : "not configured"}`);
});

// ── Startup Telegram alert ────────────────────────────────────────────────────

void notifier.sendAlert(
  "AIOS v2.4.0 Online",
  [
    "🚀 AIOS v2.4.0 online",
    "Kernel: healthy",
    "Services: 8",
    "Projects: 3",
    "Agents: Apex, Sage, Rex, Vera, Axel, Aria, Nova (7 total)",
    `Model Router: OpenRouter ${modelRouter.isConfigured() ? "✓" : "✗"}`,
    `Goal Channel: ${goalListener ? "active ✓" : "inactive"}`,
  ].join("\n"),
  "🚀"
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\n[API] Received ${signal}, shutting down...`);
  goalListener?.stop();
  dailyReporter.stop();
  httpServer.close();
  await kernel.shutdown(signal);
  await prisma.$disconnect();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

// Keep the event loop alive
setInterval(() => {}, 1_000);
