import type { SyncOperationInput, SyncRepository } from "./repository.js";

export class SyncService {
  constructor(private readonly repository: SyncRepository) {}

  push(userId: string, operations: SyncOperationInput[]) {
    return this.repository.push(userId, operations);
  }

  async pull(userId: string, cursor: number, limit: number) {
    const operations = await this.repository.pull(userId, cursor, limit);
    return {
      operations,
      cursor: operations.at(-1)?.sequence ?? cursor,
    };
  }
}
