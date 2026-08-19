import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthService } from "../auth/service.js";
import { authenticatedUserId } from "../auth/guard.js";
import {
  DocumentNotFoundError,
  DocumentClaimConflictError,
  DocumentService,
  InvalidDocumentError,
  ObjectVerificationError,
  UploadNotReadyError,
} from "./service.js";

const uploadSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  sourceKind: z.string().trim().min(1).max(40),
  byteSize: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().nonnegative().default(0),
});
const objectParams = z.object({ documentId: z.string().uuid(), objectId: z.string().uuid() });
const documentParams = z.object({ documentId: z.string().uuid() });

export function registerDocumentRoutes(app: FastifyInstance, service: DocumentService, auth: AuthService) {
  app.post("/api/documents/upload-sessions", async (request, reply) => {
    const userId = await authenticatedUserId(request, reply, auth);
    if (!userId) return;
    const parsed = uploadSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "文件信息无效" });
    try {
      return reply.code(201).send(await service.createUploadSession({ userId, ...parsed.data }));
    } catch (error) {
      if (error instanceof InvalidDocumentError) {
        return reply.code(400).send({ message: "不支持的文件类型或文件过大" });
      }
      if (error instanceof DocumentClaimConflictError) {
        return reply.code(409).send({ message: "资料已属于其他账号或文件内容不一致" });
      }
      throw error;
    }
  });

  app.post("/api/documents/:documentId/objects/:objectId/commit", async (request, reply) => {
    const userId = await authenticatedUserId(request, reply, auth);
    if (!userId) return;
    const parsed = objectParams.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ message: "文件标识无效" });
    try {
      return await service.commit(userId, parsed.data.documentId, parsed.data.objectId);
    } catch (error) {
      if (error instanceof DocumentNotFoundError) return reply.code(404).send({ message: "资料不存在" });
      if (error instanceof UploadNotReadyError) return reply.code(409).send({ message: "文件尚未上传完成" });
      if (error instanceof ObjectVerificationError) return reply.code(422).send({ message: "文件校验失败" });
      throw error;
    }
  });

  app.get("/api/documents/:documentId/download", async (request, reply) => {
    const userId = await authenticatedUserId(request, reply, auth);
    if (!userId) return;
    const parsed = documentParams.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ message: "文件标识无效" });
    try {
      return await service.createDownload(userId, parsed.data.documentId);
    } catch (error) {
      if (error instanceof DocumentNotFoundError) return reply.code(404).send({ message: "资料不存在" });
      throw error;
    }
  });
}
