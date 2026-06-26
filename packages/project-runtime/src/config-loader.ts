import { ProjectTier } from "../../contracts/src/index.js";
import type { ProjectConfig } from "../../contracts/src/index.js";

const VALID_TIERS = new Set<string>(Object.values(ProjectTier));

export function validateConfig(config: unknown): config is ProjectConfig {
  if (typeof config !== "object" || config === null) return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c["id"] === "string" && c["id"].length > 0 &&
    typeof c["name"] === "string" && c["name"].length > 0 &&
    typeof c["description"] === "string" &&
    typeof c["tier"] === "string" && VALID_TIERS.has(c["tier"]) &&
    typeof c["path"] === "string" && c["path"].length > 0 &&
    (c["port"] === undefined || (typeof c["port"] === "number" && c["port"] > 0)) &&
    Array.isArray(c["tags"]) && c["tags"].every((t) => typeof t === "string") &&
    typeof c["createdAt"] === "string" && c["createdAt"].length > 0 &&
    typeof c["updatedAt"] === "string" && c["updatedAt"].length > 0
  );
}

export function loadFromObject(config: ProjectConfig): ProjectConfig {
  if (!validateConfig(config)) {
    throw new Error("Invalid ProjectConfig: missing or invalid required fields");
  }
  return config;
}

export function loadFromJson(json: string): ProjectConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!validateConfig(parsed)) {
    throw new Error("Invalid ProjectConfig: missing or invalid required fields");
  }
  return parsed;
}
