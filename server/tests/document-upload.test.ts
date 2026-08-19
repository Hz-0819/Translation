import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { eq, inArray } from "drizzle-orm";

import { buildApp } from "../src/app.js";
import { PostgresAuthRepository } from "../src/auth/postgres-repository.js";
import type { AppConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { documentObjects, users } from "../src/db/schema.js";
import { PostgresDocumentRepository } from "../src/documents/postgres-repository.js";
import { S3ObjectStore } from "../src/storage/object-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const s3Endpoint = process.env.TEST_S3_ENDPOINT;

test(
  "private upload sessions verify objects and enforce ownership",
  {
    skip:
      databaseUrl && s3Endpoint
        ? false
        : "set TEST_DATABASE_URL and TEST_S3_ENDPOINT to run object storage tests",
  },
  async () => {
    const config: AppConfig = {
      NODE_ENV: "test",
      API_PORT: 8787,
      WEB_ORIGIN: "http://localhost:5173",
      DATABASE_URL: databaseUrl!,
      S3_ENDPOINT: s3Endpoint!,
      S3_REGION: "us-east-1",
      S3_BUCKET: "paperlingo-test-documents",
      S3_ACCESS_KEY: "paperlingo",
      S3_SECRET_KEY: "paperlingo_dev_secret",
      JWT_SECRET: "test-secret-that-is-at-least-32-characters",
      ACCESS_TOKEN_TTL_MINUTES: 15,
      REFRESH_TOKEN_TTL_DAYS: 30,
    };
    const { client, db } = createDatabase(config);
    const objectStore = new S3ObjectStore(config);
    await objectStore.ensureBucket();
    const app = buildApp({
      config,
      authRepository: new PostgresAuthRepository(db),
      documentRepository: new PostgresDocumentRepository(db),
      objectStore,
    });
    const emails: string[] = [];
    const documentIds: string[] = [];

    const register = async () => {
      const email = `upload-${randomUUID()}@example.com`;
      emails.push(email);
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "document upload password" },
      });
      assert.equal(response.statusCode, 201);
      return response.json().accessToken as string;
    };

    try {
      const ownerToken = await register();
      const file = Buffer.from("%PDF-1.7\nprivate English exam file");
      const sha256 = createHash("sha256").update(file).digest("hex");
      const documentId = randomUUID();
      documentIds.push(documentId);

      const invalidMime = await app.inject({
        method: "POST",
        url: "/api/documents/upload-sessions",
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          documentId: randomUUID(),
          title: "unsafe.exe",
          mimeType: "application/x-msdownload",
          sourceKind: "file",
          byteSize: 20,
          sha256,
        },
      });
      assert.equal(invalidMime.statusCode, 400);

      const session = await app.inject({
        method: "POST",
        url: "/api/documents/upload-sessions",
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          documentId,
          title: "August exam.pdf",
          mimeType: "application/pdf",
          sourceKind: "pdf",
          byteSize: file.byteLength,
          sha256,
          pageCount: 2,
        },
      });
      assert.equal(session.statusCode, 201);
      const upload = session.json() as {
        objectId: string;
        uploadUrl: string;
        headers: Record<string, string>;
      };

      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: upload.headers,
        body: file,
      });
      assert.equal(put.status, 200, await put.text());

      const commitUrl = `/api/documents/${documentId}/objects/${upload.objectId}/commit`;
      const committed = await app.inject({
        method: "POST",
        url: commitUrl,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(committed.statusCode, 200);
      assert.equal(committed.json().status, "verified");

      const duplicateCommit = await app.inject({
        method: "POST",
        url: commitUrl,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(duplicateCommit.statusCode, 200);
      assert.equal(duplicateCommit.json().status, "verified");

      const download = await app.inject({
        method: "GET",
        url: `/api/documents/${documentId}/download`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(download.statusCode, 200);
      const downloaded = await fetch(download.json().downloadUrl);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), file);

      const pendingDocumentId = randomUUID();
      documentIds.push(pendingDocumentId);
      const pendingSession = await app.inject({
        method: "POST",
        url: "/api/documents/upload-sessions",
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          documentId: pendingDocumentId,
          title: "pending.pdf",
          mimeType: "application/pdf",
          sourceKind: "pdf",
          byteSize: file.byteLength,
          sha256,
        },
      });
      assert.equal(pendingSession.statusCode, 201);
      const pendingCommit = await app.inject({
        method: "POST",
        url: `/api/documents/${pendingDocumentId}/objects/${pendingSession.json().objectId}/commit`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(pendingCommit.statusCode, 409);

      const corruptDocumentId = randomUUID();
      documentIds.push(corruptDocumentId);
      const corruptSession = await app.inject({
        method: "POST",
        url: "/api/documents/upload-sessions",
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          documentId: corruptDocumentId,
          title: "corrupt.pdf",
          mimeType: "application/pdf",
          sourceKind: "pdf",
          byteSize: file.byteLength,
          sha256,
        },
      });
      const corruptUpload = corruptSession.json();
      await fetch(corruptUpload.uploadUrl, {
        method: "PUT",
        headers: corruptUpload.headers,
        body: Buffer.from(file.map((byte, index) => (index === file.length - 1 ? byte ^ 1 : byte))),
      });
      const corruptCommit = await app.inject({
        method: "POST",
        url: `/api/documents/${corruptDocumentId}/objects/${corruptUpload.objectId}/commit`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(corruptCommit.statusCode, 422);

      const strangerToken = await register();
      const forbidden = await app.inject({
        method: "GET",
        url: `/api/documents/${documentId}/download`,
        headers: { authorization: `Bearer ${strangerToken}` },
      });
      assert.equal(forbidden.statusCode, 404);

    } finally {
      if (documentIds.length) {
        const objects = await db
          .select({ objectKey: documentObjects.objectKey })
          .from(documentObjects)
          .where(inArray(documentObjects.documentId, documentIds));
        for (const object of objects) await objectStore.deleteObject(object.objectKey);
      }
      for (const email of emails) await db.delete(users).where(eq(users.email, email));
      await app.close();
      await client.end();
    }
  },
);
