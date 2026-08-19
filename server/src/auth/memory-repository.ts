import {
  EmailAlreadyExistsError,
  type ActiveSession,
  type AuthRepository,
  type AuthSession,
  type AuthUser,
  type RegistrationRecord,
  type SessionRecord,
} from "./repository.js";

export class MemoryAuthRepository implements AuthRepository {
  private readonly usersByEmail = new Map<string, AuthUser>();
  private readonly usersById = new Map<string, AuthUser>();
  private readonly sessionsByHash = new Map<string, AuthSession>();

  get userCount() {
    return this.usersById.size;
  }

  async createRegistration(record: RegistrationRecord) {
    if (this.usersByEmail.has(record.user.email)) {
      throw new EmailAlreadyExistsError();
    }
    this.usersByEmail.set(record.user.email, record.user);
    this.usersById.set(record.user.id, record.user);
    this.sessionsByHash.set(record.session.refreshTokenHash, record.session);
    return record.user;
  }

  async findUserByEmail(email: string) {
    return this.usersByEmail.get(email) ?? null;
  }

  async createSession(record: SessionRecord) {
    this.sessionsByHash.set(record.session.refreshTokenHash, record.session);
  }

  async findActiveSessionByHash(refreshTokenHash: string, now: Date): Promise<ActiveSession | null> {
    const session = this.sessionsByHash.get(refreshTokenHash);
    if (!session || session.revokedAt || session.expiresAt <= now) return null;
    const user = this.usersById.get(session.userId);
    return user ? { user, session } : null;
  }

  async rotateSession(
    sessionId: string,
    expectedHash: string,
    replacementHash: string,
    expiresAt: Date,
  ) {
    const session = this.sessionsByHash.get(expectedHash);
    if (!session || session.id !== sessionId || session.revokedAt) return false;
    this.sessionsByHash.delete(expectedHash);
    session.refreshTokenHash = replacementHash;
    session.expiresAt = expiresAt;
    this.sessionsByHash.set(replacementHash, session);
    return true;
  }

  async revokeSessionByHash(refreshTokenHash: string) {
    const session = this.sessionsByHash.get(refreshTokenHash);
    if (session) session.revokedAt = new Date();
  }
}
