import { and, asc, eq, gt, inArray } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { annotationOps, documents } from "../db/schema.js";
import {
  SyncDocumentNotFoundError,
  type SyncOperationInput,
  type SyncRepository,
} from "./repository.js";

export class PostgresSyncRepository implements SyncRepository {
  constructor(private readonly db: Database) {}

  async push(userId: string, operations: SyncOperationInput[]) {
    const documentIds = [...new Set(operations.map(operation => operation.documentId))];
    const owned = documentIds.length
      ? await this.db
          .select({ id: documents.id })
          .from(documents)
          .where(and(eq(documents.userId, userId), inArray(documents.id, documentIds)))
      : [];
    if (owned.length !== documentIds.length) throw new SyncDocumentNotFoundError();

    return this.db.transaction(async (tx) => {
      const accepted: Array<{ operationId: string; sequence: number }> = [];
      for (const operation of operations) {
        const inserted = await tx
          .insert(annotationOps)
          .values({
            operationId: operation.id,
            userId,
            documentId: operation.documentId,
            layerId: operation.layerId || null,
            operationType: operation.type,
            payload: operation.payload,
            clientCreatedAt: operation.createdAt,
          })
          .onConflictDoNothing({ target: [annotationOps.userId, annotationOps.operationId] })
          .returning({ sequence: annotationOps.serverSequence });
        if (inserted[0]) {
          accepted.push({ operationId: operation.id, sequence: inserted[0].sequence });
          continue;
        }
        const [existing] = await tx
          .select({ sequence: annotationOps.serverSequence })
          .from(annotationOps)
          .where(and(eq(annotationOps.userId, userId), eq(annotationOps.operationId, operation.id)))
          .limit(1);
        if (existing) accepted.push({ operationId: operation.id, sequence: existing.sequence });
      }
      return accepted;
    });
  }

  async pull(userId: string, cursor: number, limit: number) {
    const records = await this.db
      .select({
        id: annotationOps.operationId,
        documentId: annotationOps.documentId,
        layerId: annotationOps.layerId,
        type: annotationOps.operationType,
        payload: annotationOps.payload,
        createdAt: annotationOps.clientCreatedAt,
        sequence: annotationOps.serverSequence,
      })
      .from(annotationOps)
      .where(and(eq(annotationOps.userId, userId), gt(annotationOps.serverSequence, cursor)))
      .orderBy(asc(annotationOps.serverSequence))
      .limit(limit);
    return records;
  }
}
