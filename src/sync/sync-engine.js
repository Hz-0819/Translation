const defaultDelay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export class SyncEngine {
  constructor({ api, repository, applyOperation = async () => {}, delay = defaultDelay, broadcast } = {}) {
    this.api = api;
    this.repository = repository;
    this.applyOperation = applyOperation;
    this.delay = delay;
    this.broadcast = broadcast || (
      typeof window !== 'undefined' && typeof BroadcastChannel === 'function'
        ? new BroadcastChannel('paperlingo-sync')
        : null
    );
    this.failureCount = 0;
    this.running = false;
    this.stopped = true;
  }

  async syncOnce() {
    if (this.running) return { skipped: true };
    this.running = true;
    const pending = await this.repository.listPendingOperations(100);
    try {
      if (pending.length) {
        let pushed;
        try {
          pushed = await this.api.pushOperations(pending);
        } catch (error) {
          await Promise.all(pending.map(operation => this.repository.markOperationFailed(operation.id, error.message)));
          this.noteFailure();
          throw error;
        }
        const acceptedIds = pushed.accepted.map(item => item.operationId);
        await this.repository.ackOperations(acceptedIds);
      }
      const state = await this.repository.getSyncState('serverCursor');
      const pulled = await this.api.pullOperations(state?.cursor || 0, 100);
      await this.repository.applyRemoteOperations(pulled.operations, pulled.cursor);
      for (const operation of pulled.operations) await this.applyOperation(operation);
      this.failureCount = 0;
      if (pulled.operations.length) this.notifyApplied(pulled.cursor);
      return { pushed: pending.length, pulled: pulled.operations.length, cursor: pulled.cursor };
    } finally {
      this.running = false;
    }
  }

  noteFailure() {
    this.failureCount = Math.min(8, this.failureCount + 1);
  }

  waitForRetry() {
    return this.delay(Math.min(60_000, 500 * (2 ** this.failureCount)));
  }

  notifyApplied(cursor) {
    this.broadcast?.postMessage({ type: 'sync-applied', cursor });
  }

  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    while (!this.stopped) {
      try {
        await this.syncOnce();
        await this.delay(15_000);
      } catch {
        await this.waitForRetry();
      }
    }
  }

  stop() {
    this.stopped = true;
    this.broadcast?.close?.();
  }
}
