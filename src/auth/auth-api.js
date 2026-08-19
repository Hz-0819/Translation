export class AuthApi {
  constructor({ baseUrl = 'http://localhost:8787', fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...options.headers }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.message || `请求失败（${response.status}）`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  register(credentials) {
    return this.request('/api/auth/register', { method: 'POST', body: JSON.stringify(credentials) });
  }

  login(credentials) {
    return this.request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
  }

  refresh() {
    return this.request('/api/auth/refresh', { method: 'POST' });
  }

  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }
}
