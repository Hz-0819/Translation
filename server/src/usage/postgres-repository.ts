import { and, eq, gt, isNull, sql } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { documentObjects, documents, uploadReservations } from "../db/schema.js";
import type { UsageRepository } from "./repository.js";

function numberValue(value: unknown) {
  return Number(value || 0);
}

export class PostgresUsageRepository implements UsageRepository {
  constructor(private readonly db: Database) {}

  async getUsage(userId: string) {
    const [committed] = await this.db
      .select({ total: sql<number>`coalesce(sum(${documentObjects.byteSize}), 0)` })
      .from(documentObjects)
      .innerJoin(documents, eq(documents.id, documentObjects.documentId))
      .where(and(eq(documents.userId, userId), eq(documentObjects.status, "verified"), isNull(documentObjects.deletedAt)));
    const [reserved] = await this.db
      .select({ total: sql<number>`coalesce(sum(${uploadReservations.byteSize}), 0)` })
      .from(uploadReservations)
      .where(and(eq(uploadReservations.userId, userId), eq(uploadReservations.status, "pending"), gt(uploadReservations.expiresAt, new Date())));
    return { committedBytes: numberValue(committed?.total), reservedBytes: numberValue(reserved?.total) };
  }

  async reserve(input: { userId: string; documentId: string; byteSize: number; storageLimitBytes: number }) {
    await this.db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
      await tx.update(uploadReservations).set({ status: "released", updatedAt: new Date() })
        .where(and(eq(uploadReservations.userId, input.userId), eq(uploadReservations.status, "pending"), sql`${uploadReservations.expiresAt} <= now()`));
      const [existing] = await tx.select().from(uploadReservations).where(eq(uploadReservations.documentId, input.documentId)).limit(1);
      if (existing) {
        if (existing.userId !== input.userId || existing.byteSize !== input.byteSize) {
          const error = new Error("reservation_conflict") as Error & { code: string };
          error.code = "reservation_conflict";
          throw error;
        }
        if (existing.status === "pending" || existing.status === "committed") return;
      }
      const [committed] = await tx
        .select({ total: sql<number>`coalesce(sum(${documentObjects.byteSize}), 0)` })
        .from(documentObjects)
        .innerJoin(documents, eq(documents.id, documentObjects.documentId))
        .where(and(eq(documents.userId, input.userId), eq(documentObjects.status, "verified"), isNull(documentObjects.deletedAt)));
      const [reserved] = await tx
        .select({ total: sql<number>`coalesce(sum(${uploadReservations.byteSize}), 0)` })
        .from(uploadReservations)
        .where(and(eq(uploadReservations.userId, input.userId), eq(uploadReservations.status, "pending"), gt(uploadReservations.expiresAt, new Date())));
      if (numberValue(committed?.total) + numberValue(reserved?.total) + input.byteSize > input.storageLimitBytes) {
        const error = new Error("storage_quota_exceeded") as Error & { code: string };
        error.code = "storage_quota_exceeded";
        throw error;
      }
      await tx.insert(uploadReservations).values({
        userId: input.userId, documentId: input.documentId, byteSize: input.byteSize,
        status: "pending", expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }).onConflictDoUpdate({
        target: uploadReservations.documentId,
        set: { status: "pending", expiresAt: new Date(Date.now() + 60 * 60 * 1000), updatedAt: new Date() },
      });
    });
  }

  async commit(documentId: string) {
    await this.db.update(uploadReservations).set({ status: "committed", updatedAt: new Date() })
      .where(eq(uploadReservations.documentId, documentId));
  }

  async release(documentId: string) {
    await this.db.update(uploadReservations).set({ status: "released", updatedAt: new Date() })
      .where(and(eq(uploadReservations.documentId, documentId), eq(uploadReservations.status, "pending")));
  }
}
