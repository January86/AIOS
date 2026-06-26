import { existsSync } from "fs";
import { ProjectState } from "../../../contracts/src/index.js";
import type { ProjectHealth, ProjectRecord } from "../../../contracts/src/index.js";
import { ProcessMonitor } from "./process-monitor.js";

const monitor = new ProcessMonitor();

export class HealthCheckRunner {
  // Never throws — always returns a ProjectHealth.
  async checkProjectHealth(project: ProjectRecord): Promise<ProjectHealth> {
    const now = new Date().toISOString();

    if (project.config.port !== undefined) {
      const raw = await monitor.checkProcess(project.config.id, project.config.port);
      return {
        projectId: project.config.id,
        state: raw.alive ? ProjectState.ACTIVE : ProjectState.ERROR,
        healthy: raw.alive,
        lastCheckedAt: now,
        errorMessage: raw.alive ? undefined : raw.error,
      };
    }

    // Fallback: filesystem presence check
    const exists = existsSync(project.config.path);
    return {
      projectId: project.config.id,
      state: exists ? ProjectState.ACTIVE : ProjectState.UNKNOWN,
      healthy: exists,
      lastCheckedAt: now,
      errorMessage: exists ? undefined : `Path not found: ${project.config.path}`,
    };
  }
}
