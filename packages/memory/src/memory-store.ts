import { Prisma } from "../../../generated/prisma/client.js";
import type { PrismaClient, MemoryRecord as PrismaMemoryRecord } from "../../../generated/prisma/client.js";
import type {
  CreateMemoryInput,
  MemoryRecord,
  SearchMemoryInput,
} from "../../contracts/src/index.js";
import { MemoryScope } from "../../contracts/src/index.js";

function buildScope(
  scope: MemoryScope,
  projectId?: string,
  agentId?: string
): string {
  if (scope === MemoryScope.PROJECT && projectId) return `project:${projectId}`;
  if (scope === MemoryScope.AGENT && agentId) return `agent:${agentId}`;
  return scope;
}

function toRecord(r: PrismaMemoryRecord): MemoryRecord {
  return {
    id: r.id,
    type: r.type,
    scope: r.scope,
    title: r.title,
    content: r.content,
    tags: r.tags ?? [],
    projectId: r.projectId,
    agentId: r.agentId,
    importance: r.importance,
    metadata: (r.metadata as unknown as Record<string, unknown>) ?? {},
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
  };
}

export class MemoryStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMemoryInput): Promise<MemoryRecord> {
    const data: Prisma.MemoryRecordCreateInput = {
      type: input.type,
      scope: buildScope(input.scope, input.projectId, input.agentId),
      title: input.title,
      content: input.content,
      tags: { set: input.tags ?? [] },
      projectId: input.projectId,
      agentId: input.agentId,
      importance: input.importance ?? 5,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ...(input.expiresAt && { expiresAt: new Date(input.expiresAt) }),
    };
    const record = await this.prisma.memoryRecord.create({ data });
    return toRecord(record);
  }

  async update(
    id: string,
    patch: Partial<CreateMemoryInput>
  ): Promise<MemoryRecord> {
    const data: Prisma.MemoryRecordUpdateInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.importance !== undefined) data.importance = patch.importance;
    if (patch.tags !== undefined) data.tags = { set: patch.tags };
    if (patch.metadata !== undefined)
      data.metadata = patch.metadata as Prisma.InputJsonValue;
    if (patch.expiresAt !== undefined)
      data.expiresAt = new Date(patch.expiresAt);
    const record = await this.prisma.memoryRecord.update({
      where: { id },
      data,
    });
    return toRecord(record);
  }

  async search(input: SearchMemoryInput): Promise<MemoryRecord[]> {
    const where: Prisma.MemoryRecordWhereInput = {};
    if (input.query) {
      where.OR = [
        { title: { contains: input.query, mode: "insensitive" } },
        { content: { contains: input.query, mode: "insensitive" } },
      ];
    }
    if (input.type) {
      where.type = input.type;
    }
    if (input.scope) {
      where.scope =
        input.scope === MemoryScope.GLOBAL
          ? "global"
          : { startsWith: `${input.scope}:` };
    }
    if (input.projectId) {
      where.projectId = input.projectId;
    }
    if (input.tags?.length) {
      where.tags = { hasSome: input.tags };
    }
    if (input.since) {
      where.createdAt = { gte: new Date(input.since) };
    }
    const results = await this.prisma.memoryRecord.findMany({
      where,
      take: input.limit ?? 20,
      orderBy: { createdAt: "desc" },
    });
    return results.map(toRecord);
  }

  async getById(id: string): Promise<MemoryRecord | null> {
    const record = await this.prisma.memoryRecord.findUnique({ where: { id } });
    return record ? toRecord(record) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.memoryRecord.delete({ where: { id } });
  }

  async expire(): Promise<number> {
    const result = await this.prisma.memoryRecord.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
