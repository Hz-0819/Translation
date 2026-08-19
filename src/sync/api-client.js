export class SyncApiClient {
  constructor({ baseUrl = 'http://localhost:8787', getAccessToken }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getAccessToken = getAccessToken;
  }

  async request(path, options = {}) {
    const token = await this.getAccessToken?.();
    if (!token) throw new Error('not_authenticated');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`sync_http_${response.status}`);
    return response.json();
  }

  pushOperations(operations) {
    return this.request('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        operations: operations.map(operation => ({
          id: operation.id,
          documentId: operation.documentId,
          layerId: operation.layerId || null,
          type: operation.type,
          payload: operation.payload,
          createdAt: new Date(operation.createdAt).toISOString()
        }))
      })
    });
  }

  pullOperations(cursor, limit = 100) {
    return this.request(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=${limit}`);
  }
}
