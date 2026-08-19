const MIGRATION_OWNER_KEY = 'cloudMigrationOwner';

async function sha256Hex(blob) {
  const bytes = await blob.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export class DocumentUploadApi {
  constructor({ baseUrl = 'http://localhost:8787', getAccessToken, fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getAccessToken = getAccessToken;
    this.fetch = fetchImpl;
  }

  async authenticated(path, options = {}) {
    const token = await this.getAccessToken?.();
    if (!token) throw new Error('请先登录');
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `同步失败（${response.status}）`);
    }
    return response.json();
  }

  createUploadSession(document, file, sha256) {
    return this.authenticated('/api/documents/upload-sessions', {
      method: 'POST',
      body: JSON.stringify({
        documentId: document.id,
        title: document.title,
        mimeType: file.type || document.mimeType,
        sourceKind: document.type || 'file',
        byteSize: file.size,
        sha256,
        pageCount: document.pageCount || document.pages || 0
      })
    });
  }

  async uploadObject(session, file) {
    let uploadUrl = session.uploadUrl;
    if (typeof location !== 'undefined') {
      const url = new URL(uploadUrl);
      if (['localhost', '127.0.0.1'].includes(url.hostname) && !['localhost', '127.0.0.1'].includes(location.hostname)) {
        url.hostname = location.hostname;
        uploadUrl = url.toString();
      }
    }
    const response = await this.fetch(uploadUrl, { method: 'PUT', headers: session.headers, body: file });
    if (!response.ok) throw new Error(`文件上传失败（${response.status}）`);
  }

  commit(documentId, objectId) {
    return this.authenticated(`/api/documents/${documentId}/objects/${objectId}/commit`, { method: 'POST' });
  }

  getUsage() {
    return this.authenticated('/api/usage');
  }
}

export class GuestMigration {
  constructor({ repository, uploadApi }) {
    this.repository = repository;
    this.uploadApi = uploadApi;
  }

  async candidates(userId) {
    const documents = await this.repository.listDocuments();
    return documents.filter(document => document.id && document.cloudOwnerId !== userId &&
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(document.id));
  }

  async migrate({ userId, documentIds, onProgress = () => {} }) {
    const previousOwner = await this.repository.getSetting(MIGRATION_OWNER_KEY);
    if (previousOwner && previousOwner !== userId) {
      const error = new Error('这些本机资料已关联另一个账号，请先导出备份后再处理');
      error.code = 'migration_owner_conflict';
      throw error;
    }
    await this.repository.setSetting(MIGRATION_OWNER_KEY, userId);
    const results = [];
    for (const documentId of documentIds) {
      const document = await this.repository.getDocument(documentId);
      const file = await this.repository.getFile(documentId);
      if (!document || !file) {
        results.push({ documentId, status: 'missing' });
        continue;
      }
      if (document.syncStatus === 'synced' && document.cloudOwnerId === userId) {
        results.push({ documentId, status: 'skipped' });
        continue;
      }
      try {
        onProgress({ documentId, status: 'hashing' });
        await this.repository.updateDocument(documentId, { syncStatus: 'uploading', syncError: null });
        const digest = await sha256Hex(file);
        const session = await this.uploadApi.createUploadSession(document, file, digest);
        if (session.status !== 'verified') {
          onProgress({ documentId, status: 'uploading' });
          await this.uploadApi.uploadObject(session, file);
          onProgress({ documentId, status: 'verifying' });
          await this.uploadApi.commit(documentId, session.objectId);
        }
        await this.repository.updateDocument(documentId, {
          syncStatus: 'synced', cloudOwnerId: userId, cloudObjectId: session.objectId, syncError: null
        });
        onProgress({ documentId, status: 'synced' });
        results.push({ documentId, status: 'synced' });
      } catch (error) {
        await this.repository.updateDocument(documentId, { syncStatus: 'failed', syncError: error.message });
        onProgress({ documentId, status: 'failed', error: error.message });
        results.push({ documentId, status: 'failed', error });
      }
    }
    return results;
  }
}
