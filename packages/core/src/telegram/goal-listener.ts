interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      username?: string;
      first_name?: string;
    };
    chat: { id: number };
    text?: string;
  };
}

interface GetUpdatesResponse {
  ok: boolean;
  result: TelegramUpdate[];
}

export class TelegramGoalListener {
  private offset = 0;
  private running = false;
  private readonly goalChatId: string;
  onGoal: (goalText: string, fromUser: string) => void;

  constructor(
    private readonly botToken: string,
    goalChatId: string,
    onGoal: (goalText: string, fromUser: string) => void
  ) {
    this.goalChatId = goalChatId;
    this.onGoal = onGoal;
  }

  start(): void {
    this.running = true;
    void this.poll();
  }

  stop(): void {
    this.running = false;
  }

  private async poll(): Promise<void> {
    let quietTicks = 0;

    while (this.running) {
      try {
        const url =
          `https://api.telegram.org/bot${this.botToken}/getUpdates` +
          `?offset=${this.offset}&timeout=30`;

        const res = await fetch(url, { signal: AbortSignal.timeout(35_000) });

        if (!res.ok) {
          console.error(`[GoalListener] HTTP ${res.status} from Telegram`);
          await this.sleep(5_000);
          continue;
        }

        const data = (await res.json()) as GetUpdatesResponse;

        if (!data.ok || data.result.length === 0) {
          quietTicks++;
          if (quietTicks % 2 === 0) {
            console.log("[GoalListener] polling...");
          }
          continue;
        }

        quietTicks = 0;

        for (const update of data.result) {
          this.offset = update.update_id + 1;
          this.processUpdate(update);
        }
      } catch (error) {
        console.error(
          "[GoalListener] poll error:",
          error instanceof Error ? error.message : String(error)
        );
        await this.sleep(5_000);
      }
    }
  }

  private processUpdate(update: TelegramUpdate): void {
    const msg = update.message;
    if (!msg) return;
    if (!msg.text) return;
    if (msg.from?.is_bot) return;
    if (String(msg.chat.id) !== this.goalChatId) return;

    const username =
      msg.from?.username ?? msg.from?.first_name ?? String(msg.from?.id ?? "unknown");
    const text = msg.text.trim();

    if (!text) return;

    console.log(`[GoalListener] received goal from ${username}: "${text.slice(0, 80)}"`);
    this.onGoal(text, username);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
