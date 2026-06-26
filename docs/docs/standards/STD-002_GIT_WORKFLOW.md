---
id: STD-002
title: AIOS Git Workflow
version: 0.1
status: Draft
phase: 0.5
owner: AIOS Chief Architect
depends_on: []
last_updated: 2026-06-26
---

# AIOS Git Workflow

## Branches

`main`  
Stable branch.

`develop`  
Active integration branch.

Feature branches:

```text
phase-1/kernel-overview
phase-1/event-bus
docs/architecture-policy-engine
```

## Commit Style

```text
phase(0.5): add bootstrap repository structure
architecture: add kernel overview
docs: update codex references
adr: add ADR-0051
chore: update templates
```

## Release Tags

- `v0.1.0` Phase -1 + Phase 0
- `v0.2.0` Phase 0.5 Bootstrap
- `v0.3.0` Phase 1 Core Architecture
- `v1.0.0` AIOS MVP

## Rule

Every major implementation decision must reference an ADR.
