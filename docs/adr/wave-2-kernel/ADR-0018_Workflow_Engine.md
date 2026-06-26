---
id: ADR-0018
title: Workflow Engine
status: Accepted Draft
phase: -1
owner: AIOS Chief Architect
last_updated: 2026-06-26
---

# ADR-0018 — Workflow Engine

## Context

AIOS is designed as an autonomous engineering operating system, not a normal web application or chatbot. The system must manage many projects, agents, workflows, tools, and long-term decisions without becoming fragile or chaotic.

## Decision

Repeatable processes are implemented as workflows, not scattered agent prompts.

## Rationale

This decision keeps AIOS scalable, auditable, modular, and maintainable as the number of projects, agents, workflows, and plugins grows.

## Consequences

### Positive

- Reduces ambiguity.
- Creates shared rules.
- Supports long-term maintainability.
- Makes implementation more consistent.

### Trade-off

- Slower early implementation.
- Requires documentation discipline.
- Rejects attractive shortcuts.

## Implementation Notes

Future implementation must reference this ADR when designing related modules, workflows, policies, SDKs, or UI behavior.

This ADR may only be changed through a new superseding ADR.
