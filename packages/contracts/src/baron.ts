export interface BaronBalance {
  accountId: string;
  port: number;
  name?: string;
  balance: number;
  currency: string;
  lastSeen: string;
}

export interface BaronDailyPnL {
  accountName: string;
  type: "profit" | "loss";
  amount: number;
  triggeredAt: string;
}

export interface BaronCircuitEvent {
  type: "loss_limit" | "profit_limit";
  accountName: string;
  amount: number;
  date: string;
}

export interface BaronTodayPnLAccount {
  totalProfit: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface BaronTodayPnL {
  date: string;
  accounts: Record<string, BaronTodayPnLAccount>;
  totalPnL: number;
}

export interface BaronBalancePoint {
  timestamp: string;
  balance: number;
}

export interface BaronBalanceHistory {
  accountId: string;
  port: number;
  points: BaronBalancePoint[];
}

export interface BaronSummary {
  totalBalance: number;
  accounts: BaronBalance[];
  dailyPnL: BaronDailyPnL[];
  circuitEvents: BaronCircuitEvent[];
  todayPnL: BaronTodayPnL;
  balanceHistory: BaronBalanceHistory[];
  lastUpdated: string;
}
