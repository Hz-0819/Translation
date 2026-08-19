# Offline-First Cloud Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist uploaded documents locally, add private email/password accounts, and synchronize files and notebook operations through a vendor-neutral PostgreSQL and S3-compatible backend.

**Architecture:** Keep the current Vite frontend at the repository root, add a TypeScript Fastify modular monolith under `server/`, and run PostgreSQL plus MinIO through Docker Compose. The browser reads and writes through an IndexedDB `DocumentRepository`; a background sync service exchanges idempotent operations and signed object uploads with the API.

**Tech Stack:** Vite, vanilla JavaScript modules, IndexedDB, Node.js, TypeScript, Fastify, Zod, Drizzle ORM, PostgreSQL, AWS S3 SDK, MinIO, Argon2id, JOSE, Docker Compose, Node test runner/tsx.

---

### Task 1: Scaffold the local backend stack

**Files:**
- Create: `compose.yaml`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/config.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/tests/health.test.ts`
- Modify: `package.json`

**Step 1: Write the failing health test**

Create a Fastify injection test asserting `GET /api/health` returns `{ "status": "ok" }`.

**Step 2: Run the test and verify failure**

Run: `npm --prefix server test -- health.test.ts`

Expected: FAIL because the server app does not exist.

**Step 3: Add the minimal API and containers**

Add PostgreSQL and MinIO services with named volumes and health checks. Implement `buildApp()` and register the health route. Add root scripts `dev:api`, `test:api`, and `infra:up`.

**Step 4: Verify**

Run:

```powershell
docker compose config
npm --prefix server test
npm --prefix server run typecheck
```

Expected: compose configuration valid, health test PASS, no TypeScript errors.

**Step 5: Commit**

```powershell
git add compose.yaml .env.example package.json server
git commit -m "chore: scaffold storage backend"
```

### Task 2: Create the PostgreSQL schema and migrations

**Files:**
- Create: `server/drizzle.config.ts`
- Create: `server/src/db/client.ts`
- Create: `server/src/db/schema.ts`
- Create: `server/src/db/migrate.ts`
- Create: `server/tests/schema.test.ts`
- Create: `server/drizzle/0000_initial.sql`

**Step 1: Write schema contract tests**

Assert that the schema exports users, sessions, devices, documents, documentObjects, layers, annotationOps, excerpts, outlines, mistakeBooks, mistakeEntries, syncCursors, plans, subscriptions, and usageRecords. Assert unique constraints for normalized email and `(userId, operationId)`.

**Step 2: Verify failure**

Run: `npm --prefix server test -- schema.test.ts`

Expected: FAIL because schema exports are missing.

**Step 3: Implement schema and migration**

Use UUID primary keys, `timestamptz`, explicit foreign keys, soft-delete timestamps, integer document versions, and JSONB only for operation payloads. Store object size as bigint and SHA-256 as a fixed-length string.

**Step 4: Apply and verify migration**

Run:

```powershell
docker compose up -d postgres minio
npm --prefix server run db:migrate
npm --prefix server test
```

Expected: migration applies once and is safe to rerun.

**Step 5: Commit**

```powershell
git add server/src/db server/drizzle server/drizzle.config.ts server/tests/schema.test.ts
git commit -m "feat: add cloud storage data model"
```

### Task 3: Implement private email/password authentication

**Files:**
- Create: `server/src/modules/auth/auth.routes.ts`
- Create: `server/src/modules/auth/auth.service.ts`
- Create: `server/src/modules/auth/password.ts`
- Create: `server/src/modules/auth/tokens.ts`
- Create: `server/src/plugins/auth.ts`
- Create: `server/tests/auth.test.ts`

**Step 1: Write failing API tests**

Cover registration, normalized email, weak-password rejection, duplicate email without enumeration, login, refresh rotation, logout, and rejection of a revoked session.

**Step 2: Verify failure**

Run: `npm --prefix server test -- auth.test.ts`

Expected: FAIL with missing auth routes.

**Step 3: Implement authentication**

Hash passwords with Argon2id. Issue a short-lived signed access token and a random rotating refresh token. Save only the refresh-token hash. Send refresh tokens through an HttpOnly, SameSite cookie; never return password hashes or session hashes.

**Step 4: Verify**

Run: `npm --prefix server test -- auth.test.ts`

Expected: all auth cases PASS.

**Step 5: Commit**

```powershell
git add server/src/modules/auth server/src/plugins/auth.ts server/tests/auth.test.ts
git commit -m "feat: add private account authentication"
```

### Task 4: Add signed object upload and download flows

**Files:**
- Create: `server/src/modules/storage/object-store.ts`
- Create: `server/src/modules/documents/document.routes.ts`
- Create: `server/src/modules/documents/document.service.ts`
- Create: `server/tests/document-upload.test.ts`

**Step 1: Write failing integration tests**

Cover upload-session creation, owner checks, MIME and size limits, signed PUT generation, object commit after size/hash verification, signed GET generation, duplicate commit, and rejection of another user's document.

**Step 2: Verify failure**

Run: `npm --prefix server test -- document-upload.test.ts`

Expected: FAIL because storage routes are missing.

**Step 3: Implement upload state machine**

Use `pending`, `uploaded`, `verified`, and `failed` states. Object keys must be opaque and namespaced by user/document UUID. Do not mark a document synced until MinIO confirms object metadata.

**Step 4: Verify against MinIO**

Run: `npm --prefix server test -- document-upload.test.ts`

Expected: signed upload, commit, download, and authorization cases PASS.

**Step 5: Commit**

```powershell
git add server/src/modules/storage server/src/modules/documents server/tests/document-upload.test.ts
git commit -m "feat: add private document object storage"
```

### Task 5: Add the browser IndexedDB repository

**Files:**
- Create: `src/storage/database.js`
- Create: `src/storage/document-repository.js`
- Create: `src/storage/operation-queue.js`
- Create: `tests/document-repository.test.js`
- Modify: `package.json`

**Step 1: Write failing repository tests**

Using `fake-indexeddb`, verify saving and reopening a Blob, listing metadata, updating sync state, deleting local data, enqueueing an operation, and retaining failed queue items after reopening the database.

**Step 2: Verify failure**

Run: `node --test tests/document-repository.test.js`

Expected: FAIL because the repository does not exist.

**Step 3: Implement the repository**

Create object stores `documents`, `files`, `operations`, `syncState`, and `settings`. Add versioned migrations. Expose `saveImportedFile`, `getFile`, `listDocuments`, `updateDocument`, `enqueueOperation`, `ackOperations`, and `deleteDocument`.

**Step 4: Verify**

Run: `npm test`

Expected: repository tests and all existing tests PASS.

**Step 5: Commit**

```powershell
git add package.json src/storage tests/document-repository.test.js
git commit -m "feat: persist document files in indexeddb"
```

### Task 6: Reopen locally persisted files from the library

**Files:**
- Modify: `src/main.js`
- Modify: `src/documents.js`
- Modify: `src/workspace-state.js`
- Create: `tests/document-open.test.js`

**Step 1: Write failing workflow tests**

Test that importing a file stores its Blob before rendering, the library reads repository metadata, `openResource(id)` loads the Blob without a file picker, and a missing local Blob produces a recoverable state instead of a generic reupload toast.

**Step 2: Verify failure**

Run: `node --test tests/document-open.test.js`

Expected: FAIL on the old metadata-only behavior.

**Step 3: Integrate the repository**

Replace direct library persistence with async repository calls. Keep localStorage only for UI preferences and migrate existing metadata records as `missing-local-file`. Revoke temporary object URLs after document replacement.

**Step 4: Manual and automated verification**

Run: `npm test` and `npm run build`.

Manual: upload PDF/Word/image, refresh, reopen each from 资料, then disable the network and reopen again.

**Step 5: Commit**

```powershell
git add src/main.js src/documents.js src/workspace-state.js tests/document-open.test.js
git commit -m "feat: reopen uploaded documents offline"
```

### Task 7: Implement operation synchronization

**Files:**
- Create: `server/src/modules/sync/sync.routes.ts`
- Create: `server/src/modules/sync/sync.service.ts`
- Create: `server/tests/sync.test.ts`
- Create: `src/sync/api-client.js`
- Create: `src/sync/sync-engine.js`
- Create: `tests/sync-engine.test.js`
- Modify: `src/ink.js`
- Modify: `src/main.js`

**Step 1: Write failing server and client tests**

Cover operation idempotency, monotonically increasing server sequence, cursor pulls, retry after timeout, exponential backoff, and queue acknowledgement only after server acceptance.

**Step 2: Verify failure**

Run: `npm test` and `npm --prefix server test -- sync.test.ts`

Expected: sync suites FAIL.

**Step 3: Implement push/pull sync**

Persist ink/layer/excerpt/outline/mistake changes as operations before updating UI state. Push bounded batches, pull after the current cursor, apply remote operations transactionally in IndexedDB, and broadcast local updates between browser tabs.

**Step 4: Verify offline recovery**

Run all frontend and server tests. Simulate one failed push followed by a successful retry and assert no duplicate operations.

**Step 5: Commit**

```powershell
git add server/src/modules/sync server/tests/sync.test.ts src/sync src/ink.js src/main.js tests/sync-engine.test.js
git commit -m "feat: synchronize notebook operations"
```

### Task 8: Add login UI and guest-data migration

**Files:**
- Create: `src/auth/auth-store.js`
- Create: `src/auth/auth-api.js`
- Create: `src/auth/guest-migration.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Create: `tests/guest-migration.test.js`
- Create: `server/tests/guest-claim.test.ts`

**Step 1: Write failing migration tests**

Verify register/login/logout state, migration of selected local document UUIDs, upload resumption, idempotent retry, and refusal to auto-claim data for a different signed-in account.

**Step 2: Verify failure**

Run frontend and backend migration tests.

Expected: FAIL because migration APIs do not exist.

**Step 3: Implement auth surfaces and migration**

Add compact registration/login views, an explicit “将本机资料同步到此账号” review step, progress per document, retry, and a clear local-only option. Never delete local files automatically after successful sync.

**Step 4: Verify end-to-end**

Create offline data, register, migrate, sign out, sign in on a clean browser profile, and reopen the document.

**Step 5: Commit**

```powershell
git add src/auth src/main.js src/styles.css tests/guest-migration.test.js server/tests/guest-claim.test.ts
git commit -m "feat: migrate offline documents into accounts"
```

### Task 9: Add plans, quotas, and usage accounting

**Files:**
- Create: `server/src/modules/usage/usage.service.ts`
- Create: `server/src/modules/usage/usage.routes.ts`
- Create: `server/tests/usage.test.ts`
- Modify: `server/src/modules/documents/document.service.ts`
- Modify: `src/main.js`

**Step 1: Write failing quota tests**

Test free-plan defaults, pending-upload reservations, committed byte totals, released bytes after cleanup, per-file limits, and an upgrade-required response without any payment provider.

**Step 2: Verify failure**

Run: `npm --prefix server test -- usage.test.ts`

Expected: FAIL because quota checks are missing.

**Step 3: Implement transactional usage reservations**

Reserve quota before signing an upload, commit actual bytes after verification, and expire abandoned reservations. Display used/available storage in account settings.

**Step 4: Verify**

Run all server and frontend tests.

**Step 5: Commit**

```powershell
git add server/src/modules/usage server/src/modules/documents/document.service.ts server/tests/usage.test.ts src/main.js
git commit -m "feat: add storage plans and quota accounting"
```

### Task 10: Harden deployment, recovery, and end-to-end tests

**Files:**
- Create: `server/src/plugins/rate-limit.ts`
- Create: `server/src/jobs/cleanup-uploads.ts`
- Create: `server/src/jobs/reconcile-usage.ts`
- Create: `scripts/backup-postgres.ps1`
- Create: `docs/operations/storage-runbook.md`
- Create: `tests/e2e/offline-cloud-storage.spec.md`
- Modify: `compose.yaml`
- Modify: `README.md`

**Step 1: Add failure-oriented test cases**

Document and automate where possible: expired signed URLs, interrupted upload, duplicate operation, corrupt object, revoked session, cross-user access, soft-delete recovery, database restore, and MinIO restart.

**Step 2: Implement operational safeguards**

Add route-specific rate limits, orphan upload cleanup, usage reconciliation, structured redacted logs, health/readiness endpoints, container health checks, graceful shutdown, and backup/restore commands.

**Step 3: Run the complete verification suite**

Run:

```powershell
npm test
npm run build
npm --prefix server test
npm --prefix server run typecheck
docker compose up -d
docker compose ps
```

Expected: all tests PASS and all services healthy.

**Step 4: Perform the acceptance journey**

Verify: offline import → refresh and reopen → register → migrate → sync → clean second device login → open → annotate → sync back → exceed quota → soft delete → restore.

**Step 5: Commit**

```powershell
git add compose.yaml README.md server/src/plugins server/src/jobs scripts docs/operations tests/e2e
git commit -m "chore: harden offline cloud storage deployment"
```

