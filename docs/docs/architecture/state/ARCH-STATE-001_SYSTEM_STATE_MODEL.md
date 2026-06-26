---
id: ARCH-STATE-001
title: System State Model
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ADR-0011
  - ADR-0016
last_updated: 2026-06-26
---

# System State Model

## Purpose

Define shared state vocabulary for AIOS components.

## Core State Categories

### Kernel State

```text
created
booting
running
degraded
recovering
shutting_down
stopped
failed
```

### Agent State

```text
idle
thinking
working
reviewing
testing
deploying
blocked
error
offline
```

### Mission State

```text
created
planned
running
paused
blocked
completed
failed
cancelled
archived
```

### Task State

```text
created
queued
assigned
running
waiting_policy
waiting_approval
completed
failed
cancelled
retrying
```

### Project State

```text
unknown
healthy
degraded
down
recovering
maintenance
archived
```

## Rule

Pixel Office must only visualize states from this model or an approved extension.
