import { execSync } from "child_process";
import { readFileSync } from "fs";
import type {
  BaronBalance,
  BaronBalanceHistory,
  BaronBalancePoint,
  BaronCircuitEvent,
  BaronDailyPnL,
  BaronSummary,
  BaronTodayPnL,
} from "../../../contracts/src/baron.js";

const BARON_LOG_PATH = "/opt/trading-agent-trio/logs/trio.log";

const ACCOUNT_NAMES: Record<number, string> = {
  18812: 'Akun 1',
  18813: 'Akun 2',
  18814: 'Akun 3',
  18815: 'Akun 4',
};
const CIRCUIT_STATE_PATH = "/opt/trading-agent-trio/logs/circuit_state.json";
const TRADE_HISTORY_PATH = "/opt/trading-agent-trio/logs/trade_history.json";

const BALANCE_REGEX = /✅ \[#(\d+)\] port (\d+) — Balance: ([\d.]+) (USD|USC)/;
const BALANCE_HISTORY_LINE_REGEX =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),(\d+) \[.*?\] INFO: ✅ \[#(\d+)\] port (\d+) — Balance: ([\d.]+) (USD|USC)/;
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

        const port = parseInt(portStr!, 10);
        latest.set(accountId!, {
          accountId: accountId!,
          port,
          name: ACCOUNT_NAMES[port] ?? `Akun ${port}`,
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

  parseTodayPnL(): BaronTodayPnL {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
    }).format(new Date());
    try {
      const raw = readFileSync(TRADE_HISTORY_PATH, "utf8");
      const trades = JSON.parse(raw) as unknown[];
      const bucket: Record<string, { totalProfit: number; trades: number; wins: number; losses: number }> = {};

      for (const trade of trades) {
        if (typeof trade !== "object" || trade === null) continue;
        const t = trade as Record<string, unknown>;
        if (t["status"] !== "closed") continue;
        const closedAt = t["closed_at"] as string | undefined;
        if (!closedAt || !closedAt.startsWith(today)) continue;

        const profit = Number(t["profit"] ?? 0);
        const accountId =
          (t["account"] as string | undefined) ??
          (t["account_id"] as string | undefined) ??
          (t["port"] !== undefined ? String(t["port"]) : "default");

        if (!bucket[accountId]) bucket[accountId] = { totalProfit: 0, trades: 0, wins: 0, losses: 0 };
        bucket[accountId]!.totalProfit += profit;
        bucket[accountId]!.trades += 1;
        if (profit > 0) bucket[accountId]!.wins += 1;
        else if (profit < 0) bucket[accountId]!.losses += 1;
      }

      const accounts: BaronTodayPnL["accounts"] = {};
      let totalPnL = 0;
      for (const [id, acc] of Object.entries(bucket)) {
        accounts[id] = {
          totalProfit: acc.totalProfit,
          trades: acc.trades,
          wins: acc.wins,
          losses: acc.losses,
          winRate: acc.trades > 0 ? (acc.wins / acc.trades) * 100 : 0,
        };
        totalPnL += acc.totalProfit;
      }

      return { date: today, accounts, totalPnL };
    } catch {
      return { date: today, accounts: {}, totalPnL: 0 };
    }
  }

  parseBalanceHistory(): BaronBalanceHistory[] {
    try {
      const lines = readLastLines(BARON_LOG_PATH, 2000).split("\n");
      const store = new Map<string, { port: number; readings: { timestamp: string; balance: number }[] }>();

      for (const line of lines) {
        const m = BALANCE_HISTORY_LINE_REGEX.exec(line);
        if (!m) continue;
        const [, dateTime, ms, accountId, portStr, balanceStr, currency] = m;
        const balance = parseFloat(balanceStr!);
        if (balance === 0 && currency === "USC") continue;

        if (!store.has(accountId!)) {
          store.set(accountId!, { port: parseInt(portStr!, 10), readings: [] });
        }
        const isoTs = dateTime!.replace(" ", "T") + "." + ms!.padStart(3, "0") + "+08:00";
        store.get(accountId!)!.readings.push({ timestamp: isoTs, balance });
      }

      const result: BaronBalanceHistory[] = [];
      for (const [accountId, data] of store.entries()) {
        const sampled: BaronBalancePoint[] = [];
        for (let i = 0; i < data.readings.length; i++) {
          if (i % 10 === 0) {
            sampled.push(data.readings[i]!);
            if (sampled.length >= 50) break;
          }
        }
        result.push({ accountId, port: data.port, points: sampled });
      }

      return result;
    } catch {
      return [];
    }
  }

  getTotalBalance(): number {
    return this.parseBalances().reduce((sum, a) => sum + a.balance, 0);
  }

  getSummary(): BaronSummary {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
    const emptyTodayPnL: BaronTodayPnL = { date: today, accounts: {}, totalPnL: 0 };
    try {
      return {
        totalBalance: this.getTotalBalance(),
        accounts: this.parseBalances(),
        dailyPnL: this.parseDailyPnL(),
        circuitEvents: this.parseCircuitBreaker(),
        todayPnL: this.parseTodayPnL(),
        balanceHistory: this.parseBalanceHistory(),
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return {
        totalBalance: 0,
        accounts: [],
        dailyPnL: [],
        circuitEvents: [],
        todayPnL: emptyTodayPnL,
        balanceHistory: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}
