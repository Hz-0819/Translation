import { requestResult, STORE_NAMES, transactionComplete } from './database.js';

export async function enqueueOperation(database, operation) {
  if (!operation?.id || !operation?.documentId || !operation?.type) {
    throw new Error('同步操作缺少必要信息');
  }
  const transaction = database.transaction(STORE_NAMES.operations, 'readwrite');
  const completed = transactionComplete(transaction);
  const record = {
    ...operation,
    payload: operation.payload ?? {},
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: operation.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  await requestResult(transaction.objectStore(STORE_NAMES.operations).put(record));
  await completed;
  return record;
}

export async function listPendingOperations(database, limit = 100) {
  const transaction = database.transaction(STORE_NAMES.operations, 'readonly');
  const records = await requestResult(transaction.objectStore(STORE_NAMES.operations).getAll());
  return records
    .filter(record => record.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(1, limit));
}

export async function markOperationFailed(database, operationId, error) {
  const transaction = database.transaction(STORE_NAMES.operations, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(STORE_NAMES.operations);
  const record = await requestResult(store.get(operationId));
  if (!record) {
    transaction.abort();
    throw new Error('同步操作不存在');
  }
  const next = {
    ...record,
    status: 'pending',
    attempts: (Number(record.attempts) || 0) + 1,
    lastError: String(error || 'unknown_error'),
    updatedAt: Date.now()
  };
  await requestResult(store.put(next));
  await completed;
  return next;
}

export async function ackOperations(database, operationIds) {
  const ids = [...new Set(operationIds || [])];
  if (!ids.length) return;
  const transaction = database.transaction(STORE_NAMES.operations, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(STORE_NAMES.operations);
  ids.forEach(id => store.delete(id));
  await completed;
}
