// Family accounts: parents (email) and kids (username) linked to one family. Progress lives in `progress.data`.
import { api, kidEmail, devices, rememberDevice, forgetDevice, updateDeviceProfile } from './api.js';
import { store, normalizeKid } from './store.js';

const PROFILE_FIELDS = new Set(['id', 'name', 'avatar', 'username', 'pin', 'role', 'updated', 'pulledAt']);

export const account = {
  me: null, family: null, members: [], status: { state: 'idle', error: '' }, pushTimer: null, dirty: new Set(),
  enabled() { return api.enabled(); },
  isParent() { return this.me?.role === 'parent'; },
  isKid() { return this.me?.role === 'kid'; },

  // Call after any sign-in / resume. Loads member row (+family). Returns 'ok' | 'nofamily'.
  async loadSelf() {
    const uid = api.userId(); if (!uid) { this.me = null; return 'none'; }
    const rows = await api.select('members', `user_id=eq.${uid}&select=*`);
    this.me = rows[0] || null;
    if (!this.me) return 'nofamily';
    rememberDevice(api.session, { name: this.me.name, avatar: this.me.avatar, role: this.me.role, username: this.me.username });
    const fam = await api.select('families', `id=eq.${this.me.family_id}&select=*`); this.family = fam[0] || null;
    return 'ok';
  },

  // ---- parent flows ----
  async signUpParent({ email, password, name, familyName, inviteCode }) {
    const s = await api.signUp(email, password, { name }); api.setSession(s);
    if (inviteCode) await api.rpc('join_family', { p_code: inviteCode, p_parent_name: name });
    else await api.rpc('create_family', { p_name: familyName, p_parent_name: name });
    return this.loadSelf();
  },
  async signInParent(email, password) { api.setSession(await api.signIn(email, password)); return this.loadSelf(); },
  async createOrJoinFamily({ name, familyName, inviteCode }) {
    if (inviteCode) await api.rpc('join_family', { p_code: inviteCode, p_parent_name: name });
    else await api.rpc('create_family', { p_name: familyName, p_parent_name: name });
    return this.loadSelf();
  },
  async loadFamily() { // parent: all members + progress
    this.members = await api.select('members', `family_id=eq.${this.me.family_id}&select=*&order=created_at`);
    const prog = await api.select('progress', `select=user_id,data,updated_at`);
    const byId = Object.fromEntries(prog.map(p => [p.user_id, p]));
    const kids = [];
    for (const m of this.members.filter(m => m.role === 'kid')) kids.push(applyRemote(localKid(m), byId[m.user_id]));
    store.data.kids = kids; store.save({ noPush: true });
    return kids;
  },
  async addKid({ username, password, name, avatar }) {
    username = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,20}$/.test(username)) throw new Error('Username: 3–20 letters, numbers, _ . -');
    if (password.length < 4) throw new Error('Password must be at least 4 characters');
    if (await api.rpc('username_taken', { p_username: username })) throw new Error('That username is taken');
    const parentSession = api.session;
    const s = await api.signUp(kidEmail(username), password, { name, role: 'kid' });   // creates the kid's auth user
    api.setSession(parentSession);                                                    // stay signed in as parent
    await api.rpc('add_kid', { p_user_id: s.user.id, p_username: username, p_name: name, p_avatar: avatar });
    return this.loadFamily();
  },
  async setKidPassword(userId, password) { await api.rpc('set_kid_password', { p_user_id: userId, p_password: password }); },
  async deleteKid(userId) { await api.rpc('delete_kid', { p_user_id: userId }); forgetDevice(userId); return this.loadFamily(); },
  async updateKidProfile(userId, patch) { await api.update('members', `user_id=eq.${userId}`, patch); updateDeviceProfile(userId, patch); return this.loadFamily(); },
  async renameFamily(name) { await api.update('families', `id=eq.${this.me.family_id}`, { name }); this.family.name = name; },

  // ---- kid flows ----
  async signInKid(username, password) { api.setSession(await api.signIn(kidEmail(username), password)); return this.loadSelf(); },
  async resume(userId) { await api.resume(userId); return this.loadSelf(); },
  async loadMyProgress() { // kid (or parent acting on self): pull own blob into store
    const uid = api.userId();
    const rows = await api.select('progress', `user_id=eq.${uid}&select=user_id,data,updated_at`);
    const local = store.kid(uid) || localKid(this.me);
    const kid = applyRemote(local, rows[0]);
    if (!store.kid(uid)) store.data.kids.push(kid);
    store.data.currentKid = uid; store.save({ noPush: true });
    return kid;
  },

  // ---- progress push (debounced; called by store.save) ----
  schedulePush(kidIds) {
    if (!this.enabled() || !api.session) return;
    if (this.isKid()) kidIds = kidIds.filter(id => id === this.me.user_id); // kids may only save their own progress
    kidIds.forEach(id => this.dirty.add(id));
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.flush(), 1200);
  },
  async flush() {
    if (!this.dirty.size || !api.session) return;
    const ids = [...this.dirty]; this.dirty.clear();
    const rows = ids.map(id => store.kid(id)).filter(Boolean).map(k => ({ user_id: k.id, data: blobOf(k), updated_at: new Date().toISOString() }));
    if (!rows.length) return;
    try { await api.upsert('progress', rows); this.status = { state: 'ok', error: '' }; for (const k of rows) { const kid = store.kid(k.user_id); if (kid) kid.pulledAt = Date.now(); } }
    catch (e) { ids.forEach(id => this.dirty.add(id)); this.status = { state: e.status === 0 ? 'offline' : 'error', error: e.message }; setTimeout(() => this.flush(), 15000); }
    document.dispatchEvent(new CustomEvent('mq:sync'));
  },
  async signOut() { await api.signOut(); this.me = null; this.family = null; this.members = []; },
};

export function localKid(m) { return normalizeKid({ id: m.user_id, name: m.name, avatar: m.avatar, username: m.username, role: 'kid', ops: {}, history: [], stars: 0, xp: 0 }); }
function blobOf(k) { const o = {}; for (const [key, v] of Object.entries(k)) if (!PROFILE_FIELDS.has(key)) o[key] = v; return o; }
// Remote wins if it was updated after the last time this device pulled or pushed.
function applyRemote(kid, row) {
  if (row && row.data && Object.keys(row.data).length) {
    const remoteAt = Date.parse(row.updated_at) || 0;
    if (!kid.pulledAt || remoteAt >= kid.pulledAt || !kid.history?.length) { const prof = { id: kid.id, name: kid.name, avatar: kid.avatar, username: kid.username, role: 'kid' }; Object.assign(kid, row.data, prof); normalizeKid(kid); }
    kid.pulledAt = Date.now();
  } else kid.pulledAt = kid.pulledAt || Date.now();
  return kid;
}
export { devices, forgetDevice };
