import type {
  KernelService,
  ServiceHealth,
  ServiceState,
} from "../../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { TelegramNotifier } from "../telegram/index.js";
import type { BaronSummary } from "../../../contracts/src/baron.js";
import { BaronParser } from "./baron-parser.js";

export class BaronMonitor implements KernelService {
  readonly name = "baron-monitor";
  private serviceState: ServiceState = "created";
  private startedAt?: string;
  private intervalId?: ReturnType<typeof setInterval>;
  private readonly parser = new BaronParser();
  private readonly lastAlertedCircuit = new Set<string>();
  private lastAlertDate = new Date().toISOString().slice(0, 10);
  private summary: BaronSummary = {
    totalBalance: 0,
    accounts: [],
    dailyPnL: [],
    circuitEvents: [],
    lastUpdated: new Date().toISOString(),
  };

  constructor(
    private readonly eventBus: InMemoryEventBus,
    private readonly telegram: TelegramNotifier
  ) {}

  async init(): Promise<void> {
    this.serviceState = "initializing";
  }

  async start(): Promise<void> {
    this.serviceState = "running";
    this.startedAt = new Date().toISOString();
    await this.runCheck();
    this.intervalId = setInterval(() => void this.runCheck(), 60_000);
    console.log("[baron-monitor] started, polling every 60s");
  }

  async stop(): Promise<void> {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.serviceState = "stopped";
    console.log("[baron-monitor] stopped");
  }

  async health(): Promise<ServiceHealth> {
    return {
      name: this.name,
      state: this.serviceState,
      healthy: this.serviceState === "running",
      startedAt: this.startedAt,
      checkedAt: new Date().toISOString(),
    };
  }

  async runCheck(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.lastAlertDate) {
      this.lastAlertedCircuit.clear();
      this.lastAlertDate = today;
    }

    try {
      this.summary = this.parser.getSummary();
    } catch {
      return;
    }

    for (const event of this.summary.circuitEvents) {
      const key = `${event.type}-${event.accountName}-${event.date}`;
      if (this.lastAlertedCircuit.has(key)) continue;
      this.lastAlertedCircuit.add(key);
      void this.telegram.sendAlert(
        `Baron Circuit Breaker: ${event.accountName}`,
        `Daily loss limit reached\nAccount: ${event.accountName}\nLoss: $${event.amount}\nTrading halted for today`,
        "⚡"
      );
    }

    for (const pnl of this.summary.dailyPnL) {
      if (pnl.type !== "profit") continue;
      const key = `profit-${pnl.accountName}-${today}`;
      if (this.lastAlertedCircuit.has(key)) continue;
      this.lastAlertedCircuit.add(key);
      void this.telegram.sendAlert(
        `Baron Profit Target: ${pnl.accountName}`,
        `Daily profit target reached\nAccount: ${pnl.accountName}\nProfit: $${pnl.amount}\nTrading halted for today`,
        "💰"
      );
    }
  }

  getSummary(): BaronSummary {
    return this.summary;
  }

  getHealth(): ServiceHealth {
    return {
      name: this.name,
      state: this.serviceState,
      healthy: this.serviceState === "running",
      startedAt: this.startedAt,
      checkedAt: new Date().toISOString(),
    };
  }
}
