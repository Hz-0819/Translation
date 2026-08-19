import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";

import { buildApp } from "../src/app.js";
import { PostgresAuthRepository } from "../src/auth/postgres-repository.js";
import type { AppConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { documents, users } from "../src/db/schema.js";
import { PostgresSyncRepository } from "../src/sync/postgres-repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "sync push is idempotent and pull advances a monotonic cursor",
  { skip: databaseUrl ? false : "set TEST_DATABASE_URL to run PostgreSQL sync tests" },
  async () => {
    const config: AppConfig = {
      NODE_ENV: "test", API_PORT: 8787, WEB_ORIGIN: "http://localhost:5173",
      DATABASE_URL: databaseUrl!, S3_ENDPOINT: "http://localhost:9000", S3_REGION: "us-east-1",
      S3_BUCKET: "test", S3_ACCESS_KEY: "test", S3_SECRET_KEY: "test",
      JWT_SECRET: "test-secret-that-is-at-least-32-characters",
      ACCESS_TOKEN_TTL_MINUTES: 15, REFRESH_TOKEN_TTL_DAYS: 30,
    };
    const { client, db } = createDatabase(config);
    const app = buildApp({
      config,
      authRepository: new PostgresAuthRepository(db),
      syncRepository: new PostgresSyncRepository(db),
    });
    const email = `sync-${randomUUID()}@example.com`;
    try {
      const registration = await app.inject({
        method: "POST", url: "/api/auth/register",
        payload: { email, password: "synchronization password" },
      });
      const { accessToken, user } = registration.json();
      const documentId = randomUUID();
      await db.insert(documents).values({
        id: documentId, userId: user.id, title: "Sync exam", mimeType: "application/pdf", sourceKind: "pdf",
      });
      const operations = [
        { id: randomUUID(), documentId, type: "ink.page.replaced", payload: { pageIndex: 0, strokes: [] }, createdAt: new Date().toISOString() },
        { id: randomUUID(), documentId, type: "layer.updated", payload: { layerId: randomUUID(), visible: false }, createdAt: new Date().toISOString() },
      ];
      const push = async (items = operations) => app.inject({
        method: "POST", url: "/api/sync/push",
        headers: { authorization: `Bearer ${accessToken}` }, payload: { operations: items },
      });

      const first = await push();
      assert.equal(first.statusCode, 200);
      assert.equal(first.json().accepted.length, 2);
      assert.ok(first.json().accepted[1].sequence > first.json().accepted[0].sequence);

      const duplicate = await push([operations[0]]);
      assert.equal(duplicate.statusCode, 200);
      assert.equal(duplicate.json().accepted[0].sequence, first.json().accepted[0].sequence);

      const pull = await app.inject({
        method: "GET", url: "/api/sync/pull?cursor=0&limit=100",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(pull.statusCode, 200);
      assert.equal(pull.json().operations.length, 2);
      assert.equal(pull.json().cursor, first.json().accepted[1].sequence);

      const secondUser = await app.inject({
        method: "POST", url: "/api/auth/register",
        payload: { email: `other-${email}`, password: "another synchronization password" },
      });
      const unauthorized = await app.inject({
        method: "POST", url: "/api/sync/push",
        headers: { authorization: `Bearer ${secondUser.json().accessToken}` },
        payload: { operations: [{ ...operations[0], id: randomUUID() }] },
      });
      assert.equal(unauthorized.statusCode, 404);
    } finally {
      await db.delete(users).where(eq(users.email, email));
      await db.delete(users).where(eq(users.email, `other-${email}`));
      await app.close(); await client.end();
    }
  },
);
