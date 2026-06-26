---
id: ROADMAP-MASTER-001
title: AIOS Master Execution Plan
version: 1.0
status: Locked
phase: planning-lock
owner: AIOS Chief Architect
last_updated: 2026-06-26
---

# AIOS Master Execution Plan

## Status

This document locks the official AIOS execution roadmap.

After this document is committed, roadmap changes require a new ADR.

## Decision

AIOS will move from documentation phase to implementation phase.

No more major roadmap restructuring unless supported by a formal ADR.

## Current Completed Milestones

- v0.1.0 — Foundation + ADR
- v0.2.0 — Bootstrap Repository
- v0.3.0 — Core Architecture
- v0.4.0 — Organization & Execution Model
- v0.5.0 — SDK Layer
- v0.6.0 — Autonomous DevOps Runtime
- v0.7.0 — Pixel Command Center Runtime
- v0.8.0 — AI Software Factory
- v0.9.0 — Self Evolution Engine
- v1.0.0 — AIOS MVP Foundation

## Final Locked Roadmap

### v1.1.0 — Core Runtime Skeleton

Goal:
Create runnable AIOS skeleton.

Deliverables:
- TypeScript workspace stabilization
- Core contracts
- Shared types
- Event types
- State definitions
- Kernel skeleton
- Basic boot command
- Console output proving AIOS can start

Definition of Done:
`npm install` and `npm run dev` should start AIOS skeleton.

---

### v1.2.0 — Kernel Runtime

Goal:
Implement lifecycle management.

Deliverables:
- Kernel boot
- Kernel shutdown
- Kernel service registry
- Kernel health
- Kernel recovery state
- Kernel lifecycle events

Definition of Done:
AIOS kernel can boot, register services, report health, and shutdown safely.

---

### v1.3.0 — Event Bus

Goal:
Create event-driven backbone.

Deliverables:
- Event schema
- Event publisher
- Event subscriber
- Event store placeholder
- Correlation ID
- Event log output

Definition of Done:
Components can publish and subscribe to AIOS events.

---

### v1.4.0 — Project Registry

Goal:
Register and manage projects.

Deliverables:
- Project model
- Project registry service
- Project config loader
- Project health metadata
- CLI/API placeholder

Definition of Done:
AIOS can register at least one project.

---

### v1.5.0 — Monitoring Worker

Goal:
Monitor registered projects.

Deliverables:
- Health check runner
- Basic process status abstraction
- Log reader placeholder
- Project down event
- Project recovered event

Definition of Done:
AIOS can detect a simulated project health failure.

---

### v1.6.0 — Policy Engine

Goal:
Control autonomy.

Deliverables:
- Policy request
- Policy decision
- Risk level
- Allow/deny/escalate
- Restricted action list
- Audit event

Definition of Done:
AIOS can block a high-risk simulated action.

---

### v1.7.0 — Memory Engine

Goal:
Store structured memory.

Deliverables:
- Memory record
- Memory store
- Project memory
- Decision memory
- Failure memory
- Search placeholder

Definition of Done:
AIOS can store and retrieve memory records.

---

### v1.8.0 — Agent Runtime

Goal:
Run simple agent loop.

Deliverables:
- Agent definition
- Agent state
- Agent task assignment
- Agent event emission
- Report output

Definition of Done:
A simple Monitoring Agent can receive a task and produce a report.

---

### v1.9.0 — Command Center UI

Goal:
Create first UI.

Deliverables:
- Web dashboard shell
- Project list
- Event feed
- Agent state list
- Pixel Office placeholder

Definition of Done:
Browser shows AIOS state from backend/mock API.

---

### v2.0.0 — AIOS Alpha

Goal:
First usable private alpha.

Deliverables:
- Project registry
- Monitoring worker
- Event bus
- Policy engine
- Memory engine
- Basic agent runtime
- Basic command center
- Telegram report placeholder

Definition of Done:
AIOS can monitor one real/local project and report status.

## Rules From This Point Forward

1. No roadmap rewrite without ADR.
2. Every version must contain real implementation or implementation-ready contracts.
3. Documentation supports code, not replaces code.
4. Pixel Office must not block backend progress.
5. Full autonomy is not allowed before Policy Engine and Rollback exist.
6. Every version must have a clear Definition of Done.
7. Tags must point to unique commits.
8. Commit history must remain clean.

## Immediate Next Commit

Commit this document as roadmap lock.

Commit message:

```text
roadmap: lock AIOS implementation plan
```

Tag:

```text
v1.0.1
```

Tag message:

```text
AIOS roadmap lock before implementation cycle
```

## Next Work After This Commit

Start v1.1.0 — Core Runtime Skeleton.
