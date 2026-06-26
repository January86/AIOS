---
id: ARCH-PROJECT-001
title: Project Runtime Blueprint
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ADR-0006
  - ADR-0024
  - ADR-0036
last_updated: 2026-06-26
---

# Project Runtime Blueprint

## Purpose

Define how AIOS registers, monitors, and operates external software projects.

## Scope

This document defines implementation-ready architecture for `Project Runtime Blueprint`. It is not a final source-code implementation, but it must be specific enough for human developers or AI agents to start coding with minimal ambiguity.

## Responsibilities

The Project Runtime is responsible for:

- registering projects,
- storing project metadata,
- connecting to repos,
- checking health,
- reading logs,
- running commands,
- tracking build/test/deploy config,
- exposing project context to agents.

## Dependencies

- ADR-0006
- ADR-0024
- ADR-0036

## Interfaces

```ts
interface ProjectRuntime {
  register(project: ProjectDefinition): Promise<void>
  getProject(projectId: string): Promise<ProjectDefinition>
  checkHealth(projectId: string): Promise<ProjectHealth>
  readLogs(projectId: string, options: LogReadOptions): Promise<ProjectLog[]>
}

interface ProjectDefinition {
  id: string
  name: string
  repoUrl?: string
  localPath?: string
  stack?: string[]
  healthUrl?: string
  commands?: ProjectCommands
}
```

## Events

Project Runtime emits:

- project.registered
- project.health.checked
- project.down
- project.recovered
- project.logs.read
- project.context.updated

## Data Model

Project tables:

```sql
projects(id, name, repo_url, local_path, stack_json, health_url, risk_profile, created_at)
project_health_checks(id, project_id, status, response_time_ms, checked_at)
project_logs(id, project_id, severity, message, created_at)
```

## Suggested Folder Structure

```text
packages/project-runtime/
  src/
    project-runtime.ts
    project-definition.ts
    project-health.ts
    log-reader.ts
    command-runner.ts
    project-context.ts
adapters/
  executive-brief/
  hospitality/
  trading/
  polymarket/

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

- [ ] Define ProjectDefinition.
- [ ] Implement project registry.
- [ ] Add health check runner.
- [ ] Add log reader abstraction.
- [ ] Add command runner abstraction.
- [ ] Add first adapter placeholder.
- [ ] Add tests.


## Related ADR

- ADR-0003 Event-Driven Architecture
- ADR-0004 Plugin-First Architecture
- ADR-0008 Layered Memory
- ADR-0009 Policy-Based Autonomy
- ADR-0011 Observable by Design
- ADR-0015 Modular Everything
