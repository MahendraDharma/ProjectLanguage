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
  settings: { lang: 'id', theme: 'dark', examDate: nextJlptDate(), furigana: true, rate: 0.95, voice: '', dailyGoal: 20 },
  sessions: {},    // "exam/section/mode" -> { answers: {qid: n}, startedAt, deadline, submitted }
  attempts: [],    // { exam, section, mode, date, correct, total, points, max, parts }
  mistakes: {},    // qid -> { count, last }
  srs: {},         // cardId -> { box, due }
  learned: {},     // grammar id -> true
  days: {},        // 'YYYY-MM-DD' -> answers count
  stats: {},       // section -> { c, t }
});

let state;
try { state = Object.assign(DEFAULT(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
catch { state = DEFAULT(); }
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
  import(json) { const d = JSON.parse(json); if (!d || typeof d !== 'object' || !d.settings) throw new Error('bad'); state = Object.assign(DEFAULT(), d); this.save(); },
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
  const st = state.stats[section] || (state.stats[section] = { c: 0, t: 0 });
  st.t++; if (ok) st.c++;
  if (ok) { if (state.mistakes[qid]) delete state.mistakes[qid]; }
  else { const m = state.mistakes[qid] || { count: 0 }; m.count++; m.last = Date.now(); state.mistakes[qid] = m; }
  logActivity(1);
}
