import assert from 'node:assert/strict';
import test from 'node:test';

import { SyncEngine } from '../src/sync/sync-engine.js';

test('keeps failed operations and acknowledges only server-accepted IDs', async () => {
  const pending = [
    { id: 'op-1', documentId: 'doc-1', type: 'ink.changed', payload: {} },
    { id: 'op-2', documentId: 'doc-1', type: 'layer.updated', payload: {} }
  ];
  const failed = [];
  const acknowledged = [];
  const applied = [];
  let pushes = 0;
  const repository = {
    listPendingOperations: async () => pending,
    markOperationFailed: async (id, error) => failed.push([id, error]),
    ackOperations: async ids => acknowledged.push(...ids),
    getSyncState: async () => ({ cursor: 0 }),
    applyRemoteOperations: async (operations, cursor) => applied.push({ operations, cursor })
  };
  const api = {
    pushOperations: async () => {
      pushes += 1;
      if (pushes === 1) throw new Error('offline');
      return { accepted: [{ operationId: 'op-1', sequence: 7 }] };
    },
    pullOperations: async () => ({
      cursor: 9,
      operations: [{ id: 'remote-1', sequence: 9, documentId: 'doc-1', type: 'ink.changed', payload: {} }]
    })
  };
  const engine = new SyncEngine({ api, repository });

  await assert.rejects(() => engine.syncOnce(), /offline/);
  assert.deepEqual(failed.map(item => item[0]), ['op-1', 'op-2']);
  assert.deepEqual(acknowledged, []);

  await engine.syncOnce();
  assert.deepEqual(acknowledged, ['op-1']);
  assert.equal(applied[0].cursor, 9);
});

test('background retry uses exponential backoff and broadcasts applied changes', async () => {
  const delays = [];
  const messages = [];
  const engine = new SyncEngine({
    api: { pushOperations: async () => ({ accepted: [] }), pullOperations: async () => ({ cursor: 0, operations: [] }) },
    repository: {
      listPendingOperations: async () => [], getSyncState: async () => ({ cursor: 0 }),
      applyRemoteOperations: async () => {}, ackOperations: async () => {}, markOperationFailed: async () => {}
    },
    delay: async milliseconds => delays.push(milliseconds),
    broadcast: { postMessage: message => messages.push(message), close() {} }
  });
  engine.noteFailure();
  engine.noteFailure();
  await engine.waitForRetry();
  assert.equal(delays[0], 2000);
  engine.notifyApplied(3);
  assert.deepEqual(messages, [{ type: 'sync-applied', cursor: 3 }]);
});
