import type { KernelService, ServiceHealth, ServiceState } from "../../../contracts/src/index.js";

export class MockService implements KernelService {
  private state: ServiceState = "created";

  constructor(public readonly name: string) {}

  async init(): Promise<void> {
    this.state = "initializing";
  }

  async start(): Promise<void> {
    this.state = "running";
  }

  async stop(): Promise<void> {
    this.state = "stopped";
  }

  async health(): Promise<ServiceHealth> {
    return {
      name: this.name,
      state: this.state,
      healthy: this.state === "running",
      checkedAt: new Date().toISOString(),
    };
  }
}
