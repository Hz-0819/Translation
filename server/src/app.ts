import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { registerAuthRoutes } from "./auth/routes.js";
import type { AuthRepository } from "./auth/repository.js";
import { AuthService } from "./auth/service.js";
import type { AppConfig } from "./config.js";

type BuildAppOptions = {
  config?: AppConfig;
  authRepository?: AuthRepository;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.get("/api/health", async () => ({ status: "ok" }));

  if (options.config && options.authRepository) {
    const { config, authRepository } = options;
    app.register(async (authApp) => {
      await authApp.register(cors, {
        origin: config.WEB_ORIGIN,
        credentials: true,
      });
      await authApp.register(cookie);
      await authApp.register(helmet);
      await authApp.register(rateLimit, { global: false });
      registerAuthRoutes(authApp, new AuthService(authRepository, config), config);
    });
  }

  return app;
}
