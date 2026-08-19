import {
  openPaperLingoDatabase,
  requestResult,
  STORE_NAMES,
  transactionComplete
} from './database.js';
import {
  ackOperations,
  enqueueOperation,
  listPendingOperations,
  markOperationFailed
} from './operation-queue.js';

export class DocumentRepository {
  constructor(options = {}) {
    this.databasePromise = openPaperLingoDatabase(options);
    this.database = null;
    this.databasePromise.then(database => { this.database = database; });
  }

  async storeNames() {
    const database = await this.databasePromise;
    return Array.from(database.objectStoreNames);
  }

  async saveImportedFile(file, metadata) {
    if (!metadata?.id || !metadata?.title) throw new Error('资料信息不完整');
    const database = await this.databasePromise;
    const transaction = database.transaction([STORE_NAMES.documents, STORE_NAMES.files], 'readwrite');
    const completed = transactionComplete(transaction);
    const now = Date.now();
    const existing = await requestResult(transaction.objectStore(STORE_NAMES.documents).get(metadata.id));
    const documentRecord = {
      ...existing,
      ...metadata,
      tags: Array.isArray(metadata.tags) ? metadata.tags : existing?.tags || [],
      syncStatus: metadata.syncStatus || existing?.syncStatus || 'local',
      createdAt: existing?.createdAt || metadata.createdAt || now,
      updatedAt: now,
      lastOpenedAt: metadata.lastOpenedAt || existing?.lastOpenedAt || now
    };
    await requestResult(transaction.objectStore(STORE_NAMES.documents).put(documentRecord));
    await requestResult(transaction.objectStore(STORE_NAMES.files).put({
      documentId: metadata.id,
      blob: file,
      fileName: metadata.fileName || file.name || metadata.title,
      mimeType: file.type || metadata.mimeType || '',
      lastModified: file.lastModified || metadata.lastModified || now,
      byteSize: file.size,
      updatedAt: now
    }));
    await completed;
    return documentRecord;
  }

  async getFile(documentId) {
    const database = await this.databasePromise;
    const transaction = database.transaction(STORE_NAMES.files, 'readonly');
    const record = await requestResult(transaction.objectStore(STORE_NAMES.files).get(documentId));
    return record?.blob || null;
  }

  async getDocument(documentId) {
    const database = await this.databasePromise;
    const transaction = database.transaction(STORE_NAMES.documents, 'readonly');
    return (await requestResult(transaction.objectStore(STORE_NAMES.documents).get(documentId))) || null;
  }

  async listDocuments() {
    const database = await this.databasePromise;
    const transaction = database.transaction(STORE_NAMES.documents, 'readonly');
    const records = await requestResult(transaction.objectStore(STORE_NAMES.documents).getAll());
    return records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async updateDocument(documentId, patch) {
    const database = await this.databasePromise;
    const transaction = database.transaction(STORE_NAMES.documents, 'readwrite');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAMES.documents);
    const existing = await requestResult(store.get(documentId));
    if (!existing) {
      transaction.abort();
      throw new Error('资料不存在');
    }
    const next = { ...existing, ...patch, id: documentId, updatedAt: Date.now() };
    await requestResult(store.put(next));
    await completed;
    return next;
  }

  async deleteDocument(documentId) {
    const database = await this.databasePromise;
    const transaction = database.transaction(
      [STORE_NAMES.documents, STORE_NAMES.files, STORE_NAMES.operations],
      'readwrite'
    );
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAMES.documents).delete(documentId);
    transaction.objectStore(STORE_NAMES.files).delete(documentId);
    const operationStore = transaction.objectStore(STORE_NAMES.operations);
    const cursorRequest = operationStore.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (cursor.value.documentId === documentId) cursor.delete();
      cursor.continue();
    };
    await completed;
  }

  async enqueueOperation(operation) {
    return enqueueOperation(await this.databasePromise, operation);
  }

  async listPendingOperations(limit) {
    return listPendingOperations(await this.databasePromise, limit);
  }

  async markOperationFailed(operationId, error) {
    return markOperationFailed(await this.databasePromise, operationId, error);
  }

  async ackOperations(operationIds) {
    return ackOperations(await this.databasePromise, operationIds);
  }

  async getSyncState(key) {
    const database = await this.databasePromise;
    const transaction = database.transaction(STORE_NAMES.syncState, 'readonly');
    return (await requestResult(transaction.objectStore(STORE_NAMES.syncState).get(key))) || null;
  }

  async setSyncState(key, value) {
    const database = await this.databasePromise;
    const transaction = database.transaction(STORE_NAMES.syncState, 'readwrite');
    const completed = transactionComplete(transaction);
    await requestResult(transaction.objectStore(STORE_NAMES.syncState).put({ key, ...value, updatedAt: Date.now() }));
    await completed;
  }

  async applyRemoteOperations(operations, cursor) {
    const database = await this.databasePromise;
    const transaction = database.transaction([STORE_NAMES.operations, STORE_NAMES.syncState], 'readwrite');
    const completed = transactionComplete(transaction);
    const operationStore = transaction.objectStore(STORE_NAMES.operations);
    for (const operation of operations || []) {
      operationStore.put({ ...operation, status: 'remote-applied', updatedAt: Date.now() });
    }
    transaction.objectStore(STORE_NAMES.syncState).put({
      key: 'serverCursor', cursor: Number(cursor) || 0, updatedAt: Date.now()
    });
    await completed;
  }

  close() {
    if (this.database) this.database.close();
    else this.databasePromise.then(database => database.close());
  }
}
