import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { ProjectState } from "../../../contracts/src/index.js";
import type { ProjectHealth, ProjectRecord } from "../../../contracts/src/index.js";
import { ProcessMonitor } from "./process-monitor.js";

const monitor = new ProcessMonitor();

export class HealthCheckRunner {
  // Never throws — always returns a ProjectHealth.
  async checkProjectHealth(project: ProjectRecord): Promise<ProjectHealth> {
    const now = new Date().toISOString();
    const { id, healthEndpoint, port, path } = project.config;

    // 1. healthEndpoint takes priority over port-based check
    if (healthEndpoint) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const start = Date.now();
      try {
        const res = await fetch(healthEndpoint, { signal: controller.signal });
        clearTimeout(timeout);
        return {
          projectId: id,
          state: res.ok ? ProjectState.ACTIVE : ProjectState.ERROR,
          healthy: res.ok,
          lastCheckedAt: now,
          uptime: Date.now() - start,
          errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
        };
      } catch (err) {
        clearTimeout(timeout);
        const error = err instanceof Error ? err.message : String(err);
        return {
          projectId: id,
          state: ProjectState.ERROR,
          healthy: false,
          lastCheckedAt: now,
          errorMessage: error,
        };
      }
    }

    // 2. Port-based localhost check
    if (port !== undefined) {
      const raw = await monitor.checkProcess(id, port);
      return {
        projectId: id,
        state: raw.alive ? ProjectState.ACTIVE : ProjectState.ERROR,
        healthy: raw.alive,
        lastCheckedAt: now,
        errorMessage: raw.alive ? undefined : raw.error,
      };
    }

    // 3. Filesystem presence check (e.g. baron-trading: path only)
    const exists = existsSync(path);
    if (exists) {
      const logsDir = join(path, "logs");
      if (existsSync(logsDir)) {
        try {
          const files = readdirSync(logsDir).filter((f) => !f.startsWith(".")).sort();
          if (files.length > 0) {
            const latest = join(logsDir, files[files.length - 1]);
            const content = readFileSync(latest, "utf8");
            const lastLine = content.trimEnd().split("\n").at(-1);
            console.log(`[HealthCheck] ${id} last log: ${lastLine}`);
          }
        } catch {
          // non-fatal — log read failure doesn't affect health
        }
      }
    }

    return {
      projectId: id,
      state: exists ? ProjectState.ACTIVE : ProjectState.UNKNOWN,
      healthy: exists,
      lastCheckedAt: now,
      errorMessage: exists ? undefined : `Path not found: ${path}`,
    };
  }
}
