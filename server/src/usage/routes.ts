import type { FastifyInstance } from "fastify";

import { authenticatedUserId } from "../auth/guard.js";
import type { AuthService } from "../auth/service.js";
import type { UsageService } from "./service.js";

export function registerUsageRoutes(app: FastifyInstance, service: UsageService, auth: AuthService) {
  app.get("/api/usage", async (request, reply) => {
    const userId = await authenticatedUserId(request, reply, auth);
    if (!userId) return;
    return service.snapshot(userId);
  });
}
