// Lazy JSON loading + derived helpers for tests, grammar and vocab cards.
// Data lives in data/<course>/<level>/…; a test's key is "<level>-<id>", e.g. "N3-1" or "N4-t1".
import { COURSE, level as currentLevel, levelOf } from './courses.js';

const cache = new Map();
export async function load(path) {
  if (!cache.has(path)) cache.set(path, fetch(path).then(r => { if (!r.ok) throw new Error(path); return r.json(); }));
  try { return await cache.get(path); } catch (e) { cache.delete(path); throw e; }
}
const base = L => `data/${COURSE}/${L}`;

export const courses = () => load('data/courses.json');
export const examIndex = (L = currentLevel()) => load(`${base(L)}/exams/index.json`);
/** Load a test by key ("N3-1"). */
export async function exam(key) {
  const [L, id] = String(key).split('-');
  const ex = await load(`${base(L)}/exams/${id}.json`);
  ex.key = `${L}-${ex.id}`;
  return ex;
}
export async function grammar(L = currentLevel()) {
  const [g, id] = await Promise.all([load(`${base(L)}/grammar.json`), load(`${base(L)}/grammar.id.json`).catch(() => ({}))]);
  g.forEach(x => { x.level = L; if (id[x.id]) x.meaning.id = id[x.id]; });
  return g;
}

export const SECTIONS = ['vocab', 'grammar_reading', 'listening'];

/** Flatten a section into numbered questions with stable ids + JLPT part. */
export function flatten(ex, section) {
  const sec = ex.sections[section];
  if (!sec) return [];
  const out = [];
  let reading = false;
  sec.groups.forEach((g, gi) => {
    // older data had no part tag: fall back to the 読解 header
    if (!g.part && section === 'grammar_reading' && /読解/.test(g.instruction)) reading = true;
    const part = g.part || (section === 'listening' ? 'listen' : reading ? 'read' : 'lang');
    g.questions.forEach((q, qi) => {
      out.push({ ...q, gi, qi, id: `${ex.key}.${section}.${gi}.${qi}`, exam: ex.key, section, part,
        passageHtml: q.passage != null ? sec.passages[q.passage] : null, n: out.length + 1 });
    });
  });
  return out;
}

/** Parse a question id back to its parts. */
export const parseQid = qid => { const [exam, section, gi, qi] = qid.split('.'); return { exam, level: levelOf(exam), section, gi: +gi, qi: +qi }; };

/** Build flashcards from the vocabulary groups of every test in a level. */
export async function vocabCards(L = currentLevel()) {
  const ck = 'cards:' + L;
  if (cache.has(ck)) return cache.get(ck);
  const idx = await examIndex(L);
  const exams = await Promise.all(idx.exams.map(e => exam(`${L}-${e.id}`)));
  const fallback = ['reading', 'writing', 'context', 'synonym', 'usage'];
  const cards = [];
  const underlined = h => (h.match(/<u>(.*?)<\/u>/) || [])[1]?.replace(/<[^>]+>/g, '').trim();
  const cleanStem = h => h.replace(/^\s*\d+[.．]\s*/, '');
  for (const ex of exams) {
    const sec = ex.sections.vocab; if (!sec) continue;
    sec.groups.forEach((g, gi) => {
      const type = 'card' in g || g.part ? g.card : fallback[gi];
      if (!type) return;
      g.questions.forEach((q, qi) => {
        const ans = q.options[q.answer - 1]; if (!ans) return;
        const u = underlined(q.stem);
        const ctx = cleanStem(q.stem);
        let front, back;
        if (type === 'reading') { if (!u) return; front = u; back = ans; }
        else if (type === 'writing') { if (!u) return; front = ans; back = u; }
        else if (type === 'synonym') { if (!u) return; front = u; back = ans; }
        else if (type === 'context') { front = ctx.replace(/[（(]\s*[　 ]*\s*[)）]/, '（　　）'); back = ans; }
        else if (type === 'usage') { front = u || ctx; back = ans; }
        cards.push({ id: `${ex.key}.vocab.${gi}.${qi}`, type, front, back, ctx, exam: ex.key });
      });
    });
  }
  cache.set(ck, cards);
  return cards;
}

/** Score answers for a list of questions → totals and per-part points. */
export function score(qs, answers) {
  const parts = {};
  let correct = 0, points = 0, max = 0;
  for (const q of qs) {
    const p = parts[q.part] || (parts[q.part] = { points: 0, max: 0, c: 0, t: 0 });
    p.max += q.points; p.t++; max += q.points;
    if (answers[q.id] === q.answer) { p.points += q.points; p.c++; points += q.points; correct++; }
  }
  return { correct, total: qs.length, points, max, parts };
}
