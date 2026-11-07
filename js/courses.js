// Course + level configuration. A course is a language (only Japanese for now);
// each level carries its own timing and JLPT scoring rules.
import { t } from './i18n.js';
import { store } from './store.js';

export const COURSE = 'ja';
export const LEVEL_IDS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const THREE_PARTS = [
  { key: 'lang', parts: ['lang'], max: 60, min: 19 },
  { key: 'read', parts: ['read'], max: 60, min: 19 },
  { key: 'listen', parts: ['listen'], max: 60, min: 19 },
];
const TWO_PARTS = [
  { key: 'langread', parts: ['lang', 'read'], max: 120, min: 38 },
  { key: 'listen', parts: ['listen'], max: 60, min: 19 },
];

/** Official JLPT pass marks and section times. N1/N2 combine language knowledge and
 *  reading into one 110/105-minute paper; the split below between the site's two
 *  pages is an estimate. */
export const LEVELS = {
  N5: { pass: 80, minutes: { vocab: 20, grammar_reading: 40, listening: 30 }, scoring: TWO_PARTS, split: false },
  N4: { pass: 90, minutes: { vocab: 25, grammar_reading: 55, listening: 35 }, scoring: TWO_PARTS, split: false },
  N3: { pass: 95, minutes: { vocab: 30, grammar_reading: 70, listening: 40 }, scoring: THREE_PARTS, split: false },
  N2: { pass: 90, minutes: { vocab: 40, grammar_reading: 65, listening: 50 }, scoring: THREE_PARTS, split: true },
  N1: { pass: 100, minutes: { vocab: 50, grammar_reading: 60, listening: 55 }, scoring: THREE_PARTS, split: true },
};

export const level = () => (LEVELS[store.s.settings.level] ? store.s.settings.level : 'N3');
export const levelOf = examKey => String(examKey).split('-')[0];

/** Section label. On N1/N2 the site's first page is vocab + grammar, the second is reading. */
export function secLabel(key, L = level()) {
  if (LEVELS[L]?.split) {
    if (key === 'vocab') return t('sec_langall');
    if (key === 'grammar_reading') return t('sec_reading');
  }
  return t('sec_' + key);
}
export function secKanji(key, L = level()) {
  if (LEVELS[L]?.split) return { vocab: '言', grammar_reading: '読', listening: '聴' }[key];
  return { vocab: '語', grammar_reading: '文', listening: '聴' }[key];
}

/** "Set 3" for JLPT mock tests, "Practice test 1" for the site's practice tests,
 *  "OpenJLPT 1" for tests generated from the OpenJLPT dataset. */
export function testName(e) {
  const id = String(e.id ?? e);
  if (id.startsWith('t')) return t('practice_n', { n: id.slice(1) });
  if (id.startsWith('o')) return t('open_n', { n: id.slice(1) });
  return t('test_n', { n: id });
}
export function testNameFromKey(key) { return testName(String(key).split('-')[1]); }

/** Convert raw part points into JLPT-style scaled section scores for a level. */
export function scaled(L, partSums) {
  return LEVELS[L].scoring.map(sc => {
    let p = 0, m = 0;
    sc.parts.forEach(k => { if (partSums[k]) { p += partSums[k].points; m += partSums[k].max; } });
    return { ...sc, score: m ? Math.round(p / m * sc.max) : null };
  });
}
