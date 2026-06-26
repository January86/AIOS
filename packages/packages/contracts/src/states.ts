export type KernelState =
  | "created"
  | "booting"
  | "running"
  | "degraded"
  | "recovering"
  | "shutting_down"
  | "stopped"
  | "failed";

export type ServiceState =
  | "created"
  | "initializing"
  | "running"
  | "degraded"
  | "failed"
  | "stopped";

export type AgentState =
  | "idle"
  | "thinking"
  | "working"
  | "reviewing"
  | "testing"
  | "deploying"
  | "blocked"
  | "error"
  | "offline";
