import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export class LogReader {
  async getRecentLogs(projectPath: string, lines = 20): Promise<string[]> {
    const logPath = join(projectPath, "logs", "app.log");
    if (!existsSync(logPath)) {
      return [];
    }
    try {
      const content = await readFile(logPath, "utf-8");
      const allLines = content.split("\n").filter((l) => l.length > 0);
      return allLines.slice(-lines);
    } catch {
      return [];
    }
  }
}
