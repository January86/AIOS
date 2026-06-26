---
id: ARCH-EVENT-001
title: Event Bus Blueprint
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ADR-0003
  - ADR-0019
  - ADR-0011
last_updated: 2026-06-26
---

# Event Bus Blueprint

## Purpose

Define the AIOS event system as the communication backbone for agents, workflows, services, plugins, and project runtime.

## Scope

This document defines implementation-ready architecture for `Event Bus Blueprint`. It is not a final source-code implementation, but it must be specific enough for human developers or AI agents to start coding with minimal ambiguity.

## Responsibilities

The Event Bus is responsible for:

- publishing events,
- subscribing handlers,
- routing events by type,
- tracking correlation IDs,
- supporting priority,
- storing event logs,
- supporting retry,
- supporting dead-letter handling,
- supporting replay later.

## Dependencies

- ADR-0003
- ADR-0019
- ADR-0011

## Interfaces

```ts
interface EventBus {
  publish(event: AIOSEvent): Promise<void>
  subscribe(type: string, handler: EventHandler): void
  unsubscribe(type: string, handlerId: string): void
}

interface AIOSEvent {
  id: string
  type: string
  source: string
  timestamp: string
  severity: "debug" | "info" | "warning" | "error" | "critical"
  correlationId?: string
  causationId?: string
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>
}
```

## Events

Core event namespaces:

```text
kernel.*
project.*
agent.*
task.*
mission.*
workflow.*
policy.*
memory.*
plugin.*
tool.*
deploy.*
incident.*
report.*
```

Examples:

- project.down
- task.created
- workflow.failed
- policy.denied
- memory.updated
- deploy.success

## Data Model

Event table:

```sql
events(
  id text primary key,
  type text not null,
  source text not null,
  severity text not null,
  correlation_id text,
  causation_id text,
  payload jsonb not null,
  metadata jsonb,
  created_at timestamptz not null
)
```

## Suggested Folder Structure

```text
packages/events/
  src/
    event-bus.ts
    event-schema.ts
    event-store.ts
    event-router.ts
    event-handler.ts
    dead-letter-queue.ts
    event-replay.ts
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

- [ ] Define AIOSEvent schema.
- [ ] Implement publish/subscribe.
- [ ] Persist events.
- [ ] Add correlation ID support.
- [ ] Add dead letter queue.
- [ ] Add event replay placeholder.
- [ ] Add tests for event routing.


## Related ADR

- ADR-0003 Event-Driven Architecture
- ADR-0004 Plugin-First Architecture
- ADR-0008 Layered Memory
- ADR-0009 Policy-Based Autonomy
- ADR-0011 Observable by Design
- ADR-0015 Modular Everything
