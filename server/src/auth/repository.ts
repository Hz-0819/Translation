export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
};

export type AuthDevice = {
  id: string;
  userId: string;
  name: string;
  platform: string | null;
};

export type AuthSession = {
  id: string;
  userId: string;
  deviceId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type RegistrationRecord = {
  user: AuthUser;
  device: AuthDevice;
  session: AuthSession;
};

export type SessionRecord = {
  device: AuthDevice;
  session: AuthSession;
};

export type ActiveSession = {
  user: AuthUser;
  session: AuthSession;
};

export class EmailAlreadyExistsError extends Error {}

export interface AuthRepository {
  createRegistration(record: RegistrationRecord): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createSession(record: SessionRecord): Promise<void>;
  findActiveSessionByHash(refreshTokenHash: string, now: Date): Promise<ActiveSession | null>;
  rotateSession(
    sessionId: string,
    expectedHash: string,
    replacementHash: string,
    expiresAt: Date,
  ): Promise<boolean>;
  revokeSessionByHash(refreshTokenHash: string): Promise<void>;
}
