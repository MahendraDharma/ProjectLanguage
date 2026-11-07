// Lazy JSON loading + derived helpers for exams, grammar and vocab cards.
const cache = new Map();
export async function load(path) {
  if (!cache.has(path)) cache.set(path, fetch(path).then(r => { if (!r.ok) throw new Error(path); return r.json(); }));
  try { return await cache.get(path); } catch (e) { cache.delete(path); throw e; }
}
export const examIndex = () => load('data/exams/index.json');
export const exam = id => load(`data/exams/${id}.json`);
export async function grammar() {
  const [g, id] = await Promise.all([load('data/grammar.json'), load('data/grammar.id.json').catch(() => ({}))]);
  g.forEach(x => { if (id[x.id]) x.meaning.id = id[x.id]; });
  return g;
}

export const SECTIONS = ['vocab', 'grammar_reading', 'listening'];
export const KANJI = { vocab: '語', grammar_reading: '文', listening: '聴' };
// Official N3 timing (minutes)
export const MINUTES = { vocab: 30, grammar_reading: 70, listening: 40 };

/** Flatten a section into numbered questions with stable ids + JLPT part. */
export function flatten(ex, section) {
  const sec = ex.sections[section];
  if (!sec) return [];
  const out = [];
  let reading = false;
  sec.groups.forEach((g, gi) => {
    if (section === 'grammar_reading' && /読解/.test(g.instruction)) reading = true;
    g.questions.forEach((q, qi) => {
      out.push({ ...q, gi, qi, id: `${ex.id}.${section}.${gi}.${qi}`, exam: ex.id, section,
        part: section === 'listening' ? 'listen' : (reading ? 'read' : 'lang'),
        passageHtml: q.passage != null ? sec.passages[q.passage] : null, n: out.length + 1 });
    });
  });
  return out;
}

/** Parse qid back to its parts. */
export const parseQid = qid => { const [exam, section, gi, qi] = qid.split('.'); return { exam: +exam, section, gi: +gi, qi: +qi }; };

/** Build flashcards from the vocabulary section of every exam. */
export async function vocabCards() {
  if (cache.has('cards')) return cache.get('cards');
  const idx = await examIndex();
  const exams = await Promise.all(idx.exams.map(e => exam(e.id)));
  const types = ['reading', 'writing', 'context', 'synonym', 'usage'];
  const cards = [];
  const underlined = h => (h.match(/<u>(.*?)<\/u>/) || [])[1]?.replace(/<[^>]+>/g, '').trim();
  const cleanStem = h => h.replace(/^\s*\d+[.．]\s*/, '');
  for (const ex of exams) {
    const sec = ex.sections.vocab; if (!sec) continue;
    sec.groups.forEach((g, gi) => {
      const type = types[gi]; if (!type) return;
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
        cards.push({ id: `${ex.id}.vocab.${gi}.${qi}`, type, front, back, ctx, exam: ex.id });
      });
    });
  }
  cache.set('cards', cards);
  return cards;
}

/** Score a set of answers for a section → per-part points */
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
