import {
  AgentRole,
  MemoryScope,
  MemoryType,
} from "../../../contracts/src/index.js";
import type {
  AgentDefinition,
  AgentReport,
  AgentTask,
} from "../../../contracts/src/index.js";
import type { InMemoryEventBus } from "../../../events/src/index.js";
import type { MemoryEngine } from "../../../memory/src/index.js";
import type { PolicyEngine } from "../../../policy/src/index.js";
import type { ModelRouter } from "../model-router/index.js";
import { BaseAgent } from "./base-agent.js";

interface SageLlmResponse {
  findings: string[];
  root_cause: string;
  confidence: number;
  recommendations: string[];
  needs_more_info: boolean;
}

const SAGE_DEFINITION: AgentDefinition = {
  id: "sage-001",
  name: "Sage",
  role: AgentRole.RESEARCH,
  department: "Research Department",
  autonomyLevel: 1,
  capabilities: [
    "log-analysis",
    "pattern-recognition",
    "root-cause-research",
    "context-gathering",
    "memory-search",
  ],
  description:
    "Gathers context, analyzes logs, identifies patterns, researches root causes",
};

export class SageAgent extends BaseAgent {
  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine,
    modelRouter?: ModelRouter
  ) {
    super(SAGE_DEFINITION, eventBus, policyEngine, memoryEngine, modelRouter);
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const projectId = task.input["projectId"] as string | undefined;
    const logContent = task.input["logContent"] as string | undefined;
    const errorMessage = task.input["errorMessage"] as string | undefined;
    const question = task.input["question"] as string | undefined;
    const context = task.input["context"] as string | undefined;

    // Step 1: Recall relevant memories
    const searchQuery = projectId ?? question ?? task.title;
    let recalled: Awaited<ReturnType<MemoryEngine["recall"]>> = [];
    try {
      recalled = await this.memoryEngine.recall({
        query: searchQuery,
        projectId,
        limit: 5,
      });
    } catch {
      console.warn("[SAGE] memory recall failed");
    }

    const recalledSummary = recalled
      .map((m) => `[${m.type}] ${m.title}: ${m.content.slice(0, 200)}`)
      .join("\n");

    // Step 2: Build research context and call think()
    const systemPrompt = [
      "You are Sage, a research agent. Your job is to gather context,",
      "analyze information, and identify root causes. Be thorough and factual.",
      "Never fabricate data. If you don't have enough information, say so clearly.",
      "Always output valid JSON.",
    ].join("\n");

    const promptParts = [
      `Task: ${task.title}`,
      `Description: ${task.description}`,
      projectId ? `Project: ${projectId}` : null,
      errorMessage ? `Error: ${errorMessage}` : null,
      logContent ? `Logs:\n${logContent.slice(0, 1000)}` : null,
      question ? `Question: ${question}` : null,
      context ? `Context: ${context}` : null,
      recalled.length > 0 ? `Recalled memories:\n${recalledSummary}` : null,
      "",
      "Respond ONLY with valid JSON, no markdown:",
      '{"findings":["key finding"],"root_cause":"most likely cause","confidence":0.0,"recommendations":["next step"],"needs_more_info":false}',
    ];

    const prompt = promptParts.filter(Boolean).join("\n");
    const raw = await this.think(prompt, systemPrompt);

    // Step 4: Parse LLM response
    let parsed: SageLlmResponse | null = null;
    if (!raw.startsWith("[LLM")) {
      try {
        const cleaned = raw
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "")
          .trim();
        parsed = JSON.parse(cleaned) as SageLlmResponse;
      } catch {
        console.warn(`[SAGE] LLM returned non-JSON: ${raw.slice(0, 100)}`);
      }
    }

    const findings: string[] = parsed?.findings ?? [
      `Task: ${task.title}`,
      errorMessage
        ? `Error observed: ${errorMessage}`
        : "No error message provided",
      "Confidence: low (LLM unavailable or parse error)",
    ];
    const recommendations: string[] =
      parsed?.recommendations ?? ["Manual investigation required"];
    const rootCause =
      parsed?.root_cause ?? "Unknown — requires manual investigation";
    const confidence = parsed?.confidence ?? 0.3;

    // Step 5: Store findings to memory
    const memoryStored = await this.storeMemory({
      type: MemoryType.EPISODIC,
      scope: projectId ? MemoryScope.PROJECT : MemoryScope.GLOBAL,
      title: `Sage research: ${task.title}`,
      content: `Root cause: ${rootCause}. Findings: ${findings.join("; ")}`,
      tags: ["research", "sage", ...(projectId ? [projectId] : [])],
      projectId,
      agentId: this.definition.id,
      importance: confidence >= 0.7 ? 7 : 5,
    });

    findings.push(`Root cause: ${rootCause}`);
    if (parsed?.needs_more_info) {
      findings.push("NOTE: More information needed for higher confidence");
    }

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Sage research complete. Root cause: ${rootCause} (confidence: ${confidence})`,
      findings,
      recommendations,
      memoryStored,
      completedAt: new Date().toISOString(),
    };
  }
}
