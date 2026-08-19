export type PendingDocumentObject = {
  id: string;
  documentId: string;
  userId: string;
  objectKey: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
  status: string;
};

export type ExistingDocumentUpload = PendingDocumentObject & {
  documentUserId: string;
};

export interface DocumentRepository {
  findDocumentUpload(documentId: string): Promise<ExistingDocumentUpload | null>;
  createPendingUpload(input: {
    document: {
      id: string;
      userId: string;
      title: string;
      mimeType: string;
      sourceKind: string;
      pageCount: number;
    };
    object: PendingDocumentObject;
  }): Promise<void>;
  findOwnedObject(userId: string, documentId: string, objectId: string): Promise<PendingDocumentObject | null>;
  findOwnedVerifiedObject(userId: string, documentId: string): Promise<PendingDocumentObject | null>;
  markVerified(documentId: string, objectId: string): Promise<void>;
  markFailed(objectId: string, reason: string): Promise<void>;
}
