---
id: BOOT-002
title: AIOS Repository Structure
version: 0.1
status: Draft
phase: 0.5
owner: AIOS Chief Architect
depends_on:
  - ADR-0015
last_updated: 2026-06-26
---

# AIOS Repository Structure

## Target Structure

```text
AIOS/
├── apps/
│   ├── web/
│   └── command-center/
│
├── services/
│   ├── api/
│   ├── worker/
│   └── agent-runtime/
│
├── packages/
│   ├── core/
│   ├── events/
│   ├── policy/
│   ├── memory/
│   ├── plugins/
│   ├── project-runtime/
│   ├── model-router/
│   ├── tool-registry/
│   └── shared/
│
├── plugins/
├── workflows/
├── adapters/
├── docs/
├── scripts/
└── infra/
```

## Boundary Rules

### apps/

User-facing applications.

### services/

Long-running backend services.

### packages/

Reusable internal libraries.

### plugins/

Installable AIOS capability extensions.

### workflows/

Mission and automation workflows.

### adapters/

Connectors for existing projects.

### infra/

Local/dev/prod infrastructure configuration.

## Rule

No project-specific logic may be hardcoded inside `packages/core`.

Project-specific logic belongs in `adapters/`, `plugins/`, or project modules.
