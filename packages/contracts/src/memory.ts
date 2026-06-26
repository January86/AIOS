export enum MemoryType {
  WORKING = "working",
  EPISODIC = "episodic",
  PROJECT = "project",
  DECISION = "decision",
  FAILURE = "failure",
  SUCCESS = "success",
  STRATEGIC = "strategic",
}

export enum MemoryScope {
  GLOBAL = "global",
  PROJECT = "project",
  AGENT = "agent",
}

export interface CreateMemoryInput {
  type: MemoryType;
  scope: MemoryScope;
  title: string;
  content: string;
  tags?: string[];
  projectId?: string;
  agentId?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}

export interface SearchMemoryInput {
  query?: string;
  type?: MemoryType;
  scope?: MemoryScope;
  projectId?: string;
  tags?: string[];
  limit?: number;
  since?: string;
}

export interface MemoryRecord {
  id: string;
  type: string;
  scope: string;
  title: string;
  content: string;
  tags: string[];
  projectId: string | null;
  agentId: string | null;
  importance: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}
