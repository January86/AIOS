import { execSync } from "child_process";
import { readFileSync } from "fs";
import type {
  BaronBalance,
  BaronCircuitEvent,
  BaronDailyPnL,
  BaronSummary,
} from "../../../contracts/src/baron.js";

const BARON_LOG_PATH = "/opt/trading-agent-trio/logs/trio.log";
const CIRCUIT_STATE_PATH = "/opt/trading-agent-trio/logs/circuit_state.json";

const BALANCE_REGEX = /✅ \[#(\d+)\] port (\d+) — Balance: ([\d.]+) (USD|USC)/;
const PNL_REGEX = /🛑 (\w+) DAILY (PROFIT|LOSS) LIMIT: \$([\d.-]+)/;

function readLastLines(path: string, n: number): string {
  try {
    return execSync(`tail -n ${n} ${path}`).toString("utf8");
  } catch {
    return "";
  }
}

export class BaronParser {
  parseBalances(): BaronBalance[] {
    try {
      const lines = readLastLines(BARON_LOG_PATH, 500).split("\n");
      const latest = new Map<string, BaronBalance>();

      for (const line of lines) {
        const m = BALANCE_REGEX.exec(line);
        if (!m) continue;
        const [, accountId, portStr, balanceStr, currency] = m;
        const balance = parseFloat(balanceStr!);

        if (balance === 0 && currency === "USC") continue;

        latest.set(accountId!, {
          accountId: accountId!,
          port: parseInt(portStr!, 10),
          balance,
          currency: currency!,
          lastSeen: new Date().toISOString(),
        });
      }

      return [...latest.values()];
    } catch {
      return [];
    }
  }

  parseDailyPnL(): BaronDailyPnL[] {
    try {
      const lines = readLastLines(BARON_LOG_PATH, 500).split("\n");
      const results: BaronDailyPnL[] = [];

      for (const line of lines) {
        const m = PNL_REGEX.exec(line);
        if (!m) continue;
        const [, accountName, typeStr, amountStr] = m;
        results.push({
          accountName: accountName!,
          type: typeStr === "PROFIT" ? "profit" : "loss",
          amount: parseFloat(amountStr!),
          triggeredAt: new Date().toISOString(),
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  parseCircuitBreaker(): BaronCircuitEvent[] {
    const events: BaronCircuitEvent[] = [];

    try {
      const lines = readLastLines(BARON_LOG_PATH, 200).split("\n");
      for (const line of lines) {
        if (!line.includes("DAILY LOSS LIMIT")) continue;
        const m = PNL_REGEX.exec(line);
        if (!m) continue;
        const [, accountName, , amountStr] = m;
        events.push({
          type: "loss_limit",
          accountName: accountName!,
          amount: parseFloat(amountStr!),
          date: new Date().toISOString().slice(0, 10),
        });
      }
    } catch {
      // log unreadable — return what we have
    }

    try {
      const raw = readFileSync(CIRCUIT_STATE_PATH, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item !== "object" || item === null) continue;
          const s = item as Record<string, unknown>;
          events.push({
            type: (s["type"] as "loss_limit" | "profit_limit") ?? "loss_limit",
            accountName: (s["accountName"] as string) ?? "unknown",
            amount: Number(s["amount"] ?? 0),
            date: (s["date"] as string) ?? new Date().toISOString().slice(0, 10),
          });
        }
      }
    } catch {
      // circuit_state.json missing or malformed — ignore
    }

    return events;
  }

  getTotalBalance(): number {
    return this.parseBalances().reduce((sum, a) => sum + a.balance, 0);
  }

  getSummary(): BaronSummary {
    try {
      return {
        totalBalance: this.getTotalBalance(),
        accounts: this.parseBalances(),
        dailyPnL: this.parseDailyPnL(),
        circuitEvents: this.parseCircuitBreaker(),
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return {
        totalBalance: 0,
        accounts: [],
        dailyPnL: [],
        circuitEvents: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}
