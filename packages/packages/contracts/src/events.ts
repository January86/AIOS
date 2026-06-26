export type EventSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface AIOSEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  severity: EventSeverity;
  correlationId?: string;
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
    correlationId: input.correlationId,
    causationId: input.causationId,
    payload: input.payload ?? ({} as TPayload),
  };
}
