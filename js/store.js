// Progress persistence (localStorage). Everything wrapped in try/catch so the
// site still works in private mode / with storage blocked.
const KEY = 'michi.v1';

function nextJlptDate() {
  // JLPT runs on the first Sunday of July and December.
  const now = new Date();
  const cands = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) for (const m of [6, 11]) {
    const d = new Date(y, m, 1); d.setDate(1 + ((7 - d.getDay()) % 7)); cands.push(d);
  }
  const d = cands.find(d => d >= new Date(now.toDateString())) || cands[cands.length - 1];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT = () => ({
  settings: { level: 'N3', lang: 'id', theme: 'dark', examDate: nextJlptDate(), furigana: true, rate: 0.95, voice: '', dailyGoal: 20 },
  v: 2,
  sessions: {},    // "N3-1/section/mode" -> { answers: {qid: n}, startedAt, deadline, submitted }
  attempts: [],    // { exam, section, mode, date, correct, total, points, max, parts }
  mistakes: {},    // qid -> { count, last }
  srs: {},         // cardId -> { box, due }
  learned: {},     // "N3/slug" -> true
  days: {},        // 'YYYY-MM-DD' -> answers count
  stats: {},       // "N3:section" -> { c, t }
});

let state;
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  state = raw ? migrate(raw) : DEFAULT();
} catch { state = DEFAULT(); }

/** v1 (N3 only) → v2 (levels): prefix every test id with its level. */
function migrate(d) {
  if ((d.v || 1) < 2) {
    const fix = id => /^\d/.test(String(id)) ? `N3-${id}` : String(id);
    const rekey = (o, f) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [f(k), v]));
    d.sessions = rekey(d.sessions, fix);
    Object.values(d.sessions).forEach(v => { v.answers = rekey(v.answers, fix); });
    d.mistakes = rekey(d.mistakes, fix);
    d.srs = rekey(d.srs, fix);
    d.learned = rekey(d.learned, k => k.includes('/') ? k : `N3/${k}`);
    d.stats = rekey(d.stats, k => k.includes(':') ? k : `N3:${k}`);
    (d.attempts || []).forEach(a => { a.exam = fix(a.exam); });
    d.settings = { level: 'N3', ...(d.settings || {}) };
    d.v = 2;
  }
  return Object.assign(DEFAULT(), d);
}
state.settings = Object.assign(DEFAULT().settings, state.settings);
// v2 design: dark is the default unless the theme was picked by hand
if (!state.settings.themeChosen) state.settings.theme = 'dark';

const listeners = new Set();
export const store = {
  get s() { return state; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} listeners.forEach(f => f()); },
  on(f) { listeners.add(f); return () => listeners.delete(f); },
  reset() { state = DEFAULT(); this.save(); },
  export() { return JSON.stringify(state, null, 1); },
  import(json) { const d = JSON.parse(json); if (!d || typeof d !== 'object' || !d.settings) throw new Error('bad'); state = migrate(d); state.settings = Object.assign(DEFAULT().settings, state.settings); this.save(); },
};

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function logActivity(n = 1) { const k = today(); state.days[k] = (state.days[k] || 0) + n; }

export function streak() {
  let n = 0; const d = new Date();
  const key = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!state.days[key(d)]) d.setDate(d.getDate() - 1); // today not studied yet: streak still alive
  while (state.days[key(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function recordAnswer(qid, section, ok) {
  const k = `${qid.split('-')[0]}:${section}`;
  const st = state.stats[k] || (state.stats[k] = { c: 0, t: 0 });
  st.t++; if (ok) st.c++;
  if (ok) { if (state.mistakes[qid]) delete state.mistakes[qid]; }
  else { const m = state.mistakes[qid] || { count: 0 }; m.count++; m.last = Date.now(); state.mistakes[qid] = m; }
  logActivity(1);
}
