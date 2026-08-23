// Local-first persistence. Everything lives in localStorage under one key.
// Designed so a cloud sync layer can be dropped in later (data is a single JSON blob).

const KEY = 'mathquest.v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const AVATARS = ['🦊','🐯','🐼','🦄','🐸','🐙','🦖','🐨','🦁','🐶','🐱','🐵','🦉','🐬','🐲','🤖','👾','🦋'];

export function normalizeKid(k) {
  k.ops ||= {}; k.history ||= []; if (!Array.isArray(k.unlocked) || !k.unlocked.length) k.unlocked = ['add'];
  k.streak ||= { count: 0, last: '' }; k.daily ||= { date: '', missions: 0 }; k.badges ||= []; k.opMissions ||= {}; k.best ||= {};
  k.stars ||= 0; k.xp ||= 0; k.missions ||= 0;
  k.owned ||= { hats: ['none'], faces: ['smile'] }; k.base ||= { items: [] };
  return k;
}

export const store = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(KEY)); } catch { this.data = null; }
    if (!this.data) this.data = { kids: [], parentPin: null, settings: { sound: true }, currentKid: null };
    this.data.settings ||= { sound: true };
    for (const k of this.data.kids) normalizeKid(k);
    return this.data;
  },
  onSave: null, // set by the account layer to push changed kids
  save(opts = {}) {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.saveError = null; if (!opts.noPush && this.onSave) this.onSave(this.data.kids.map(k => k.id)); }
    catch (e) { this.saveError = e; console.error('save failed', e); document.dispatchEvent(new CustomEvent('mq:saveerror')); }
  },
  kids() { return this.data.kids; },
  kid(id) { return this.data.kids.find(k => k.id === id); },
  addKid({ name, avatar, pin }) {
    const kid = {
      id: uid(), name, avatar, pin: pin || '', created: Date.now(),
      stars: 0, xp: 0, missions: 0, unlocked: ['add'], ops: {}, history: [], best: { lightning: 0 },
    };
    normalizeKid(kid); this.data.kids.push(kid); this.save(); return kid;
  },
  removeKid(id) { this.data.kids = this.data.kids.filter(k => k.id !== id); this.save(); },
  exportJSON() { const { settings, currentKid, ...rest } = this.data; return JSON.stringify(rest, null, 2); },
  importJSON(json) {
    const d = JSON.parse(json);
    if (!d || !Array.isArray(d.kids)) throw new Error('Not a Math Quest backup file');
    d.settings ||= this.data.settings; for (const k of d.kids) normalizeKid(k); this.data = d; this.save();
  },
};
