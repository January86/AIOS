---
id: ARCH-DATA-001
title: Core Data Contract
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ARCH-EVENT-001
  - ARCH-PROJECT-001
last_updated: 2026-06-26
---

# Core Data Contract

## Purpose

Define initial core database entities for AIOS MVP.

## Entities

```text
projects
agents
departments
missions
tasks
events
workflows
policies
policy_decisions
memories
plugins
tools
reports
health_checks
model_usage
```

## Minimum Fields

All primary entities should include:

```text
id
created_at
updated_at
status
metadata
```

## Rule

Do not store secrets in normal tables. Use secrets manager or environment-based secure storage.
