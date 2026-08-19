function inferredType(file) {
  const name = String(file?.name || '').toLowerCase();
  if (file?.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (String(file?.type || '').startsWith('image/')) return 'image';
  return 'file';
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function restoreStoredFile(blob, metadata) {
  const options = {
    type: blob.type || metadata.mimeType || '',
    lastModified: metadata.lastModified || Date.now()
  };
  if (typeof File === 'function') {
    return new File([blob], metadata.fileName || metadata.title, options);
  }
  try {
    Object.defineProperty(blob, 'name', { value: metadata.fileName || metadata.title });
    Object.defineProperty(blob, 'lastModified', { value: options.lastModified });
  } catch {}
  return blob;
}

export function mergeDocumentCatalog(workspaceDocuments = [], storedDocuments = []) {
  const storedById = new Map(storedDocuments.map(document => [document.id, document]));
  const merged = workspaceDocuments.map(document => {
    const stored = storedById.get(document.id);
    if (stored) {
      storedById.delete(document.id);
      return { ...document, ...stored, localAvailability: 'available' };
    }
    if (document.type === 'sample' || document.type === 'blank') return document;
    return { ...document, localAvailability: 'missing-local-file' };
  });
  return [...storedById.values()].map(document => ({ ...document, localAvailability: 'available' })).concat(merged);
}

export class DocumentLibrary {
  constructor({ repository, renderFile }) {
    this.repository = repository;
    this.renderFile = renderFile;
  }

  async importFile(file, metadata = {}) {
    const initial = {
      ...metadata,
      id: metadata.id || createId(),
      title: metadata.title || file.name || '未命名资料',
      fileName: metadata.fileName || file.name || metadata.title || '未命名资料',
      mimeType: metadata.mimeType || file.type || '',
      lastModified: metadata.lastModified || file.lastModified || Date.now(),
      type: metadata.type || inferredType(file),
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      syncStatus: metadata.syncStatus || 'local',
      localAvailability: 'available'
    };
    await this.repository.saveImportedFile(file, initial);
    try {
      const rendered = await this.renderFile(file, initial);
      const { objectUrls: _objectUrls, ...persistedRender } = rendered;
      return await this.repository.updateDocument(initial.id, {
        ...persistedRender,
        pageCount: rendered.pages || 0,
        localAvailability: 'available',
        loadState: 'ready',
        lastOpenedAt: Date.now()
      });
    } catch (error) {
      await this.repository.updateDocument(initial.id, {
        loadState: 'render-failed',
        loadError: String(error?.message || error)
      });
      throw error;
    }
  }

  listDocuments() {
    return this.repository.listDocuments();
  }

  async openResource(documentId) {
    const document = await this.repository.getDocument(documentId);
    if (!document) return { status: 'not-found' };
    const blob = await this.repository.getFile(documentId);
    if (!blob) {
      const missing = await this.repository.updateDocument(documentId, {
        localAvailability: 'missing-local-file'
      });
      return { status: 'missing-local-file', document: missing };
    }
    const file = restoreStoredFile(blob, document);
    const rendered = await this.renderFile(file, document);
    const { objectUrls: _objectUrls, ...persistedRender } = rendered;
    const updated = await this.repository.updateDocument(documentId, {
      ...persistedRender,
      pageCount: rendered.pages || document.pageCount || 0,
      localAvailability: 'available',
      loadState: 'ready',
      lastOpenedAt: Date.now()
    });
    return { status: 'opened', document: updated, rendered };
  }
}
