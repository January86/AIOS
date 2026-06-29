export interface BaronBalance {
  accountId: string;
  port: number;
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

export interface BaronSummary {
  totalBalance: number;
  accounts: BaronBalance[];
  dailyPnL: BaronDailyPnL[];
  circuitEvents: BaronCircuitEvent[];
  lastUpdated: string;
}
