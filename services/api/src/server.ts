import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { AIOSKernel } from "../../../packages/core/src/kernel.js";
import type { AgentRuntime } from "../../../packages/core/src/agents/index.js";
import type { InMemoryEventBus } from "../../../packages/events/src/index.js";
import type { MemoryEngine } from "../../../packages/memory/src/index.js";
import type { PolicyEngine } from "../../../packages/policy/src/index.js";
import type { ProjectRegistry } from "../../../packages/project-runtime/src/index.js";
import type { BaronMonitor } from "../../../packages/core/src/baron/index.js";
import type { MonitoringWorker } from "../../../packages/core/src/monitoring/index.js";
import { EventType } from "../../../packages/contracts/src/index.js";
import type {
  ActionCategory,
  RiskLevel,
} from "../../../packages/contracts/src/index.js";

interface Deps {
  kernel: AIOSKernel;
  projectRegistry: ProjectRegistry;
  agentRuntime: AgentRuntime;
  eventBus: InMemoryEventBus;
  memoryEngine: MemoryEngine;
  policyEngine: PolicyEngine;
  baronMonitor: BaronMonitor;
  monitoringWorker: MonitoringWorker;
  telegramConfigured: boolean;
}

function makeMeta() {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: "api" as const,
  };
}

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ ok: true, data, error: null, meta: makeMeta() });
}

function fail(res: Response, message: string, status = 500) {
  res.status(status).json({ ok: false, data: null, error: message, meta: makeMeta() });
}

export function createServer(deps: Deps): express.Express {
  const { kernel, projectRegistry, agentRuntime, eventBus, memoryEngine, policyEngine, baronMonitor, monitoringWorker, telegramConfigured } = deps;
  const app = express();

  app.use(cors());
  app.use(express.json());

  // GET /api/health
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      const health = await kernel.healthCheck();
      ok(res, { ...health, telegram_configured: telegramConfigured });
    } catch (e) {
      fail(res, e instanceof Error ? e.message : String(e));
    }
  });

  // GET /api/system/state
  app.get("/api/system/state", async (_req: Request, res: Response) => {
    try {
      const health = await kernel.healthCheck();
      ok(res, {
        kernel: health,
        projects: projectRegistry.listProjects(),
        agents: agentRuntime.listAgents(),
        recentEvents: eventBus.getEvents({ limit: 20 }).reverse(),
        baron: baronMonitor.getSummary(),
      });
    } catch (e) {
      fail(res, e instanceof Error ? e.message : String(e));
    }
  });

  // GET /api/projects
  app.get("/api/projects", (_req: Request, res: Response) => {
    ok(res, projectRegistry.listProjects());
  });

  // GET /api/projects/:id/health
  app.get("/api/projects/:id/health", (req: Request, res: Response) => {
    const project = projectRegistry.getProject(req.params["id"] ?? "");
    if (!project) {
      fail(res, `Project not found: ${req.params["id"]}`, 404);
      return;
    }
    ok(res, project.health);
  });

  // GET /api/agents
  app.get("/api/agents", (_req: Request, res: Response) => {
    ok(res, agentRuntime.listAgents());
  });

  // GET /api/events
  app.get("/api/events", (req: Request, res: Response) => {
    const type = req.query["type"] as EventType | undefined;
    const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 50;
    const since = req.query["since"] as string | undefined;
    ok(res, eventBus.getEvents({ type, limit, since }).reverse());
  });

  // GET /api/events/stream  (SSE)
  app.get("/api/events/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const unsub = eventBus.subscribe("*", (event) => {
      send(event);
    });

    const heartbeat = setInterval(() => {
      send({ type: "heartbeat", timestamp: new Date().toISOString() });
    }, 15_000);

    req.on("close", () => {
      unsub();
      clearInterval(heartbeat);
    });
  });

  // GET /api/memory
  app.get("/api/memory", async (req: Request, res: Response) => {
    try {
      const projectId = req.query["projectId"] as string | undefined;
      const type = req.query["type"] as string | undefined;
      const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 20;
      const memories = await memoryEngine.recall({
        projectId,
        type: type as never,
        limit,
      });
      ok(res, memories);
    } catch (e) {
      fail(res, e instanceof Error ? e.message : String(e));
    }
  });

  // GET /api/projects/:id/history
  app.get("/api/projects/:id/history", (req: Request, res: Response) => {
    const projectId = req.params["id"] ?? "";
    const project = projectRegistry.getProject(projectId);
    if (!project) {
      fail(res, `Project not found: ${projectId}`, 404);
      return;
    }
    const hh = monitoringWorker.healthHistory;
    ok(res, {
      history: hh.getHistory(projectId),
      uptimePercent: hh.getUptimePercent(projectId),
      lastIncident: hh.getLastIncident(projectId),
      avgResponseTime: hh.getAverageResponseTime(projectId),
    });
  });

  // GET /api/baron/summary
  app.get("/api/baron/summary", (_req: Request, res: Response) => {
    try {
      ok(res, baronMonitor.getSummary());
    } catch (e) {
      fail(res, e instanceof Error ? e.message : String(e));
    }
  });

  // GET /api/sentinel/:projectId/status
  app.get("/api/sentinel/:projectId/status", (req: Request, res: Response) => {
    const projectId = req.params["projectId"] ?? "";
    const sentinelDir = "/home/administrator/aios-sentinels";
    const heartbeatFile = join(sentinelDir, projectId, "heartbeat");
    if (!existsSync(heartbeatFile)) {
      fail(res, `Sentinel not found for project: ${projectId}`, 404);
      return;
    }
    try {
      const content = readFileSync(heartbeatFile, "utf8").trim();
      const lastHeartbeat = new Date(content).toISOString();
      const ageMs = Date.now() - new Date(content).getTime();
      const ageMins = Math.floor(ageMs / 60000);
      ok(res, { projectId, lastHeartbeat, ageMs, ageMins, stale: ageMs > 600000 });
    } catch (e) {
      fail(res, e instanceof Error ? e.message : String(e));
    }
  });

  // POST /api/policy/evaluate
  app.post("/api/policy/evaluate", async (req: Request, res: Response) => {
    try {
      const { action, category, riskLevel, requestedBy, projectId } = req.body as {
        action: string;
        category: ActionCategory;
        riskLevel: RiskLevel;
        requestedBy: string;
        projectId?: string;
      };
      if (!action || !category || !riskLevel || !requestedBy) {
        fail(res, "Missing required fields: action, category, riskLevel, requestedBy", 400);
        return;
      }
      const decision = await policyEngine.evaluate({
        id: crypto.randomUUID(),
        action,
        category,
        riskLevel,
        requestedBy,
        projectId,
        payload: {},
        requestedAt: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
      });
      ok(res, decision);
    } catch (e) {
      fail(res, e instanceof Error ? e.message : String(e));
    }
  });

  return app;
}
