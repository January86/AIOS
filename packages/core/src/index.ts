import "dotenv/config";
import {
  ActionCategory,
  MemoryScope,
  MemoryType,
  ProjectTier,
  RiskLevel,
  createCorrelationId,
} from "../../contracts/src/index.js";
import { InMemoryEventBus } from "../../events/src/index.js";
import { MemoryEngine, MemoryStore } from "../../memory/src/index.js";
import { PolicyEngine } from "../../policy/src/index.js";
import { ProjectRegistry } from "../../project-runtime/src/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { AIOSKernel } from "./kernel.js";
import { AgentRuntime } from "./agents/index.js";
import { MonitoringWorker } from "./monitoring/index.js";
import { MockService } from "./services/mock-service.js";

const eventBus = new InMemoryEventBus();

const unsubscribe = eventBus.subscribe("*", (_event) => {});

const kernel = new AIOSKernel(eventBus);
const projectRegistry = new ProjectRegistry(eventBus);
const monitoringWorker = new MonitoringWorker(eventBus, projectRegistry, 5_000);
const policyEngine = new PolicyEngine(eventBus);

const adapter = new PrismaPg(process.env["DATABASE_URL"] as string);
const prisma = new PrismaClient({ adapter });
const memoryStore = new MemoryStore(prisma);
const memoryEngine = new MemoryEngine(memoryStore, eventBus);

const agentRuntime = new AgentRuntime(eventBus, policyEngine, memoryEngine);

kernel.registerService(new MockService("event-bus"));
kernel.registerService(new MockService("configuration"));
kernel.registerService(projectRegistry);
kernel.registerService(monitoringWorker);
kernel.registerService(policyEngine);
kernel.registerService(memoryEngine);
kernel.registerService(agentRuntime);

console.log("[AIOS] Booting kernel...");
await kernel.boot();

const bootEvents = eventBus.getEvents({ limit: 5 });
const totalStored = eventBus.getEvents().length;
console.log(`\n[AIOS] First 5 of ${totalStored} stored events:`);
for (const e of bootEvents) {
  console.log(`  ${e.type} [${e.correlationId}]`);
}

unsubscribe();

// --- Project Registry ---
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

// --- Monitoring: immediate check cycle ---
console.log("\n[AIOS] Running initial health check cycle...");
await monitoringWorker.runChecks();

console.log("\n[AIOS] Project health after check:");
for (const p of projectRegistry.listProjects()) {
  const { id, name } = p.config;
  const { state, healthy, errorMessage } = p.health;
  console.log(`  ${id} | ${name} | healthy=${healthy} | state=${state}${errorMessage ? ` | ${errorMessage}` : ""}`);
}

// --- Policy Engine: 5 evaluations ---
console.log("\n[AIOS] Running policy evaluations...\n");

const requests = [
  {
    requestedBy: "monitoring-agent",
    action: "read project logs",
    category: ActionCategory.READ,
    riskLevel: RiskLevel.LOW,
    projectId: "ha-platform",
  },
  {
    requestedBy: "devops-agent",
    action: "deploy new version",
    category: ActionCategory.DEPLOY,
    riskLevel: RiskLevel.HIGH,
    projectId: "ha-platform",
  },
  {
    requestedBy: "devops-agent",
    action: "drop_database",
    category: ActionCategory.DELETE,
    riskLevel: RiskLevel.CRITICAL,
  },
  {
    requestedBy: "system",
    action: "restart service",
    category: ActionCategory.RESTART,
    riskLevel: RiskLevel.MEDIUM,
    projectId: "executive-brief",
  },
  {
    requestedBy: "unknown-agent",
    action: "kill_kernel",
    category: ActionCategory.EXECUTE,
    riskLevel: RiskLevel.CRITICAL,
  },
] as const;

for (const req of requests) {
  const decision = await policyEngine.evaluate({
    id: crypto.randomUUID(),
    ...req,
    payload: {},
    requestedAt: new Date().toISOString(),
    correlationId: createCorrelationId(),
  });
  const tag =
    decision.decision === "allow" ? "✓ ALLOW" :
    decision.decision === "deny" ? "✗ DENY " :
    "↑ ESCALATE";
  console.log(`  [${tag}] ${req.requestedBy} → ${req.action}`);
  console.log(`         reason: ${decision.reason}\n`);
}

// --- Audit log ---
const auditLog = policyEngine.getAuditLog();
console.log(`[AIOS] Audit log (${auditLog.length} entries):`);
for (const entry of auditLog) {
  const proj = entry.projectId ? ` | project=${entry.projectId}` : "";
  console.log(`  ${entry.decision.toUpperCase().padEnd(8)} | ${entry.requestedBy.padEnd(16)} | ${entry.action}${proj}`);
}

// --- Memory Engine ---
console.log("\n[AIOS] Storing memories...\n");

try {
  const demoRecords = [
    {
      type: MemoryType.FAILURE,
      scope: MemoryScope.PROJECT,
      title: "ha-platform deployment failure — port 3000 unreachable",
      content:
        "Deployment of ha-platform v2.1.0 failed. Health check on port 3000 returned no response after 3s timeout. Root cause: missing environment variable DATABASE_URL in production config.",
      tags: ["deployment", "failure", "ha-platform", "port-3000"],
      projectId: "ha-platform",
      importance: 8,
      metadata: { version: "v2.1.0", failedAt: now },
    },
    {
      type: MemoryType.DECISION,
      scope: MemoryScope.PROJECT,
      title: "AIOS architecture decision — monorepo with relative imports",
      content:
        "Decision to use a flat TypeScript monorepo with relative imports instead of npm workspaces. Rationale: zero symlink complexity, predictable resolution, simpler CI. Trade-off: no automatic dependency hoisting.",
      tags: ["architecture", "monorepo", "aios", "typescript"],
      projectId: "aios",
      importance: 9,
      metadata: { decisionDate: now, decidedBy: "kernel-team" },
    },
    {
      type: MemoryType.PROJECT,
      scope: MemoryScope.PROJECT,
      title: "executive-brief project status — active, port 3001",
      content:
        "executive-brief is an AI-curated executive news briefing service. It runs on port 3001 and is in active development. Current focus: integrating Claude API for summary generation.",
      tags: ["executive-brief", "status", "news", "claude-api"],
      projectId: "executive-brief",
      importance: 6,
      metadata: { port: 3001, tier: "standard" },
    },
    {
      type: MemoryType.STRATEGIC,
      scope: MemoryScope.GLOBAL,
      title: "AIOS development priority — kernel stability before agent spawning",
      content:
        "Strategic decision: ensure kernel runtime, event bus, project registry, monitoring, policy engine, and memory engine are all stable before implementing agent spawning (v2.x). Stability > velocity.",
      tags: ["strategy", "architecture", "priority", "roadmap"],
      importance: 10,
      metadata: { quarter: "Q2-2026", owner: "kernel-team" },
    },
  ];

  for (const record of demoRecords) {
    const existing = await memoryEngine.recall({ query: record.title, limit: 1 });
    if (existing.length === 0) {
      const stored = await memoryEngine.remember({ ...record });
      console.log(`  [STORED] ${stored.type.toUpperCase()} | ${stored.title}`);
    } else {
      console.log(`  [SKIP]   ${record.type.toUpperCase()} | ${record.title}`);
    }
  }

  // --- Memory Search ---
  console.log("\n[AIOS] Memory search — projectId='ha-platform':");
  const haPlatformMemories = await memoryEngine.recall({ projectId: "ha-platform" });
  for (const m of haPlatformMemories) {
    console.log(`  [${m.type.toUpperCase()}] importance=${m.importance} | ${m.title}`);
  }

  console.log("\n[AIOS] Memory search — tags=['architecture']:");
  const archMemories = await memoryEngine.recall({ tags: ["architecture"] });
  for (const m of archMemories) {
    console.log(`  [${m.type.toUpperCase()}] scope=${m.scope} | ${m.title}`);
  }

  const allMemories = await memoryEngine.recall({ limit: 100 });
  console.log(`\n[AIOS] Total memories stored: ${allMemories.length}`);
} catch (error) {
  console.error(
    "[AIOS] Memory engine error (non-fatal):",
    error instanceof Error ? error.message : String(error)
  );
}

// --- Agent Runtime ---
console.log("\n[AIOS] Running agent tasks...\n");

try {
  const task1Result = await agentRuntime.assignTask("monitoring-agent-001", {
    id: crypto.randomUUID(),
    agentId: "monitoring-agent-001",
    title: "Check ha-platform health",
    description: "Run health check for ha-platform project",
    input: {
      projectId: "ha-platform",
      healthy: false,
      errorMessage: "fetch failed",
      state: "error",
    },
    priority: "high",
    createdAt: new Date().toISOString(),
  });
  console.log(`  [TASK DONE] Aria → ${task1Result.summary}`);

  const task2Result = await agentRuntime.assignTask("monitoring-agent-001", {
    id: crypto.randomUUID(),
    agentId: "monitoring-agent-001",
    title: "Check executive-brief health",
    description: "Run health check for executive-brief project",
    input: {
      projectId: "executive-brief",
      healthy: false,
      errorMessage: "fetch failed",
      state: "error",
    },
    priority: "high",
    createdAt: new Date().toISOString(),
  });
  console.log(`  [TASK DONE] Aria → ${task2Result.summary}`);

  const task3Result = await agentRuntime.assignTask("reporter-agent-001", {
    id: crypto.randomUUID(),
    agentId: "reporter-agent-001",
    title: "Generate status report",
    description: "Consolidate health check results into a status report",
    input: { reports: [task1Result, task2Result] },
    priority: "medium",
    createdAt: new Date().toISOString(),
  });
  console.log(`  [TASK DONE] Nova → report generated`);

  console.log("\n[AIOS] Agent Registry:");
  for (const a of agentRuntime.listAgents()) {
    console.log(`  ${a.id} | ${a.name} | role=${a.role} | state=${a.state}`);
  }

  console.log("\n[AIOS] Nova's Status Report:");
  console.log(task3Result.summary);
} catch (error) {
  console.error(
    "[AIOS] Agent runtime error (non-fatal):",
    error instanceof Error ? error.message : String(error)
  );
}

// --- Kernel health ---
const health = await kernel.healthCheck();
console.log("\n[AIOS] Health Report:");
console.log(JSON.stringify(health, null, 2));

console.log("\n[AIOS] Kernel running. Press Ctrl+C to shutdown.\n");

process.on("exit", () => {
  prisma.$disconnect().catch(() => {});
});

await kernel.run();

process.exit(0);
