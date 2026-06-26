import type { ServiceState } from "./states.js";

export interface ServiceHealth {
  name: string;
  state: ServiceState;
  healthy: boolean;
  message?: string;
  checkedAt: string;
}

export interface KernelService {
  name: string;
  init(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<ServiceHealth>;
}
