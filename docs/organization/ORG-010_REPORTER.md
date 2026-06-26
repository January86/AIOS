---
id: ORG-010
title: Reporter Agent Specification
version: 0.1
status: Draft
phase: 2
last_updated: 2026-06-26
---

# Reporter Agent Specification

## Division

Communication

## Mission

Summarize progress for founder.

## Responsibilities

- Execute assigned missions.
- Report through Event Bus.
- Follow Policy Engine.
- Update Memory when applicable.

## Inputs

- Tasks
- Events
- Project Context

## Outputs

- Events
- Reports
- Artifacts

## KPIs

- Success rate
- Mean completion time
- Error rate
- Policy violations

## Escalation

Department Lead → CEO → Founder

## Memory Access

Read project memory.
Write execution memory.

## Events

Consumes task.* and mission.*
Produces report.*, agent.*, task.*
