import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";

import { buildApp } from "../src/app.js";
import { PostgresAuthRepository } from "../src/auth/postgres-repository.js";
import type { AppConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { PostgresDocumentRepository } from "../src/documents/postgres-repository.js";
import { S3ObjectStore } from "../src/storage/object-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const s3Endpoint = process.env.TEST_S3_ENDPOINT;

test("guest document claims are idempotent and cannot cross accounts", {
  skip: databaseUrl && s3Endpoint ? false : "set storage integration environment variables",
}, async () => {
  const config: AppConfig = {
    NODE_ENV: "test", API_PORT: 8787, WEB_ORIGIN: "http://localhost:5173", DATABASE_URL: databaseUrl!,
    S3_ENDPOINT: s3Endpoint!, S3_REGION: "us-east-1", S3_BUCKET: "paperlingo-test-documents",
    S3_ACCESS_KEY: "paperlingo", S3_SECRET_KEY: "paperlingo_dev_secret",
    JWT_SECRET: "test-secret-that-is-at-least-32-characters", ACCESS_TOKEN_TTL_MINUTES: 15,
    REFRESH_TOKEN_TTL_DAYS: 30,
  };
  const { client, db } = createDatabase(config);
  const store = new S3ObjectStore(config);
  await store.ensureBucket();
  const app = buildApp({
    config, authRepository: new PostgresAuthRepository(db),
    documentRepository: new PostgresDocumentRepository(db), objectStore: store,
  });
  const emails: string[] = [];
  const register = async () => {
    const email = `claim-${randomUUID()}@example.com`;
    emails.push(email);
    const response = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email, password: "guest claim password" } });
    return response.json().accessToken as string;
  };
  const documentId = randomUUID();
  const file = Buffer.from("guest exam");
  const payload = {
    documentId, title: "Guest exam.pdf", mimeType: "application/pdf", sourceKind: "pdf",
    byteSize: file.byteLength, sha256: createHash("sha256").update(file).digest("hex"), pageCount: 1,
  };
  try {
    const owner = await register();
    const first = await app.inject({ method: "POST", url: "/api/documents/upload-sessions", headers: { authorization: `Bearer ${owner}` }, payload });
    assert.equal(first.statusCode, 201);
    const retry = await app.inject({ method: "POST", url: "/api/documents/upload-sessions", headers: { authorization: `Bearer ${owner}` }, payload });
    assert.equal(retry.statusCode, 201);
    assert.equal(retry.json().objectId, first.json().objectId);

    const stranger = await register();
    const conflict = await app.inject({ method: "POST", url: "/api/documents/upload-sessions", headers: { authorization: `Bearer ${stranger}` }, payload });
    assert.equal(conflict.statusCode, 409);
  } finally {
    for (const email of emails) await db.delete(users).where(eq(users.email, email));
    await app.close();
    await client.end();
  }
});
