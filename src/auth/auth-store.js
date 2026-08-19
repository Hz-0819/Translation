export class AuthStore {
  constructor(api) {
    this.api = api;
    this.user = null;
    this.accessToken = null;
    this.listeners = new Set();
  }

  snapshot() {
    return { user: this.user, accessToken: this.accessToken, authenticated: Boolean(this.user && this.accessToken) };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.snapshot();
    this.listeners.forEach(listener => listener(state));
  }

  accept(session) {
    this.user = session.user;
    this.accessToken = session.accessToken;
    this.notify();
    return this.snapshot();
  }

  async bootstrap() {
    try { return this.accept(await this.api.refresh()); }
    catch { this.clear(); return this.snapshot(); }
  }

  async register(credentials) {
    return this.accept(await this.api.register(credentials));
  }

  async login(credentials) {
    return this.accept(await this.api.login(credentials));
  }

  async logout() {
    try { await this.api.logout(); }
    finally { this.clear(); }
  }

  clear() {
    this.user = null;
    this.accessToken = null;
    this.notify();
  }
}
