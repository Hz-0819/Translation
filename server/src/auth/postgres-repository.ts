import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { devices, sessions, users } from "../db/schema.js";
import {
  EmailAlreadyExistsError,
  type ActiveSession,
  type AuthRepository,
  type AuthUser,
  type RegistrationRecord,
  type SessionRecord,
} from "./repository.js";

type DatabaseError = { code?: string };

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  async createRegistration(record: RegistrationRecord): Promise<AuthUser> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: record.user.id,
          email: record.user.email,
          passwordHash: record.user.passwordHash,
        });
        await tx.insert(devices).values(record.device);
        await tx.insert(sessions).values(record.session);
      });
      return record.user;
    } catch (error) {
      if ((error as DatabaseError).code === "23505") throw new EmailAlreadyExistsError();
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  }

  async createSession(record: SessionRecord) {
    await this.db.transaction(async (tx) => {
      await tx.insert(devices).values(record.device);
      await tx.insert(sessions).values(record.session);
    });
  }

  async findActiveSessionByHash(refreshTokenHash: string, now: Date): Promise<ActiveSession | null> {
    const [record] = await this.db
      .select({
        user: { id: users.id, email: users.email, passwordHash: users.passwordHash },
        session: {
          id: sessions.id,
          userId: sessions.userId,
          deviceId: sessions.deviceId,
          refreshTokenHash: sessions.refreshTokenHash,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.refreshTokenHash, refreshTokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!record || !record.session.deviceId) return null;
    return { user: record.user, session: { ...record.session, deviceId: record.session.deviceId } };
  }

  async rotateSession(
    sessionId: string,
    expectedHash: string,
    replacementHash: string,
    expiresAt: Date,
  ) {
    const updated = await this.db
      .update(sessions)
      .set({ refreshTokenHash: replacementHash, expiresAt, lastUsedAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.refreshTokenHash, expectedHash),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });
    return updated.length === 1;
  }

  async revokeSessionByHash(refreshTokenHash: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.refreshTokenHash, refreshTokenHash), isNull(sessions.revokedAt)));
  }
}
