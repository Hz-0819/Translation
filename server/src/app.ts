import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { registerAuthRoutes } from "./auth/routes.js";
import type { AuthRepository } from "./auth/repository.js";
import { AuthService } from "./auth/service.js";
import type { AppConfig } from "./config.js";
import { registerDocumentRoutes } from "./documents/routes.js";
import type { DocumentRepository } from "./documents/repository.js";
import { DocumentService } from "./documents/service.js";
import type { ObjectStore } from "./storage/object-store.js";
import { registerSyncRoutes } from "./sync/routes.js";
import type { SyncRepository } from "./sync/repository.js";
import { SyncService } from "./sync/service.js";

type BuildAppOptions = {
  config?: AppConfig;
  authRepository?: AuthRepository;
  documentRepository?: DocumentRepository;
  objectStore?: ObjectStore;
  syncRepository?: SyncRepository;
};

function isAllowedWebOrigin(origin: string | undefined, config: AppConfig) {
  if (!origin || origin === config.WEB_ORIGIN) return true;
  if (config.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    const privateHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
      /^10\./.test(url.hostname) || /^192\.168\./.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
    return privateHost && url.port === "5173";
  } catch {
    return false;
  }
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.get("/api/health", async () => ({ status: "ok" }));

  if (options.config && options.authRepository) {
    const { config, authRepository } = options;
    app.register(async (authApp) => {
      await authApp.register(cors, {
        origin: (origin, callback) => callback(null, isAllowedWebOrigin(origin, config)),
        credentials: true,
      });
      await authApp.register(cookie);
      await authApp.register(helmet);
      await authApp.register(rateLimit, { global: false });
      const authService = new AuthService(authRepository, config);
      registerAuthRoutes(authApp, authService, config);
      if (options.documentRepository && options.objectStore) {
        registerDocumentRoutes(
          authApp,
          new DocumentService(options.documentRepository, options.objectStore),
          authService,
        );
      }
      if (options.syncRepository) {
        registerSyncRoutes(authApp, new SyncService(options.syncRepository), authService);
      }
    });
  }

  return app;
}
