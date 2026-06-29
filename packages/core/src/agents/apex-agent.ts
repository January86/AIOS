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

export interface GoalRecord {
  goalId: string;
  text: string;
  fromUser: string;
  receivedAt: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "escalated";
  tasks: string[];
  result?: string;
}

export interface DeliberationRound {
  round: number;
  rexProposal: string;
  veraVerdict: string;
  veraFeedback: string;
}

interface TaskPlan {
  order: number;
  agent: string;
  task: string;
  description: string;
}

interface ApexDecomposeResponse {
  understanding: string;
  tasks: TaskPlan[];
  assigned_agents: string[];
  estimated_complexity: "simple" | "medium" | "complex";
  requires_approval: boolean;
  confidence: number;
}

interface ApexTiebreakerResponse {
  decision: "approve" | "modify" | "escalate";
  final_action: string;
  reasoning: string;
  modified_proposal?: string;
  escalation_message?: string;
}

const APEX_DEFINITION: AgentDefinition = {
  id: "apex-001",
  name: "Apex",
  role: AgentRole.CEO,
  department: "Executive",
  autonomyLevel: 3,
  capabilities: [
    "goal-decomposition",
    "agent-coordination",
    "tiebreaker",
    "escalation",
    "strategic-planning",
  ],
  description:
    "CEO agent. Orchestrates all agents. Decomposes goals. Tiebreaker for Rex-Vera deliberation.",
};

export class ApexAgent extends BaseAgent {
  readonly activeGoals = new Map<string, GoalRecord>();
  readonly deliberationHistory = new Map<string, DeliberationRound[]>();

  constructor(
    eventBus: InMemoryEventBus,
    policyEngine: PolicyEngine,
    memoryEngine: MemoryEngine,
    modelRouter?: ModelRouter
  ) {
    super(APEX_DEFINITION, eventBus, policyEngine, memoryEngine, modelRouter);
  }

  protected async execute(task: AgentTask): Promise<AgentReport> {
    const mode = task.input["mode"] as string | undefined;
    if (mode === "tiebreaker") return this.executeTiebreaker(task);
    if (mode === "check_progress") return this.executeCheckProgress(task);
    return this.executeDecomposeGoal(task);
  }

  private async executeDecomposeGoal(task: AgentTask): Promise<AgentReport> {
    const goalText = task.input["goalText"] as string | undefined;
    const fromUser = task.input["fromUser"] as string | undefined;
    const goalId = task.input["goalId"] as string | undefined;

    // Recall project context memories for full situational awareness
    let haMem: Awaited<ReturnType<MemoryEngine["recall"]>> = [];
    let execMem: Awaited<ReturnType<MemoryEngine["recall"]>> = [];
    let baronMem: Awaited<ReturnType<MemoryEngine["recall"]>> = [];
    try {
      [haMem, execMem, baronMem] = await Promise.all([
        this.memoryEngine.recall({
          query: "ha-platform",
          projectId: "ha-platform",
          limit: 2,
        }),
        this.memoryEngine.recall({
          query: "executive-brief",
          projectId: "executive-brief",
          limit: 2,
        }),
        this.memoryEngine.recall({
          query: "baron-trading",
          projectId: "baron-trading",
          limit: 2,
        }),
      ]);
    } catch {
      console.warn("[APEX] memory recall failed");
    }

    const memContext = [
      ...haMem.map(
        (m) => `[ha-platform] ${m.title}: ${m.content.slice(0, 100)}`
      ),
      ...execMem.map(
        (m) => `[executive-brief] ${m.title}: ${m.content.slice(0, 100)}`
      ),
      ...baronMem.map(
        (m) => `[baron-trading] ${m.title}: ${m.content.slice(0, 100)}`
      ),
    ].join("\n");

    const systemPrompt = [
      "You are Apex, the CEO agent of AIOS. You are firm, fair, responsible,",
      "and team-oriented. You have full context of all projects.",
      "Your job is to decompose goals into actionable tasks for your team.",
      "Project contexts:",
      "- ha-platform: Hospitality AI Platform, Next.js, runs on 157.15.40.56:3000",
      "- executive-brief: News briefing SaaS for government, runs on ensiklomedia.id",
      "- baron-trading: Algorithmic trading bot, FORBIDDEN from autonomous modification",
      "- aios: This system itself",
      "Blast radius rules are strictly enforced.",
      "Output valid JSON with your task decomposition.",
    ].join("\n");

    const promptParts = [
      "Decompose this goal into tasks for the agent team:",
      "",
      `Goal: ${goalText ?? task.description}`,
      `From: ${fromUser ?? "founder"}`,
      `Goal ID: ${goalId ?? task.id}`,
      "",
      "Available agents and capabilities:",
      "- Sage (research): log-analysis, pattern-recognition, root-cause-research",
      "- Rex (developer): code-analysis, fix-proposal, patch-generation",
      "- Vera (QA): proposal-audit, risk-assessment, safety-check (mandatory gate)",
      "- Axel (devops): pm2-restart, service-management, log-collection",
      "- Aria (monitoring): health-check, incident-detect",
      "- Nova (reporter): summarize, telegram-alert",
      "",
      memContext ? `Recent memory context:\n${memContext}` : null,
      "",
      "Respond ONLY with valid JSON, no markdown:",
      '{"understanding":"interpretation","tasks":[{"order":1,"agent":"Sage","task":"name","description":"what"}],"assigned_agents":["Sage"],"estimated_complexity":"simple|medium|complex","requires_approval":false,"confidence":0.0}',
    ];

    const prompt = promptParts.filter(Boolean).join("\n");
    const raw = await this.think(prompt, systemPrompt);

    let parsed: ApexDecomposeResponse | null = null;
    if (!raw.startsWith("[LLM")) {
      try {
        const cleaned = raw
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "")
          .trim();
        parsed = JSON.parse(cleaned) as ApexDecomposeResponse;
      } catch {
        console.warn(`[APEX] LLM returned non-JSON: ${raw.slice(0, 100)}`);
      }
    }

    const understanding =
      parsed?.understanding ?? `Process goal: ${goalText ?? task.description}`;
    const tasks: TaskPlan[] = parsed?.tasks ?? [
      {
        order: 1,
        agent: "Sage",
        task: "Research",
        description: "Gather context for goal",
      },
    ];
    const confidence = parsed?.confidence ?? 0.5;

    // Track goal in activeGoals
    const gid = goalId ?? task.id;
    this.activeGoals.set(gid, {
      goalId: gid,
      text: goalText ?? task.description,
      fromUser: fromUser ?? "founder",
      receivedAt: new Date().toISOString(),
      status: "in_progress",
      tasks: tasks.map((t) => t.task),
    });

    const memoryStored = await this.storeMemory({
      type: MemoryType.STRATEGIC,
      scope: MemoryScope.GLOBAL,
      title: `Apex goal: ${(goalText ?? task.description).slice(0, 60)}`,
      content: `Understanding: ${understanding}. Tasks: ${tasks.map((t) => `${t.agent}: ${t.task}`).join("; ")}`,
      tags: ["apex", "goal", "decomposition"],
      agentId: this.definition.id,
      importance: 7,
    });

    const findings = [
      `Understanding: ${understanding}`,
      `Complexity: ${parsed?.estimated_complexity ?? "unknown"}`,
      `Requires approval: ${parsed?.requires_approval ?? false}`,
      `Confidence: ${confidence}`,
      ...tasks.map((t) => `Task ${t.order}: ${t.agent} → ${t.task}`),
    ];

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Apex decomposed goal into ${tasks.length} task(s) for ${(parsed?.assigned_agents ?? ["agent team"]).join(", ")}`,
      findings,
      recommendations: tasks.map(
        (t) => `Assign to ${t.agent}: ${t.description}`
      ),
      memoryStored,
      completedAt: new Date().toISOString(),
    };
  }

  private async executeTiebreaker(task: AgentTask): Promise<AgentReport> {
    const rexProposal = task.input["rexProposal"] as string | undefined;
    const veraRejections = task.input["veraRejections"] as
      | DeliberationRound[]
      | undefined;
    const projectId = task.input["projectId"] as string | undefined;
    const goalId = task.input["goalId"] as string | undefined;

    const roundsStr = (veraRejections ?? [])
      .map(
        (r) =>
          `Round ${r.round}:\n  Rex: ${r.rexProposal}\n  Vera: ${r.veraVerdict} — ${r.veraFeedback}`
      )
      .join("\n\n");

    const systemPrompt = [
      "You are Apex. Rex and Vera have disagreed for 3 rounds.",
      "Review all proposals and rejections. Make a final decision.",
      "You may: approve Rex's last proposal, suggest a modified approach,",
      "or escalate to the founder if the situation requires it.",
      "Be firm and decisive. Output valid JSON.",
    ].join("\n");

    const prompt = [
      "Tiebreaker needed for Rex-Vera deliberation.",
      `Project: ${projectId ?? "unknown"}`,
      `Goal: ${goalId ?? "unknown"}`,
      "",
      `Rex's final proposal: ${rexProposal ?? "unknown"}`,
      "",
      "All deliberation rounds:",
      roundsStr || "No rounds provided",
      "",
      "Make a decisive final call. If escalating, provide the exact Telegram message for the founder.",
      "",
      "Respond ONLY with valid JSON, no markdown:",
      '{"decision":"approve|modify|escalate","final_action":"exact action","reasoning":"why","modified_proposal":"if modify","escalation_message":"if escalate"}',
    ].join("\n");

    const raw = await this.think(prompt, systemPrompt);

    let parsed: ApexTiebreakerResponse | null = null;
    if (!raw.startsWith("[LLM")) {
      try {
        const cleaned = raw
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```$/m, "")
          .trim();
        parsed = JSON.parse(cleaned) as ApexTiebreakerResponse;
      } catch {
        console.warn(
          `[APEX] tiebreaker LLM returned non-JSON: ${raw.slice(0, 100)}`
        );
      }
    }

    // Default to escalate when LLM unavailable (fail safe)
    const decision = parsed?.decision ?? "escalate";
    const finalAction = parsed?.final_action ?? "Escalate to founder";
    const reasoning =
      parsed?.reasoning ??
      "Unable to resolve deliberation — escalating for safety";

    // Update goal status if escalating
    if (decision === "escalate" && goalId) {
      const goal = this.activeGoals.get(goalId);
      if (goal) goal.status = "escalated";
    }

    const findings = [
      `Tiebreaker decision: ${decision.toUpperCase()}`,
      `Final action: ${finalAction}`,
      `Reasoning: ${reasoning}`,
      parsed?.modified_proposal
        ? `Modified proposal: ${parsed.modified_proposal}`
        : "",
      parsed?.escalation_message
        ? `Escalation message: ${parsed.escalation_message}`
        : "",
    ].filter(Boolean);

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Apex tiebreaker: ${decision.toUpperCase()} — ${finalAction.slice(0, 80)}`,
      findings,
      recommendations:
        decision === "escalate"
          ? [
              "Send Telegram to founder",
              "Pause goal until founder responds",
            ]
          : decision === "approve"
          ? ["Proceed to Axel for execution"]
          : ["Execute modified proposal via Axel"],
      memoryStored: false,
      completedAt: new Date().toISOString(),
    };
  }

  private async executeCheckProgress(task: AgentTask): Promise<AgentReport> {
    const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    const stale: GoalRecord[] = [];
    const active: GoalRecord[] = [];

    for (const goal of this.activeGoals.values()) {
      if (goal.status === "in_progress") {
        const age = now - new Date(goal.receivedAt).getTime();
        if (age > STALE_THRESHOLD_MS) {
          stale.push(goal);
        } else {
          active.push(goal);
        }
      }
    }

    const findings = [
      `Active goals: ${active.length}`,
      `Stale goals (30+ min no progress): ${stale.length}`,
      ...active.map((g) => `ACTIVE [${g.goalId}]: ${g.text.slice(0, 60)}`),
      ...stale.map(
        (g) =>
          `STALE [${g.goalId}]: ${g.text.slice(0, 60)} — no progress in 30+ min`
      ),
    ];

    return {
      taskId: task.id,
      agentId: this.definition.id,
      agentName: this.definition.name,
      summary: `Apex progress: ${active.length} active, ${stale.length} stale goals`,
      findings,
      recommendations:
        stale.length > 0
          ? stale.map(
              (g) => `Escalate stale goal ${g.goalId}: "${g.text.slice(0, 40)}"`
            )
          : ["All goals progressing normally"],
      memoryStored: false,
      completedAt: new Date().toISOString(),
    };
  }
}
