export interface ProcessCheckResult {
  alive: boolean;
  responseTime?: number;
  error?: string;
}

export class ProcessMonitor {
  async checkProcess(projectId: string, port?: number): Promise<ProcessCheckResult> {
    if (port === undefined) {
      return { alive: false, error: `${projectId}: no port configured` };
    }

    const url = `http://localhost:${port}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const start = Date.now();

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const responseTime = Date.now() - start;
      return { alive: res.ok, responseTime };
    } catch (err) {
      clearTimeout(timeout);
      const error = err instanceof Error ? err.message : String(err);
      return { alive: false, error };
    }
  }
}
