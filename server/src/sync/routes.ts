import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticatedUserId } from "../auth/guard.js";
import type { AuthService } from "../auth/service.js";
import { SyncDocumentNotFoundError } from "./repository.js";
import type { SyncService } from "./service.js";

const pushSchema = z.object({
  operations: z.array(z.object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
    layerId: z.string().uuid().nullable().optional(),
    type: z.string().trim().min(1).max(80),
    payload: z.unknown(),
    createdAt: z.string().datetime(),
  })).max(100),
});
const pullSchema = z.object({
  cursor: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export function registerSyncRoutes(app: FastifyInstance, service: SyncService, auth: AuthService) {
  app.post("/api/sync/push", async (request, reply) => {
    const userId = await authenticatedUserId(request, reply, auth);
    if (!userId) return;
    const parsed = pushSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "同步操作无效" });
    try {
      const operations = parsed.data.operations.map(operation => ({
        ...operation,
        createdAt: new Date(operation.createdAt),
      }));
      return { accepted: await service.push(userId, operations) };
    } catch (error) {
      if (error instanceof SyncDocumentNotFoundError) {
        return reply.code(404).send({ message: "资料不存在" });
      }
      throw error;
    }
  });

  app.get("/api/sync/pull", async (request, reply) => {
    const userId = await authenticatedUserId(request, reply, auth);
    if (!userId) return;
    const parsed = pullSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "同步游标无效" });
    return service.pull(userId, parsed.data.cursor, parsed.data.limit);
  });
}
