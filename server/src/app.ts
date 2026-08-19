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
