import { schedule } from "node-cron";
import type { ScheduledTask } from "node-cron";
import type { AgentRuntime } from "../agents/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { TelegramNotifier } from "../telegram/index.js";
import type { ProjectRegistry } from "../../../project-runtime/src/index.js";

export class DailyReporter {
  private task: ScheduledTask | null = null;

  constructor(
    private readonly agentRuntime: AgentRuntime,
    private readonly eventBus: InMemoryEventBus,
    private readonly telegram: TelegramNotifier,
    private readonly projectRegistry: ProjectRegistry
  ) {}

  start(): void {
    this.task = schedule(
      "0 7 * * *",
      () => {
        void this.runDailyReport();
      },
      { timezone: "Asia/Makassar" }
    );
    console.log("[daily-reporter] scheduled at 07:00 WITA (Asia/Makassar)");
  }

  stop(): void {
    this.task?.destroy();
    this.task = null;
    console.log("[daily-reporter] stopped");
  }

  async runDailyReport(): Promise<void> {
    console.log("[daily-reporter] running daily report...");

    const projects = this.projectRegistry.listProjects().map((p) => ({
      id: p.config.id,
      name: p.config.name,
      tier: p.config.tier,
      health: p.health.state,
      healthy: p.health.healthy,
      errorMessage: p.health.errorMessage,
      lastCheckedAt: p.health.lastCheckedAt,
    }));

    try {
      await this.agentRuntime.assignTask("reporter-agent-001", {
        id: crypto.randomUUID(),
        agentId: "reporter-agent-001",
        title: "Generate daily status report",
        description: "Scheduled daily status report for all projects",
        input: {
          projects,
          scheduledAt: new Date().toISOString(),
          reportType: "daily",
        },
        priority: "medium",
        createdAt: new Date().toISOString(),
      });
      console.log("[daily-reporter] daily report dispatched to Nova");
    } catch (e) {
      console.error(
        "[daily-reporter] failed:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}
