---
id: FOUND-008
title: AIOS SAD v1
version: 0.1
status: Draft
phase: 0
owner: AIOS Chief Architect
depends_on: [FOUND-007]
---

# AIOS SAD v1

## Proposed Stack

Frontend:
- Next.js
- React
- Tailwind
- PixiJS

Backend:
- Node.js/NestJS or Next.js API for MVP
- Python optional for agent runtime

Database:
- PostgreSQL
- Prisma

Queue:
- Redis
- BullMQ

Agent Framework:
- LangGraph or OpenAI Agents SDK

Notification:
- Telegram Bot

## Architecture

Founder → Command Center → API Backend → Event Bus → Workflow Engine → Agent Runtime → Policy/Memory/Project Runtime.
