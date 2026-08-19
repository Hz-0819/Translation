import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "./service.js";

export async function authenticatedUserId(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: AuthService,
) {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    await reply.code(401).send({ message: "请先登录" });
    return null;
  }
  try {
    const payload = await auth.verifyAccessToken(token);
    if (typeof payload.sub !== "string") throw new Error("missing subject");
    return payload.sub;
  } catch {
    await reply.code(401).send({ message: "登录已失效" });
    return null;
  }
}
