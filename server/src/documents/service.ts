import { randomUUID } from "node:crypto";

import type { ObjectStore } from "../storage/object-store.js";
import type { DocumentRepository } from "./repository.js";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class InvalidDocumentError extends Error {}
export class DocumentNotFoundError extends Error {}
export class DocumentClaimConflictError extends Error {}
export class UploadNotReadyError extends Error {}
export class ObjectVerificationError extends Error {}

export class DocumentService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly objectStore: ObjectStore,
  ) {}

  async createUploadSession(input: {
    userId: string;
    documentId: string;
    title: string;
    mimeType: string;
    sourceKind: string;
    byteSize: number;
    sha256: string;
    pageCount: number;
  }) {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType) || input.byteSize < 1 || input.byteSize > MAX_FILE_SIZE) {
      throw new InvalidDocumentError();
    }

    const existing = await this.repository.findDocumentUpload(input.documentId);
    if (existing) {
      const sameFile = existing.sha256 === input.sha256 &&
        existing.byteSize === input.byteSize && existing.mimeType === input.mimeType;
      if (existing.documentUserId !== input.userId || !sameFile) throw new DocumentClaimConflictError();
      if (existing.status === "verified") return { objectId: existing.id, status: "verified" as const };
      const signed = await this.objectStore.createUploadUrl({
        objectKey: existing.objectKey,
        mimeType: existing.mimeType,
        sha256: existing.sha256,
      });
      return { objectId: existing.id, status: "pending" as const, ...signed };
    }

    const objectId = randomUUID();
    const objectKey = `${input.userId}/${input.documentId}/${objectId}`;
    await this.repository.createPendingUpload({
      document: {
        id: input.documentId,
        userId: input.userId,
        title: input.title,
        mimeType: input.mimeType,
        sourceKind: input.sourceKind,
        pageCount: input.pageCount,
      },
      object: {
        id: objectId,
        documentId: input.documentId,
        userId: input.userId,
        objectKey,
        sha256: input.sha256,
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        status: "pending",
      },
    });
    const signed = await this.objectStore.createUploadUrl({
      objectKey,
      mimeType: input.mimeType,
      sha256: input.sha256,
    });
    return { objectId, status: "pending" as const, ...signed };
  }

  async commit(userId: string, documentId: string, objectId: string) {
    const record = await this.repository.findOwnedObject(userId, documentId, objectId);
    if (!record) throw new DocumentNotFoundError();
    if (record.status === "verified") return { status: "verified" };

    const stored = await this.objectStore.inspectObject(record.objectKey);
    if (!stored) throw new UploadNotReadyError();
    if (
      stored.byteSize !== record.byteSize ||
      stored.sha256 !== record.sha256 ||
      stored.computedSha256 !== record.sha256 ||
      stored.mimeType !== record.mimeType
    ) {
      await this.repository.markFailed(objectId, "object_metadata_mismatch");
      throw new ObjectVerificationError();
    }

    await this.repository.markVerified(documentId, objectId);
    return { status: "verified" };
  }

  async createDownload(userId: string, documentId: string) {
    const record = await this.repository.findOwnedVerifiedObject(userId, documentId);
    if (!record) throw new DocumentNotFoundError();
    return { downloadUrl: await this.objectStore.createDownloadUrl(record.objectKey) };
  }
}
