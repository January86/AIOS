import {
  ActionCategory,
  ProjectTier,
  RiskLevel,
  createCorrelationId,
} from "../../contracts/src/index.js";
import { InMemoryEventBus } from "../../events/src/index.js";
import { PolicyEngine } from "../../policy/src/index.js";
import { ProjectRegistry } from "../../project-runtime/src/index.js";
import { AIOSKernel } from "./kernel.js";
import { MonitoringWorker } from "./monitoring/index.js";
import { MockService } from "./services/mock-service.js";

const eventBus = new InMemoryEventBus();

const unsubscribe = eventBus.subscribe("*", (_event) => {});

const kernel = new AIOSKernel(eventBus);
const projectRegistry = new ProjectRegistry(eventBus);
const monitoringWorker = new MonitoringWorker(eventBus, projectRegistry, 5_000);
const policyEngine = new PolicyEngine(eventBus);

kernel.registerService(new MockService("event-bus"));
kernel.registerService(new MockService("configuration"));
kernel.registerService(projectRegistry);
kernel.registerService(monitoringWorker);
kernel.registerService(policyEngine);

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

// --- Kernel health ---
const health = await kernel.healthCheck();
console.log("\n[AIOS] Health Report:");
console.log(JSON.stringify(health, null, 2));

console.log("\n[AIOS] Kernel running. Press Ctrl+C to shutdown.\n");
await kernel.run();

process.exit(0);
