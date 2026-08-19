import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";

import { buildApp } from "../src/app.js";
import { PostgresAuthRepository } from "../src/auth/postgres-repository.js";
import type { AppConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { users } from "../src/db/schema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "auth persists users and rotating sessions in PostgreSQL",
  { skip: databaseUrl ? false : "set TEST_DATABASE_URL to run PostgreSQL integration tests" },
  async () => {
    const config: AppConfig = {
      NODE_ENV: "test",
      API_PORT: 8787,
      WEB_ORIGIN: "http://localhost:5173",
      DATABASE_URL: databaseUrl!,
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "test",
      S3_ACCESS_KEY: "test",
      S3_SECRET_KEY: "test",
      JWT_SECRET: "test-secret-that-is-at-least-32-characters",
      ACCESS_TOKEN_TTL_MINUTES: 15,
      REFRESH_TOKEN_TTL_DAYS: 30,
    };
    const { client, db } = createDatabase(config);
    const app = buildApp({ config, authRepository: new PostgresAuthRepository(db) });
    const email = `integration-${randomUUID()}@example.com`;

    try {
      const registration = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "integration password 123", deviceName: "CI" },
      });
      assert.equal(registration.statusCode, 201);

      const [persisted] = await db.select().from(users).where(eq(users.email, email));
      assert.equal(persisted.email, email);
      assert.notEqual(persisted.passwordHash, "integration password 123");

      const cookieHeader = String(registration.headers["set-cookie"]).split(";", 1)[0];
      const refresh = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        headers: { cookie: cookieHeader },
      });
      assert.equal(refresh.statusCode, 200);
    } finally {
      await db.delete(users).where(eq(users.email, email));
      await app.close();
      await client.end();
    }
  },
);
