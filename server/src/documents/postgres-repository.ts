import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { documentObjects, documents } from "../db/schema.js";
import type { DocumentRepository, PendingDocumentObject } from "./repository.js";

const objectSelection = {
  id: documentObjects.id,
  documentId: documentObjects.documentId,
  userId: documents.userId,
  objectKey: documentObjects.objectKey,
  sha256: documentObjects.sha256,
  byteSize: documentObjects.byteSize,
  mimeType: documentObjects.mimeType,
  status: documentObjects.status,
};

export class PostgresDocumentRepository implements DocumentRepository {
  constructor(private readonly db: Database) {}

  async findDocumentUpload(documentId: string) {
    const [record] = await this.db
      .select({ ...objectSelection, documentUserId: documents.userId })
      .from(documents)
      .innerJoin(documentObjects, eq(documentObjects.documentId, documents.id))
      .where(and(eq(documents.id, documentId), isNull(documents.deletedAt), isNull(documentObjects.deletedAt)))
      .orderBy(desc(documentObjects.version))
      .limit(1);
    return record ?? null;
  }

  async createPendingUpload(input: {
    document: {
      id: string;
      userId: string;
      title: string;
      mimeType: string;
      sourceKind: string;
      pageCount: number;
    };
    object: PendingDocumentObject;
  }) {
    await this.db.transaction(async (tx) => {
      await tx.insert(documents).values({ ...input.document, status: "pending" });
      await tx.insert(documentObjects).values({
        id: input.object.id,
        documentId: input.object.documentId,
        objectKey: input.object.objectKey,
        sha256: input.object.sha256,
        byteSize: input.object.byteSize,
        mimeType: input.object.mimeType,
        status: "pending",
      });
    });
  }

  async findOwnedObject(userId: string, documentId: string, objectId: string) {
    const [record] = await this.db
      .select(objectSelection)
      .from(documentObjects)
      .innerJoin(documents, eq(documents.id, documentObjects.documentId))
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.id, documentId),
          eq(documentObjects.id, objectId),
          isNull(documents.deletedAt),
          isNull(documentObjects.deletedAt),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  async findOwnedVerifiedObject(userId: string, documentId: string) {
    const [record] = await this.db
      .select(objectSelection)
      .from(documentObjects)
      .innerJoin(documents, eq(documents.id, documentObjects.documentId))
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.id, documentId),
          eq(documentObjects.status, "verified"),
          isNull(documents.deletedAt),
          isNull(documentObjects.deletedAt),
        ),
      )
      .orderBy(desc(documentObjects.version))
      .limit(1);
    return record ?? null;
  }

  async markVerified(documentId: string, objectId: string) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(documentObjects)
        .set({ status: "verified", verifiedAt: new Date(), failureReason: null })
        .where(and(eq(documentObjects.id, objectId), eq(documentObjects.documentId, documentId)));
      await tx
        .update(documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(documents.id, documentId));
    });
  }

  async markFailed(objectId: string, reason: string) {
    await this.db
      .update(documentObjects)
      .set({ status: "failed", failureReason: reason })
      .where(eq(documentObjects.id, objectId));
  }
}
