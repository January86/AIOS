---
id: ARCH-MEMORY-001
title: Memory Engine Blueprint
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ADR-0008
  - ADR-0021
last_updated: 2026-06-26
---

# Memory Engine Blueprint

## Purpose

Define layered memory storage and retrieval for AIOS, enabling long-term learning without relying on raw chat history.

## Scope

This document defines implementation-ready architecture for `Memory Engine Blueprint`. It is not a final source-code implementation, but it must be specific enough for human developers or AI agents to start coding with minimal ambiguity.

## Responsibilities

The Memory Engine is responsible for:

- storing working memory,
- storing episodic memory,
- storing project memory,
- storing company memory,
- storing decision/failure/success memory,
- retrieving relevant memory,
- compressing old memory,
- enforcing retention rules.

## Dependencies

- ADR-0008
- ADR-0021

## Interfaces

```ts
interface MemoryEngine {
  store(memory: MemoryRecord): Promise<void>
  search(query: MemoryQuery): Promise<MemoryRecord[]>
  getById(id: string): Promise<MemoryRecord | null>
  compress(scope: MemoryScope): Promise<void>
}

interface MemoryRecord {
  id: string
  type: MemoryType
  scope: string
  title: string
  content: string
  metadata?: Record<string, unknown>
}
```

## Events

Memory emits:

- memory.created
- memory.updated
- memory.compressed
- memory.deleted
- memory.retrieved
- memory.search.completed

## Data Model

Memory tables:

```sql
memories(id, type, scope, title, content, metadata, created_at, updated_at)
memory_links(id, source_memory_id, target_memory_id, relation_type)
```

## Suggested Folder Structure

```text
packages/memory/
  src/
    memory-engine.ts
    memory-record.ts
    memory-query.ts
    memory-store.ts
    memory-compression.ts
    memory-retention.ts
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

- [ ] Define MemoryRecord.
- [ ] Implement basic store/search.
- [ ] Add memory types.
- [ ] Add project-scoped memory.
- [ ] Add decision memory.
- [ ] Add compression placeholder.
- [ ] Add tests.


## Related ADR

- ADR-0003 Event-Driven Architecture
- ADR-0004 Plugin-First Architecture
- ADR-0008 Layered Memory
- ADR-0009 Policy-Based Autonomy
- ADR-0011 Observable by Design
- ADR-0015 Modular Everything
