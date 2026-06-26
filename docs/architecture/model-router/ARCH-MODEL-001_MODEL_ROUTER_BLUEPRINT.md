---
id: ARCH-MODEL-001
title: Model Router Blueprint
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ADR-0007
  - ADR-0025
  - ADR-0043
last_updated: 2026-06-26
---

# Model Router Blueprint

## Purpose

Define how AIOS chooses AI models by task, cost, risk, reasoning depth, latency, and fallback policy.

## Scope

This document defines implementation-ready architecture for `Model Router Blueprint`. It is not a final source-code implementation, but it must be specific enough for human developers or AI agents to start coding with minimal ambiguity.

## Responsibilities

The Model Router is responsible for:

- registering model providers,
- selecting model by task,
- controlling cost,
- handling fallback,
- tracking model performance,
- preventing expensive model overuse.

## Dependencies

- ADR-0007
- ADR-0025
- ADR-0043

## Interfaces

```ts
interface ModelRouter {
  route(request: ModelRequest): Promise<ModelSelection>
}

interface ModelRequest {
  taskType: string
  riskLevel: string
  reasoningDepth: "low" | "medium" | "high"
  maxCost?: number
  latencyPreference?: "fast" | "balanced" | "quality"
}

interface ModelSelection {
  provider: string
  model: string
  reason: string
}
```

## Events

Model emits:

- model.route.requested
- model.selected
- model.fallback.used
- model.cost.exceeded
- model.provider.failed

## Data Model

Model tables:

```sql
model_providers(id, name, status, config_json)
model_usage(id, provider, model, task_type, cost, latency_ms, created_at)
```

## Suggested Folder Structure

```text
packages/model-router/
  src/
    model-router.ts
    provider-registry.ts
    model-selection.ts
    cost-policy.ts
    fallback-manager.ts
    usage-tracker.ts
```

## State / Lifecycle

Every component must expose state clearly. State changes must be evented and auditable.

Recommended common states:

```text
created
initialized
running
paused
degraded
failed
recovering
stopped
retired
```

## Failure Cases

- Dependency unavailable.
- Invalid configuration.
- Policy denies action.
- Event cannot be processed.
- Workflow stalls.
- Memory lookup fails.
- External tool fails.
- Model provider fails.

## Security Rules

- Never expose secrets in logs.
- Every tool execution must be permission checked.
- Every autonomous action must be policy evaluated.
- Sensitive actions must produce audit events.

## Testing Strategy

- Unit test interfaces.
- Integration test event flow.
- Simulate failure.
- Verify audit log.
- Verify policy enforcement.
- Verify retry and recovery behavior.

## Implementation Checklist

- [ ] Define ModelRequest.
- [ ] Define provider registry.
- [ ] Implement simple routing.
- [ ] Add fallback support.
- [ ] Track usage.
- [ ] Add tests.


## Related ADR

- ADR-0003 Event-Driven Architecture
- ADR-0004 Plugin-First Architecture
- ADR-0008 Layered Memory
- ADR-0009 Policy-Based Autonomy
- ADR-0011 Observable by Design
- ADR-0015 Modular Everything
