import type { UsageRepository } from "./repository.js";

export const FREE_PLAN = Object.freeze({
  code: "free",
  name: "免费版",
  storageLimitBytes: 500 * 1024 * 1024,
  perFileLimitBytes: 100 * 1024 * 1024,
});

export class StorageQuotaExceededError extends Error {}
export class FileQuotaExceededError extends Error {}

export class UsageService {
  constructor(private readonly repository: UsageRepository) {}

  async reserve(userId: string, documentId: string, byteSize: number) {
    if (byteSize > FREE_PLAN.perFileLimitBytes) throw new FileQuotaExceededError();
    try {
      await this.repository.reserve({
        userId, documentId, byteSize, storageLimitBytes: FREE_PLAN.storageLimitBytes,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "storage_quota_exceeded") {
        throw new StorageQuotaExceededError();
      }
      throw error;
    }
  }

  commit(documentId: string) { return this.repository.commit(documentId); }
  release(documentId: string) { return this.repository.release(documentId); }

  async snapshot(userId: string) {
    const usage = await this.repository.getUsage(userId);
    return {
      plan: FREE_PLAN,
      ...usage,
      availableBytes: Math.max(0, FREE_PLAN.storageLimitBytes - usage.committedBytes - usage.reservedBytes),
    };
  }
}
