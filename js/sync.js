// Optional Family Sync via a Supabase project (free tier is plenty). See README "Family Sync".
// The app only ever calls two RPC functions (mq_get / mq_put) with a family code; the table itself is not exposed.
const SYNC_KEY = 'mathquest.sync';
const KID_FIELDS_IGNORED = new Set(['updated']);

export const sync = {
  cfg: null, status: { state: 'off', at: 0, error: '' }, timer: null, onChange: null,
  load() { try { this.cfg = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch { this.cfg = null; } this.status.state = this.configured() ? 'idle' : 'off'; return this.cfg; },
  saveCfg(cfg) { this.cfg = cfg; if (cfg) localStorage.setItem(SYNC_KEY, JSON.stringify(cfg)); else localStorage.removeItem(SYNC_KEY); this.status = { state: this.configured() ? 'idle' : 'off', at: 0, error: '' }; },
  configured() { return !!(this.cfg && this.cfg.url && this.cfg.key && this.cfg.code); },

  async rpc(name, body) {
    const url = this.cfg.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + name;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: this.cfg.key, Authorization: 'Bearer ' + this.cfg.key }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${name} failed (${res.status}): ${(await res.text()).slice(0, 120)}`);
    const text = await res.text(); return text ? JSON.parse(text) : null;
  },
  async pull() { return this.rpc('mq_get', { p_code: this.cfg.code }); },
  async push(data) { return this.rpc('mq_put', { p_code: this.cfg.code, p_data: exportable(data) }); },

  // Debounced push after local changes.
  schedulePush(getData) {
    if (!this.configured()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try { this.status = { state: 'syncing', at: this.status.at, error: '' }; this.onChange?.(); await this.push(getData()); this.status = { state: 'ok', at: Date.now(), error: '' }; }
      catch (e) { this.status = { state: 'error', at: this.status.at, error: e.message }; }
      this.onChange?.();
    }, 1500);
  },

  // Pull remote, merge into local. Returns true if local data changed.
  async pullAndMerge(data) {
    if (!this.configured()) return false;
    try {
      this.status = { state: 'syncing', at: this.status.at, error: '' }; this.onChange?.();
      const remote = await this.pull();
      const { merged, localChanged, remoteStale } = merge(data, remote);
      Object.assign(data, merged);
      stampChanged(data, 0); // remember merged content so the next local save doesn't re-stamp remote kids
      if (remoteStale) await this.push(data);
      this.status = { state: 'ok', at: Date.now(), error: '' }; this.onChange?.();
      return localChanged;
    } catch (e) { this.status = { state: 'error', at: this.status.at, error: e.message }; this.onChange?.(); return false; }
  },
};

function exportable(data) { const { currentKid, settings, ...rest } = data; return rest; }

// Stamp kids whose content changed since last save with a fresh `updated` timestamp.
const lastHash = new Map();
export function stampChanged(data, now = Date.now()) {
  for (const k of data.kids) {
    const h = JSON.stringify(k, (key, v) => KID_FIELDS_IGNORED.has(key) ? undefined : v);
    if (lastHash.get(k.id) !== h) { if (now) k.updated = now; else k.updated ||= 0; lastHash.set(k.id, h); }
  }
}

// Per-kid last-write-wins; deleted kids stay deleted via a tombstone list.
export function merge(local, remote) {
  let localChanged = false, remoteStale = false;
  if (!remote || !Array.isArray(remote.kids)) return { merged: local, localChanged, remoteStale: true };
  const deleted = new Set([...(local.deleted || []), ...(remote.deleted || [])]);
  const byId = new Map();
  for (const k of remote.kids) byId.set(k.id, { k, from: 'remote' });
  for (const k of local.kids) {
    const r = byId.get(k.id);
    if (!r) { byId.set(k.id, { k, from: 'local' }); remoteStale = true; }
    else if ((k.updated || 0) > (r.k.updated || 0)) { byId.set(k.id, { k, from: 'local' }); remoteStale = true; }
    else if ((k.updated || 0) < (r.k.updated || 0)) localChanged = true;
  }
  for (const [id, v] of byId) if (deleted.has(id)) { byId.delete(id); if (v.from === 'remote') remoteStale = true; else localChanged = true; }
  const kids = [...byId.values()].map(v => v.k).sort((a, b) => (a.created || 0) - (b.created || 0));
  if (kids.some(k => !local.kids.includes(k)) || kids.length !== local.kids.length) localChanged = true;
  let parentPin = local.parentPin || remote.parentPin || null;
  if (parentPin !== local.parentPin) localChanged = true;
  if (parentPin !== remote.parentPin) remoteStale = true;
  if ((remote.deleted || []).some(id => !(local.deleted || []).includes(id))) localChanged = true;
  if ((local.deleted || []).some(id => !(remote.deleted || []).includes(id))) remoteStale = true;
  return { merged: { ...local, kids, parentPin, deleted: [...deleted] }, localChanged, remoteStale };
}
