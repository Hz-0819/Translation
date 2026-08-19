export const DATABASE_NAME = 'paperlingo';
export const DATABASE_VERSION = 1;

export const STORE_NAMES = Object.freeze({
  documents: 'documents',
  files: 'files',
  operations: 'operations',
  syncState: 'syncState',
  settings: 'settings'
});

export function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

export function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

export function openPaperLingoDatabase({
  indexedDB = globalThis.indexedDB,
  databaseName = DATABASE_NAME
} = {}) {
  if (!indexedDB) return Promise.reject(new Error('当前浏览器不支持本地资料存储'));
  const request = indexedDB.open(databaseName, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAMES.documents)) {
      const documents = database.createObjectStore(STORE_NAMES.documents, { keyPath: 'id' });
      documents.createIndex('updatedAt', 'updatedAt');
    }
    if (!database.objectStoreNames.contains(STORE_NAMES.files)) {
      database.createObjectStore(STORE_NAMES.files, { keyPath: 'documentId' });
    }
    if (!database.objectStoreNames.contains(STORE_NAMES.operations)) {
      const operations = database.createObjectStore(STORE_NAMES.operations, { keyPath: 'id' });
      operations.createIndex('documentId', 'documentId');
      operations.createIndex('status', 'status');
      operations.createIndex('createdAt', 'createdAt');
    }
    if (!database.objectStoreNames.contains(STORE_NAMES.syncState)) {
      database.createObjectStore(STORE_NAMES.syncState, { keyPath: 'key' });
    }
    if (!database.objectStoreNames.contains(STORE_NAMES.settings)) {
      database.createObjectStore(STORE_NAMES.settings, { keyPath: 'key' });
    }
  };
  return requestResult(request);
}
