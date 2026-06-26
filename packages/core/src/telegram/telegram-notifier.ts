export class TelegramNotifier {
  private readonly token: string | undefined;
  private readonly chatId: string | undefined;

  constructor() {
    this.token = process.env["TELEGRAM_BOT_TOKEN"];
    this.chatId = process.env["TELEGRAM_CHAT_ID"];
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async sendMessage(text: string): Promise<boolean> {
    if (!this.token || !this.chatId) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.chatId,
            text,
            parse_mode: "HTML",
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        console.log(`[TELEGRAM] sent: ${text.slice(0, 50)}`);
        return true;
      }

      const errBody = await res.text().catch(() => res.status.toString());
      console.log(`[TELEGRAM] failed: ${errBody}`);
      return false;
    } catch (e) {
      clearTimeout(timeoutId);
      console.log(
        `[TELEGRAM] failed: ${e instanceof Error ? e.message : String(e)}`
      );
      return false;
    }
  }

  async sendAlert(
    title: string,
    body: string,
    emoji = "🔔"
  ): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const text = `${emoji} <b>${title}</b>\n\n${body}\n\n<i>AIOS • ${timestamp}</i>`;
    return this.sendMessage(text);
  }
}
