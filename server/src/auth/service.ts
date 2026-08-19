import { createHash, randomBytes, randomUUID } from "node:crypto";

import argon2 from "argon2";
import { jwtVerify, SignJWT } from "jose";

import type { AppConfig } from "../config.js";
import {
  EmailAlreadyExistsError,
  type AuthRepository,
  type AuthUser,
} from "./repository.js";

export class InvalidCredentialsError extends Error {}
export class InvalidRefreshTokenError extends Error {}
export class RegistrationConflictError extends Error {}

const dummyPasswordHash = argon2.hash("paperlingo-invalid-account-password", {
  type: argon2.argon2id,
});

type Credentials = {
  email: string;
  password: string;
  deviceName?: string;
  platform?: string;
};

type SessionResult = {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  private readonly jwtKey: Uint8Array;

  constructor(
    private readonly repository: AuthRepository,
    private readonly config: AppConfig,
  ) {
    this.jwtKey = new TextEncoder().encode(config.JWT_SECRET);
  }

  async register(credentials: Credentials): Promise<SessionResult> {
    const email = normalizeEmail(credentials.email);
    const passwordHash = await argon2.hash(credentials.password, { type: argon2.argon2id });
    const user: AuthUser = { id: randomUUID(), email, passwordHash };
    const deviceId = randomUUID();
    const sessionId = randomUUID();
    const refreshToken = this.createRefreshToken();

    try {
      await this.repository.createRegistration({
        user,
        device: {
          id: deviceId,
          userId: user.id,
          name: credentials.deviceName?.trim() || "当前设备",
          platform: credentials.platform?.trim() || null,
        },
        session: {
          id: sessionId,
          userId: user.id,
          deviceId,
          refreshTokenHash: hashRefreshToken(refreshToken),
          expiresAt: this.refreshExpiry(),
          revokedAt: null,
        },
      });
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) throw new RegistrationConflictError();
      throw error;
    }

    return this.sessionResult(user, sessionId, refreshToken);
  }

  async login(credentials: Credentials): Promise<SessionResult> {
    const email = normalizeEmail(credentials.email);
    const user = await this.repository.findUserByEmail(email);
    const passwordMatches = await argon2.verify(
      user?.passwordHash ?? (await dummyPasswordHash),
      credentials.password,
    );

    if (!user || !passwordMatches) throw new InvalidCredentialsError();

    const deviceId = randomUUID();
    const sessionId = randomUUID();
    const refreshToken = this.createRefreshToken();
    await this.repository.createSession({
      device: {
        id: deviceId,
        userId: user.id,
        name: credentials.deviceName?.trim() || "当前设备",
        platform: credentials.platform?.trim() || null,
      },
      session: {
        id: sessionId,
        userId: user.id,
        deviceId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: this.refreshExpiry(),
        revokedAt: null,
      },
    });

    return this.sessionResult(user, sessionId, refreshToken);
  }

  async refresh(refreshToken: string): Promise<SessionResult> {
    const currentHash = hashRefreshToken(refreshToken);
    const active = await this.repository.findActiveSessionByHash(currentHash, new Date());
    if (!active) throw new InvalidRefreshTokenError();

    const replacement = this.createRefreshToken();
    const rotated = await this.repository.rotateSession(
      active.session.id,
      currentHash,
      hashRefreshToken(replacement),
      this.refreshExpiry(),
    );
    if (!rotated) throw new InvalidRefreshTokenError();

    return this.sessionResult(active.user, active.session.id, replacement);
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await this.repository.revokeSessionByHash(hashRefreshToken(refreshToken));
  }

  async verifyAccessToken(accessToken: string) {
    const { payload } = await jwtVerify(accessToken, this.jwtKey, {
      algorithms: ["HS256"],
      issuer: "paperlingo-api",
      audience: "paperlingo-web",
    });
    return payload;
  }

  private createRefreshToken() {
    return randomBytes(32).toString("base64url");
  }

  private refreshExpiry() {
    return new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }

  private async sessionResult(
    user: AuthUser,
    sessionId: string,
    refreshToken: string,
  ): Promise<SessionResult> {
    const accessToken = await new SignJWT({ email: user.email, sid: sessionId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuer("paperlingo-api")
      .setAudience("paperlingo-web")
      .setIssuedAt()
      .setExpirationTime(`${this.config.ACCESS_TOKEN_TTL_MINUTES}m`)
      .sign(this.jwtKey);

    return {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
    };
  }
}
