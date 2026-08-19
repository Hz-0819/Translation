import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { indexedDB } from 'fake-indexeddb';

import { DocumentRepository } from '../src/storage/document-repository.js';

test('persists imported files, metadata, and failed operations across database reopen', async () => {
  const databaseName = `paperlingo-test-${randomUUID()}`;
  const documentId = randomUUID();
  const repository = new DocumentRepository({ indexedDB, databaseName });
  const file = new Blob(['offline exam contents'], { type: 'application/pdf' });

  await repository.saveImportedFile(file, {
    id: documentId,
    title: 'Offline exam.pdf',
    type: 'pdf',
    fileName: 'Offline exam.pdf',
    tags: ['英语']
  });
  await repository.enqueueOperation({
    id: randomUUID(),
    documentId,
    type: 'ink.stroke.added',
    payload: { pageIndex: 0 }
  });
  const [queued] = await repository.listPendingOperations();
  await repository.markOperationFailed(queued.id, 'offline');
  repository.close();

  const reopened = new DocumentRepository({ indexedDB, databaseName });
  const storedFile = await reopened.getFile(documentId);
  assert.equal(await storedFile.text(), 'offline exam contents');

  const documents = await reopened.listDocuments();
  assert.equal(documents.length, 1);
  assert.equal(documents[0].title, 'Offline exam.pdf');
  assert.equal(documents[0].syncStatus, 'local');

  const updated = await reopened.updateDocument(documentId, { syncStatus: 'synced', pageCount: 3 });
  assert.equal(updated.syncStatus, 'synced');
  assert.equal(updated.pageCount, 3);

  const failedOperations = await reopened.listPendingOperations();
  assert.equal(failedOperations.length, 1);
  assert.equal(failedOperations[0].attempts, 1);
  assert.equal(failedOperations[0].lastError, 'offline');

  await reopened.ackOperations([failedOperations[0].id]);
  assert.deepEqual(await reopened.listPendingOperations(), []);

  await reopened.deleteDocument(documentId);
  assert.equal(await reopened.getFile(documentId), null);
  assert.deepEqual(await reopened.listDocuments(), []);
  reopened.close();
});

test('database migrations create the required offline-first stores', async () => {
  const repository = new DocumentRepository({
    indexedDB,
    databaseName: `paperlingo-stores-${randomUUID()}`
  });
  const stores = await repository.storeNames();
  assert.deepEqual(stores.sort(), ['documents', 'files', 'operations', 'settings', 'syncState']);
  repository.close();
});
