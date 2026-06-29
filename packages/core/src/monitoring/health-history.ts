export interface HealthPoint {
  timestamp: string;
  healthy: boolean;
  responseTime?: number;
}

export class HealthHistory {
  private readonly MAX_PER_PROJECT = 48;
  private readonly store = new Map<string, HealthPoint[]>();

  record(projectId: string, healthy: boolean, responseTime?: number, timestamp?: string): void {
    if (!this.store.has(projectId)) this.store.set(projectId, []);
    const points = this.store.get(projectId)!;
    points.push({
      timestamp: timestamp ?? new Date().toISOString(),
      healthy,
      responseTime,
    });
    if (points.length > this.MAX_PER_PROJECT) points.shift();
  }

  getHistory(projectId: string): HealthPoint[] {
    return this.store.get(projectId) ?? [];
  }

  getUptimePercent(projectId: string): number {
    const points = this.getHistory(projectId);
    if (points.length === 0) return 100;
    return (points.filter((p) => p.healthy).length / points.length) * 100;
  }

  getLastIncident(projectId: string): HealthPoint | null {
    const points = this.getHistory(projectId);
    for (let i = points.length - 1; i >= 0; i--) {
      if (!points[i]!.healthy) return points[i]!;
    }
    return null;
  }

  getAverageResponseTime(projectId: string): number | null {
    const points = this.getHistory(projectId).filter((p) => p.responseTime !== undefined);
    if (points.length === 0) return null;
    return points.reduce((sum, p) => sum + p.responseTime!, 0) / points.length;
  }
}
