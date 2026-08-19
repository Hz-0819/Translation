export type SyncOperationInput = {
  id: string;
  documentId: string;
  layerId?: string | null;
  type: string;
  payload: unknown;
  createdAt: Date;
};

export type SyncOperation = SyncOperationInput & { sequence: number };

export class SyncDocumentNotFoundError extends Error {}

export interface SyncRepository {
  push(userId: string, operations: SyncOperationInput[]): Promise<Array<{ operationId: string; sequence: number }>>;
  pull(userId: string, cursor: number, limit: number): Promise<SyncOperation[]>;
}
