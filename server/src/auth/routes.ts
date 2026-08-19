import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import {
  AuthService,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RegistrationConflictError,
} from "./service.js";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(10).max(200),
  deviceName: z.string().trim().min(1).max(120).optional(),
  platform: z.string().trim().min(1).max(80).optional(),
});

const refreshCookieName = "paperlingo_refresh";
const authRateLimit = {
  config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
};

function setRefreshCookie(reply: FastifyReply, token: string, config: AppConfig) {
  reply.setCookie(refreshCookieName, token, {
    path: "/api/auth",
    httpOnly: true,
    sameSite: "strict",
    secure: config.COOKIE_SECURE ?? config.NODE_ENV === "production",
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86_400,
  });
}

function clearRefreshCookie(reply: FastifyReply, config: AppConfig) {
  reply.clearCookie(refreshCookieName, {
    path: "/api/auth",
    httpOnly: true,
    sameSite: "strict",
    secure: config.COOKIE_SECURE ?? config.NODE_ENV === "production",
  });
}

export function registerAuthRoutes(app: FastifyInstance, service: AuthService, config: AppConfig) {
  app.post("/api/auth/register", authRateLimit, async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "请检查邮箱和密码" });

    try {
      const result = await service.register(parsed.data);
      setRefreshCookie(reply, result.refreshToken, config);
      return reply.code(201).send({ user: result.user, accessToken: result.accessToken });
    } catch (error) {
      if (error instanceof RegistrationConflictError) {
        return reply.code(409).send({ message: "无法创建账号" });
      }
      throw error;
    }
  });

  app.post("/api/auth/login", authRateLimit, async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "请检查邮箱和密码" });

    try {
      const result = await service.login(parsed.data);
      setRefreshCookie(reply, result.refreshToken, config);
      return { user: result.user, accessToken: result.accessToken };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return reply.code(401).send({ message: "邮箱或密码不正确" });
      }
      throw error;
    }
  });

  app.post("/api/auth/refresh", authRateLimit, async (request, reply) => {
    const refreshToken = request.cookies[refreshCookieName];
    if (!refreshToken) return reply.code(401).send({ message: "登录已失效" });

    try {
      const result = await service.refresh(refreshToken);
      setRefreshCookie(reply, result.refreshToken, config);
      return { user: result.user, accessToken: result.accessToken };
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        clearRefreshCookie(reply, config);
        return reply.code(401).send({ message: "登录已失效" });
      }
      throw error;
    }
  });

  app.post("/api/auth/logout", authRateLimit, async (request, reply) => {
    await service.logout(request.cookies[refreshCookieName]);
    clearRefreshCookie(reply, config);
    return reply.code(204).send();
  });
}
