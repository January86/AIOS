import {
  AgentRole,
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

interface RexLlmResponse {
  proposed_action: string;
  action_type: string;
  risk_level: string;
  autonomy_level: number;
  reasoning: string;
  confidence: number;
  alternatives: string[];
  based_on_memory: boolean;
}

const REX_DEFINITION: AgentDefinition = {
  id: "rex-001",
  name: "Rex",
  role: AgentRole.DEVELOPER,
  department: "Development Department",
  autonomyLevel: 2,
  capabilities: [
    "code-analysis",
    "fix-proposal",
    "patch-generation",
    "dependency-check",
    "log-interpretation",
  ],
  description:
    "Analyzes code and proposes fixes. Never executes directly — proposals go to Vera for audit.",
};

export class RexAgent extends BaseAgent {
  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine,
    modelRouter?: ModelRouter
  ) {
    super(REX_DEFINITION, eventBus, policyEngine, memoryEngine, modelRouter);
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const projectId = task.input["projectId"] as string | undefined;
    const errorMessage = task.input["errorMessage"] as string | undefined;
    const logContent = task.input["logContent"] as string | undefined;
    const sageFindings = task.input["sageFindings"] as string[] | undefined;
    const context = task.input["context"] as string | undefined;
    const deliberationRound =
      (task.input["deliberationRound"] as number | undefined) ?? 0;
    const veraFeedback = task.input["vera_feedback"] as string | undefined;

    // Step 1: Recall SUCCESS and FAILURE memories for this project
    let successMemories: Awaited<ReturnType<MemoryEngine["recall"]>> = [];
    let failureMemories: Awaited<ReturnType<MemoryEngine["recall"]>> = [];
    try {
      [successMemories, failureMemories] = await Promise.all([
        this.memoryEngine.recall({
          query: projectId ?? task.title,
          type: MemoryType.SUCCESS,
          projectId,
          limit: 3,
        }),
        this.memoryEngine.recall({
          query: projectId ?? task.title,
          type: MemoryType.FAILURE,
          projectId,
          limit: 3,
        }),
      ]);
    } catch {
      console.warn("[REX] memory recall failed");
    }

    const successContext = successMemories
      .map((m) => `SUCCESS: ${m.title}: ${m.content.slice(0, 150)}`)
      .join("\n");
    const failureContext = failureMemories
      .map((m) => `FAILURE: ${m.title}: ${m.content.slice(0, 150)}`)
      .join("\n");

    const systemPrompt = [
      "You are Rex, a developer agent. Your job is to analyze problems",
      "and propose precise, safe fixes. You NEVER execute code directly.",
      "Your proposals go to Vera for audit before any action is taken.",
      "Prioritize fixes that have worked before (from memory).",
      "Always output valid JSON with your proposal.",
    ].join("\n");

    const promptParts = [
      `Task: ${task.title}`,
      `Description: ${task.description}`,
      projectId ? `Project: ${projectId}` : null,
      errorMessage ? `Error: ${errorMessage}` : null,
      logContent ? `Logs:\n${logContent.slice(0, 500)}` : null,
      sageFindings && sageFindings.length > 0
        ? `Sage findings:\n${sageFindings.join("\n")}`
        : null,
      context ? `Context: ${context}` : null,
      successContext ? `Proven successful fixes:\n${successContext}` : null,
      failureContext
        ? `Known failed approaches (avoid):\n${failureContext}`
        : null,
      deliberationRound > 0
        ? `Deliberation round: ${deliberationRound}`
        : null,
      veraFeedback && deliberationRound > 0
        ? `Vera's previous rejection:\n${veraFeedback}`
        : null,
      "",
      "Respond ONLY with valid JSON, no markdown:",
      '{"proposed_action":"exact command","action_type":"READ|WRITE|RESTART|DEPLOY|EXECUTE","risk_level":"LOW|MEDIUM|HIGH|CRITICAL","autonomy_level":1,"reasoning":"why","confidence":0.0,"alternatives":[],"based_on_memory":false}',
    ];

    const prompt = promptParts.filter(Boolean).join("\n");

    // Step 2: Call think()
    const raw = await this.think(prompt, systemPrompt);

    // Step 3: Parse LLM response
    let parsed: RexLlmResponse | null = null;
    if (!raw.startsWith("[LLM")) {
      try {
        const cleaned = raw
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "")
          .trim();
        parsed = JSON.parse(cleaned) as RexLlmResponse;
      } catch {
        console.warn(`[REX] LLM returned non-JSON: ${raw.slice(0, 100)}`);
      }
    }

    const proposedAction =
      parsed?.proposed_action ?? "Manual investigation required";
    const confidence = parsed?.confidence ?? 0.3;
    const reasoning =
      parsed?.reasoning ?? "LLM unavailable — manual review required";
    const riskLevel = parsed?.risk_level ?? "HIGH";
    const autonomyLevel = parsed?.autonomy_level ?? 1;
    const basedOnMemory =
      parsed?.based_on_memory ?? successMemories.length > 0;

    const findings = [
      `Proposed action: ${proposedAction}`,
      `Risk level: ${riskLevel}`,
      `Autonomy level: L${autonomyLevel}`,
      `Based on proven memory: ${basedOnMemory}`,
      `Reasoning: ${reasoning}`,
    ];

    const recommendations = [
      "Send to Vera for audit",
      ...(parsed?.alternatives ?? []).map((a) => `Alternative: ${a}`),
    ];

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Rex proposal: "${proposedAction}" (risk: ${riskLevel}, confidence: ${confidence})`,
      findings,
      recommendations,
      memoryStored: false,
      completedAt: new Date().toISOString(),
    };
  }
}
