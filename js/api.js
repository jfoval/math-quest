// Tiny dependency-free Supabase client (GoTrue auth + PostgREST). Only what the app needs.
import { SUPABASE } from './config.js';

const KID_DOMAIN = '@kids.mathquest.app';
const SESSION_KEY = 'mq.session', DEVICES_KEY = 'mq.devices';
export const kidEmail = u => u.trim().toLowerCase() + KID_DOMAIN;
export const isKidEmail = e => (e || '').endsWith(KID_DOMAIN);

class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

export const api = {
  session: null,
  enabled() { return !!(SUPABASE.url && SUPABASE.key); },
  load() { try { this.session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { this.session = null; } return this.session; },
  setSession(s) { this.session = s; if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); },
  userId() { return this.session?.user?.id || null; },

  async fetch(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
    if (auth && this.session && this.session.expires_at * 1000 < Date.now() + 60e3) await this.refresh();
    const h = { apikey: SUPABASE.key, 'Content-Type': 'application/json', ...headers };
    h.Authorization = 'Bearer ' + (auth && this.session ? this.session.access_token : SUPABASE.key);
    let res;
    try { res = await fetch(SUPABASE.url.replace(/\/+$/, '') + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new ApiError('offline', 0); }
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) {
      const msg = json?.msg || json?.message || json?.error_description || json?.error || json?.hint || text || res.statusText;
      throw new ApiError(friendly(msg), res.status);
    }
    return json;
  },

  // ---- auth ----
  async signUp(email, password, data = {}) {
    const r = await this.fetch('/auth/v1/signup', { method: 'POST', body: { email, password, data }, auth: false });
    if (!r.access_token) throw new ApiError('Email confirmation is turned on in Supabase — please turn it off (Authentication → Providers → Email → Confirm email).', 400);
    return normalizeSession(r);
  },
  async signIn(email, password) {
    const r = await this.fetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
    return normalizeSession(r);
  },
  refreshing: null,
  async refresh() {
    if (!this.session?.refresh_token) return null;
    if (this.refreshing) return this.refreshing;   // coalesce concurrent refreshes (tokens rotate; a second call would fail)
    this.refreshing = (async () => {
      try {
        const r = await this.fetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: this.session.refresh_token }, auth: false });
        this.setSession(normalizeSession(r)); rememberDevice(this.session); return this.session;
      } catch (e) { if (e.status === 400 || e.status === 401) this.setSession(null); throw e; }
      finally { this.refreshing = null; }
    })();
    return this.refreshing;
  },
  async updatePassword(password) { return this.fetch('/auth/v1/user', { method: 'PUT', body: { password } }); },
  // Session from a password-recovery link (#access_token=…&type=recovery)
  sessionFromHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (!h.get('access_token')) return null;
    const s = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + (+h.get('expires_in') || 3600), user: null, type: h.get('type') };
    history.replaceState(null, '', location.pathname); return s;
  },
  async signOut() { const uid = this.userId(); try { if (this.session) await this.fetch('/auth/v1/logout', { method: 'POST' }); } catch {} this.setSession(null); if (uid) forgetDevice(uid); },
  // Switch to a user remembered on this device using their refresh token.
  async resume(userId) {
    const d = devices().find(x => x.user_id === userId); if (!d) throw new ApiError('not remembered', 404);
    const r = await this.fetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: d.refresh_token }, auth: false });
    this.setSession(normalizeSession(r)); rememberDevice(this.session); return this.session;
  },

  // ---- data ----
  async rpc(name, args = {}) { return this.fetch('/rest/v1/rpc/' + name, { method: 'POST', body: args }); },
  async select(table, query = '') { return this.fetch(`/rest/v1/${table}?${query}`); },
  async upsert(table, rows) { return this.fetch(`/rest/v1/${table}`, { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }); },
  async update(table, query, patch) { return this.fetch(`/rest/v1/${table}?${query}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=minimal' } }); },
};

function normalizeSession(r) {
  const s = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: r.user };
  return s;
}
function friendly(msg) {
  msg = String(msg || 'Something went wrong');
  if (/invalid login credentials/i.test(msg)) return 'Wrong username or password';
  if (/already registered|already been registered/i.test(msg)) return 'That email already has an account';
  if (/password should be at least/i.test(msg)) return 'Password is too short';
  if (/rate limit/i.test(msg)) return 'Too many tries — wait a minute';
  return msg.replace(/^(P\d{4}|\d{5}):\s*/, '');
}

// ---- users remembered on this device ("Who's playing?") ----
export function devices() { try { return JSON.parse(localStorage.getItem(DEVICES_KEY)) || []; } catch { return []; } }
export function rememberDevice(session, profile) {
  if (!session?.user) return;
  const list = devices().filter(d => d.user_id !== session.user.id);
  const old = devices().find(d => d.user_id === session.user.id) || {};
  list.push({ ...old, ...(profile || {}), user_id: session.user.id, refresh_token: session.refresh_token, email: session.user.email, at: Date.now() });
  localStorage.setItem(DEVICES_KEY, JSON.stringify(list));
}
export function forgetDevice(userId) { localStorage.setItem(DEVICES_KEY, JSON.stringify(devices().filter(d => d.user_id !== userId))); }
export function updateDeviceProfile(userId, profile) { const list = devices(); const d = list.find(x => x.user_id === userId); if (d) { Object.assign(d, profile); localStorage.setItem(DEVICES_KEY, JSON.stringify(list)); } }
