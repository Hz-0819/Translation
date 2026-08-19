import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";

import { buildApp } from "../src/app.js";
import { PostgresAuthRepository } from "../src/auth/postgres-repository.js";
import type { AppConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { PostgresUsageRepository } from "../src/usage/postgres-repository.js";
import { FileQuotaExceededError, FREE_PLAN, StorageQuotaExceededError, UsageService } from "../src/usage/service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("free plan reservations are idempotent and enforce total and per-file limits", {
  skip: databaseUrl ? false : "set TEST_DATABASE_URL to run usage integration tests",
}, async () => {
  const config: AppConfig = {
    NODE_ENV: "test", API_PORT: 8787, WEB_ORIGIN: "http://localhost:5173", DATABASE_URL: databaseUrl!,
    S3_ENDPOINT: "http://localhost:9000", S3_REGION: "us-east-1", S3_BUCKET: "unused",
    S3_ACCESS_KEY: "unused", S3_SECRET_KEY: "unused",
    JWT_SECRET: "test-secret-that-is-at-least-32-characters", ACCESS_TOKEN_TTL_MINUTES: 15,
    REFRESH_TOKEN_TTL_DAYS: 30,
  };
  const { client, db } = createDatabase(config);
  const repository = new PostgresUsageRepository(db);
  const service = new UsageService(repository);
  const app = buildApp({ config, authRepository: new PostgresAuthRepository(db), usageRepository: repository });
  const email = `usage-${randomUUID()}@example.com`;
  try {
    const registered = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email, password: "storage quota password" } });
    const { user, accessToken } = registered.json();
    const firstDocument = randomUUID();
    await service.reserve(user.id, firstDocument, 90 * 1024 * 1024);
    await service.reserve(user.id, firstDocument, 90 * 1024 * 1024);
    const usage = await service.snapshot(user.id);
    assert.equal(usage.reservedBytes, 90 * 1024 * 1024);
    assert.equal(usage.plan.code, "free");

    await assert.rejects(service.reserve(user.id, randomUUID(), FREE_PLAN.perFileLimitBytes + 1), FileQuotaExceededError);
    const extraDocuments = Array.from({ length: 4 }, () => randomUUID());
    for (const documentId of extraDocuments) await service.reserve(user.id, documentId, 100 * 1024 * 1024);
    await assert.rejects(service.reserve(user.id, randomUUID(), 20 * 1024 * 1024), StorageQuotaExceededError);

    const endpoint = await app.inject({ method: "GET", url: "/api/usage", headers: { authorization: `Bearer ${accessToken}` } });
    assert.equal(endpoint.statusCode, 200);
    assert.equal(endpoint.json().reservedBytes, 490 * 1024 * 1024);
    await service.release(firstDocument);
    for (const documentId of extraDocuments) await service.release(documentId);
    assert.equal((await service.snapshot(user.id)).reservedBytes, 0);
  } finally {
    await db.delete(users).where(eq(users.email, email));
    await app.close();
    await client.end();
  }
});
