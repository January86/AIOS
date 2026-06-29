import OpenAI from "openai";
import type { AgentRole } from "../../../contracts/src/index.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

const PRIMARY_MODELS: Partial<Record<AgentRole, string>> = {
  ceo: "moonshot/kimi-k2",
  developer: "openai/gpt-oss-120b",
  qa: "moonshot/kimi-k2",
  research: "openai/gpt-oss-120b",
  devops: "meta-llama/llama-3.3-70b-instruct",
  monitoring: "meta-llama/llama-3.3-70b-instruct",
  reporter: "meta-llama/llama-3.3-70b-instruct",
} as Partial<Record<AgentRole, string>>;

const FALLBACK_MODELS: Partial<Record<AgentRole, string>> = {
  ceo: "openai/gpt-oss-120b",
  developer: "deepseek/deepseek-chat-v3-0324",
  qa: "openai/gpt-oss-120b",
  research: "qwen/qwen3-32b",
  devops: "qwen/qwen3-32b",
  monitoring: "meta-llama/llama-4-scout",
  reporter: "meta-llama/llama-4-scout",
} as Partial<Record<AgentRole, string>>;

const DEFAULT_PRIMARY = "meta-llama/llama-3.3-70b-instruct";
const DEFAULT_FALLBACK = "meta-llama/llama-4-scout";

export class ModelRouter {
  private readonly client: OpenAI | null;

  constructor() {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      this.client = null;
      return;
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/January86/AIOS",
        "X-Title": "AIOS",
      },
    });
    console.log("[ModelRouter] configured ✓");
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getModelForRole(role: AgentRole): string {
    return PRIMARY_MODELS[role] ?? DEFAULT_PRIMARY;
  }

  async complete(
    role: AgentRole,
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<string> {
    if (!this.client) {
      throw new Error("[ModelRouter] OPENROUTER_API_KEY not configured");
    }

    const primaryModel = PRIMARY_MODELS[role] ?? DEFAULT_PRIMARY;
    const fallbackModel = FALLBACK_MODELS[role] ?? DEFAULT_FALLBACK;

    const allMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> =
      options?.systemPrompt
        ? [{ role: "system" as const, content: options.systemPrompt }, ...messages]
        : [...messages];

    const maxTokens = options?.maxTokens ?? 2000;
    const temperature = options?.temperature ?? 0.3;

    try {
      console.log(`[ModelRouter] ${role} using ${primaryModel}`);
      const response = await this.client.chat.completions.create({
        model: primaryModel,
        messages: allMessages,
        max_tokens: maxTokens,
        temperature,
      });
      return response.choices[0]?.message?.content ?? "";
    } catch {
      console.log(`[ModelRouter] ${role} fallback to ${fallbackModel}`);
      try {
        const response = await this.client.chat.completions.create({
          model: fallbackModel,
          messages: allMessages,
          max_tokens: maxTokens,
          temperature,
        });
        return response.choices[0]?.message?.content ?? "";
      } catch (fallbackError) {
        throw new Error(
          `[ModelRouter] Both ${primaryModel} and ${fallbackModel} failed for ${role}: ${
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          }`
        );
      }
    }
  }
}
