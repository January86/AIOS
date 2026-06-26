---
id: ARCH-WORKFLOW-001
title: Workflow Engine Blueprint
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ADR-0018
  - ADR-0034
  - ADR-0020
last_updated: 2026-06-26
---

# Workflow Engine Blueprint

## Purpose

Define the workflow engine that runs repeatable missions, operational procedures, recovery flows, and agent tasks.

## Scope

This document defines implementation-ready architecture for `Workflow Engine Blueprint`. It is not a final source-code implementation, but it must be specific enough for human developers or AI agents to start coding with minimal ambiguity.

## Responsibilities

The Workflow Engine is responsible for:

- defining workflow steps,
- executing steps,
- pausing/resuming workflows,
- retrying failed steps,
- compensating failed operations,
- recording workflow state,
- emitting workflow events,
- enforcing policy gates before dangerous steps.

## Dependencies

- ADR-0018
- ADR-0034
- ADR-0020

## Interfaces

```ts
interface WorkflowEngine {
  register(workflow: WorkflowDefinition): void
  start(workflowId: string, input: unknown): Promise<WorkflowRun>
  pause(runId: string): Promise<void>
  resume(runId: string): Promise<void>
  cancel(runId: string, reason: string): Promise<void>
}

interface WorkflowDefinition {
  id: string
  name: string
  version: string
  steps: WorkflowStep[]
}
```

## Events

Workflow emits:

- workflow.registered
- workflow.started
- workflow.step.started
- workflow.step.completed
- workflow.step.failed
- workflow.paused
- workflow.resumed
- workflow.completed
- workflow.failed
- workflow.cancelled

## Data Model

Workflow tables:

```sql
workflow_definitions(id, name, version, definition_json, created_at)
workflow_runs(id, workflow_id, status, input_json, output_json, started_at, ended_at)
workflow_steps(id, run_id, step_id, status, attempts, last_error, started_at, ended_at)
```

## Suggested Folder Structure

```text
packages/core/
  src/workflow/
    workflow-engine.ts
    workflow-definition.ts
    workflow-runner.ts
    workflow-step.ts
    retry-strategy.ts
    compensation.ts
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

- [ ] Define workflow schema.
- [ ] Implement workflow registry.
- [ ] Implement runner.
- [ ] Add step-level events.
- [ ] Add retry strategy.
- [ ] Add compensation placeholder.
- [ ] Persist workflow runs.
- [ ] Add tests.


## Related ADR

- ADR-0003 Event-Driven Architecture
- ADR-0004 Plugin-First Architecture
- ADR-0008 Layered Memory
- ADR-0009 Policy-Based Autonomy
- ADR-0011 Observable by Design
- ADR-0015 Modular Everything
