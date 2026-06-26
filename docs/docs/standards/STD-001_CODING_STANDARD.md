---
id: STD-001
title: AIOS Coding Standard
version: 0.1
status: Draft
phase: 0.5
owner: AIOS Chief Architect
depends_on:
  - ADR-0011
  - ADR-0015
last_updated: 2026-06-26
---

# AIOS Coding Standard

## Principles

1. Clarity over cleverness.
2. Modular boundaries over shortcuts.
3. Explicit types over implicit assumptions.
4. Fail safely.
5. Log important decisions.
6. Never hide errors silently.
7. Prefer small composable functions.
8. Keep project-specific logic out of core.

## Naming

- Use `camelCase` for variables and functions.
- Use `PascalCase` for classes and types.
- Use `kebab-case` for filenames where practical.
- Use explicit domain names: `Mission`, `Task`, `Event`, `Policy`, `Agent`.

## Error Handling

Every error must be classified:

- recoverable,
- retryable,
- fatal,
- policy-blocked,
- external-dependency.

## Logging

Logs should include:

- timestamp,
- component,
- event type,
- correlation ID,
- severity,
- context.

## Security

- Never log secrets.
- Never store raw API keys in project files.
- Keep permissions minimal.

## AI-Specific Rule

Any autonomous action must be traceable to:

- mission,
- agent,
- event,
- policy,
- tool,
- result.
