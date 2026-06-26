export type EventSeverity = "debug" | "info" | "warning" | "error" | "critical";

export enum EventType {
  // Kernel lifecycle
  KERNEL_BOOT_STARTED = "kernel.boot.started",
  KERNEL_BOOT_COMPLETED = "kernel.boot.completed",
  KERNEL_BOOT_FAILED = "kernel.boot.failed",
  KERNEL_SHUTDOWN_STARTED = "kernel.shutdown.started",
  KERNEL_SHUTDOWN_COMPLETED = "kernel.shutdown.completed",
  KERNEL_ERROR_OCCURRED = "kernel.error.occurred",
  KERNEL_RECOVERY_STARTED = "kernel.recovery.started",
  KERNEL_RECOVERY_COMPLETED = "kernel.recovery.completed",
  // Kernel services
  KERNEL_SERVICE_STARTED = "kernel.service.started",
  KERNEL_SERVICE_REGISTERED = "kernel.service.registered",
  KERNEL_SERVICE_UNREGISTERED = "kernel.service.unregistered",
  KERNEL_HEALTH_CHECKED = "kernel.health.checked",
  // Project
  PROJECT_CREATED = "project.created",
  PROJECT_UPDATED = "project.updated",
  PROJECT_DELETED = "project.deleted",
  PROJECT_REGISTERED = "project.registered",
  PROJECT_UNREGISTERED = "project.unregistered",
  PROJECT_HEALTH_UPDATED = "project.health.updated",
  PROJECT_STATE_CHANGED = "project.state.changed",
  // Monitoring
  MONITORING_CHECK_STARTED = "monitoring.check.started",
  MONITORING_CHECK_COMPLETED = "monitoring.check.completed",
  MONITORING_PROJECT_DOWN = "monitoring.project.down",
  MONITORING_PROJECT_RECOVERED = "monitoring.project.recovered",
  MONITORING_PROJECT_DEGRADED = "monitoring.project.degraded",
  // Agent (future)
  AGENT_SPAWNED = "agent.spawned",
  AGENT_COMPLETED = "agent.completed",
  AGENT_FAILED = "agent.failed",
  // Policy (future)
  POLICY_EVALUATED = "policy.evaluated",
  POLICY_VIOLATED = "policy.violated",
  // Memory (future)
  MEMORY_STORED = "memory.stored",
  MEMORY_RETRIEVED = "memory.retrieved",
  MEMORY_EVICTED = "memory.evicted",
}

export function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface AIOSEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  severity: EventSeverity;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}

export function createEvent<TPayload extends Record<string, unknown>>(input: {
  type: string;
  source: string;
  severity?: EventSeverity;
  payload?: TPayload;
  correlationId?: string;
  causationId?: string;
}): AIOSEvent<TPayload> {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    source: input.source,
    timestamp: new Date().toISOString(),
    severity: input.severity ?? "info",
    correlationId: input.correlationId ?? createCorrelationId(),
    causationId: input.causationId,
    payload: input.payload ?? ({} as TPayload),
  };
}
