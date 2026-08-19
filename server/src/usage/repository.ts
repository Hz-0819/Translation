export type UsageSnapshot = {
  committedBytes: number;
  reservedBytes: number;
};

export interface UsageRepository {
  getUsage(userId: string): Promise<UsageSnapshot>;
  reserve(input: {
    userId: string;
    documentId: string;
    byteSize: number;
    storageLimitBytes: number;
  }): Promise<void>;
  commit(documentId: string): Promise<void>;
  release(documentId: string): Promise<void>;
}
