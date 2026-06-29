import { MemoryScope, MemoryType } from "../../../contracts/src/index.js";
import type { AgentRuntime } from "../agents/agent-runtime.js";
import type { MemoryEngine } from "../../../memory/src/index.js";
import type { TelegramGoalListener } from "./goal-listener.js";
import type { TelegramNotifier } from "./telegram-notifier.js";

export class GoalIntake {
  constructor(
    private readonly goalListener: TelegramGoalListener,
    private readonly telegram: TelegramNotifier,
    private readonly agentRuntime: AgentRuntime,
    private readonly memoryEngine: MemoryEngine
  ) {
    // Wire callback — GoalIntake owns the processing logic
    this.goalListener.onGoal = (text: string, fromUser: string) => {
      void this.onGoalReceived(text, fromUser);
    };
  }

  async onGoalReceived(text: string, fromUser: string): Promise<void> {
    const receivedAt = new Date().toISOString();

    // Immediate acknowledgment to founder channel
    await this.telegram.sendMessage(
      `✅ Goal diterima dari ${fromUser}\n📋 ${text}\n⏳ Apex sedang memproses...`
    );

    // Log to Memory Engine
    try {
      await this.memoryEngine.remember({
        type: MemoryType.EPISODIC,
        scope: MemoryScope.GLOBAL,
        title: `Goal: ${text.slice(0, 50)}`,
        content: `Goal from ${fromUser} at ${receivedAt}: ${text}`,
        tags: ["goal", "user-input", fromUser],
        agentId: "goal-intake",
        importance: 7,
      });
    } catch (error) {
      console.error(
        "[GoalIntake] memory store failed:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Assign to Nova for acknowledgment summary
    try {
      const novaTask = {
        id: crypto.randomUUID(),
        agentId: "reporter-agent-001",
        title: `Acknowledge goal from ${fromUser}`,
        description: "Summarize received goal for founder notification",
        input: { goalText: text, fromUser, receivedAt },
        priority: "medium" as const,
        createdAt: receivedAt,
      };

      const report = await this.agentRuntime.assignTask("reporter-agent-001", novaTask);

      await this.telegram.sendMessage(`📝 Nova: ${report.summary}`);
    } catch (error) {
      console.error(
        "[GoalIntake] Nova task failed:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
