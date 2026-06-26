export enum KernelState {
  IDLE = "idle",
  BOOTING = "booting",
  RUNNING = "running",
  SHUTTING_DOWN = "shutting_down",
  STOPPED = "stopped",
  ERROR = "error",
}

export type ServiceState =
  | "created"
  | "initializing"
  | "running"
  | "degraded"
  | "failed"
  | "stopped";

