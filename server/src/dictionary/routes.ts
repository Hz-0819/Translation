import type { FastifyInstance } from "fastify";

import { normalizeDictionaryQuery, type DictionaryStore } from "./store.js";

export function registerDictionaryRoutes(app: FastifyInstance, store: DictionaryStore) {
  app.get("/api/dictionary", async (request, reply) => {
    const query = normalizeDictionaryQuery((request.query as { q?: string }).q || "");
    reply.header("cache-control", "public, max-age=86400");
    if (!query) return reply.code(400).send({ error: "invalid_query" });
    const entry = store.find(query);
    if (!entry) return reply.code(404).send({ error: "not_found", word: query });
    return entry;
  });
}
