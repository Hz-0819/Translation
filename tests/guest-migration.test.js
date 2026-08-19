import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { indexedDB } from 'fake-indexeddb';

import { AuthStore } from '../src/auth/auth-store.js';
import { GuestMigration } from '../src/auth/guest-migration.js';
import { DocumentRepository } from '../src/storage/document-repository.js';

test('auth store keeps access tokens in memory and clears them on logout', async () => {
  const calls = [];
  const api = {
    refresh: async () => { throw new Error('no session'); },
    register: async credentials => ({ user: { id: 'u1', email: credentials.email }, accessToken: 'registered-token' }),
    login: async credentials => ({ user: { id: 'u1', email: credentials.email }, accessToken: 'login-token' }),
    logout: async () => calls.push('logout')
  };
  const store = new AuthStore(api);
  assert.equal((await store.bootstrap()).authenticated, false);
  assert.equal((await store.register({ email: 'a@example.com' })).accessToken, 'registered-token');
  assert.equal((await store.login({ email: 'a@example.com' })).accessToken, 'login-token');
  await store.logout();
  assert.deepEqual(calls, ['logout']);
  assert.equal(store.snapshot().authenticated, false);
});

async function createLocalRepository() {
  const repository = new DocumentRepository({ indexedDB, databaseName: `migration-${randomUUID()}` });
  const documentId = randomUUID();
  await repository.saveImportedFile(new Blob(['exam'], { type: 'application/pdf' }), {
    id: documentId, title: 'Exam.pdf', fileName: 'Exam.pdf', mimeType: 'application/pdf', type: 'pdf'
  });
  return { repository, documentId };
}

test('selected guest documents upload, resume idempotently, and remain stored locally', async () => {
  const { repository, documentId } = await createLocalRepository();
  const calls = [];
  const uploadApi = {
    createUploadSession: async () => ({ objectId: 'object-1', status: 'pending', uploadUrl: 'test' }),
    uploadObject: async () => calls.push('upload'),
    commit: async () => calls.push('commit')
  };
  const migration = new GuestMigration({ repository, uploadApi });
  assert.deepEqual((await migration.candidates('user-1')).map(item => item.id), [documentId]);
  assert.equal((await migration.migrate({ userId: 'user-1', documentIds: [documentId] }))[0].status, 'synced');
  assert.deepEqual(calls, ['upload', 'commit']);
  assert.equal(await (await repository.getFile(documentId)).text(), 'exam');

  assert.equal((await migration.migrate({ userId: 'user-1', documentIds: [documentId] }))[0].status, 'skipped');
  assert.deepEqual(calls, ['upload', 'commit']);
  repository.close();
});

test('migration preserves failed files for retry and refuses a different account', async () => {
  const { repository, documentId } = await createLocalRepository();
  let shouldFail = true;
  const uploadApi = {
    createUploadSession: async () => ({ objectId: 'object-1', status: 'pending', uploadUrl: 'test' }),
    uploadObject: async () => { if (shouldFail) throw new Error('offline'); },
    commit: async () => ({ status: 'verified' })
  };
  const migration = new GuestMigration({ repository, uploadApi });
  assert.equal((await migration.migrate({ userId: 'user-1', documentIds: [documentId] }))[0].status, 'failed');
  assert.equal((await repository.getDocument(documentId)).syncStatus, 'failed');
  assert.ok(await repository.getFile(documentId));

  shouldFail = false;
  assert.equal((await migration.migrate({ userId: 'user-1', documentIds: [documentId] }))[0].status, 'synced');
  await assert.rejects(
    migration.migrate({ userId: 'user-2', documentIds: [documentId] }),
    error => error.code === 'migration_owner_conflict'
  );
  repository.close();
});
