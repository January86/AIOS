---
id: ARCH-API-001
title: Internal API Contract
version: 0.1
status: Draft
phase: 1
owner: AIOS Chief Architect
depends_on:
  - ARCH-KERNEL-001
  - ARCH-EVENT-001
last_updated: 2026-06-26
---

# Internal API Contract

## Purpose

Define initial internal API surfaces for AIOS MVP.

## REST Endpoints

```text
GET    /api/health
GET    /api/projects
POST   /api/projects
GET    /api/agents
GET    /api/events
GET    /api/tasks
POST   /api/tasks
GET    /api/system/state
POST   /api/system/kill-switch
```

## Realtime

Preferred MVP transport:

```text
Server-Sent Events
GET /api/events/stream
```

Future:

```text
WebSocket
/ws
```

## Rule

All API responses must be traceable to source data or event.
