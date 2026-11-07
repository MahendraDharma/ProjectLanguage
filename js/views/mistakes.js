import { t } from '../i18n.js';
import { store, recordAnswer } from '../store.js';
import { icon, esc, stripHtml, toast } from '../util.js';
import { exam, flatten, parseQid, KANJI } from '../data.js';
import { questionHtml, bindListening } from './questions.js';

async function loadMistakes() {
  const ids = Object.keys(store.s.mistakes);
  const exams = [...new Set(ids.map(id => parseQid(id).exam))];
  const loaded = Object.fromEntries(await Promise.all(exams.map(async e => [e, await exam(e)])));
  const flat = {};
  const out = [];
  for (const id of ids) {
    const { exam: e, section } = parseQid(id);
    const k = e + section;
    flat[k] = flat[k] || flatten(loaded[e], section);
    const q = flat[k].find(x => x.id === id);
    if (q) out.push(q); else delete store.s.mistakes[id];
  }
  return out.sort((a, b) => (store.s.mistakes[b.id].count - store.s.mistakes[a.id].count) || (store.s.mistakes[b.id].last - store.s.mistakes[a.id].last));
}

export async function mistakes(main) {
  const qs = await loadMistakes();
  main.innerHTML = `<div class="page">
    <header class="page-head"><span class="eyebrow">復習 · ${qs.length}</span>
      <div class="row between"><h1 class="h1">${t('mistakes_title')}</h1>
      ${qs.length ? `<a class="btn primary" href="#/mistakes/practice">${icon('play')}${t('practice_all')}</a>` : ''}</div>
      <p class="lede">${t('mistakes_lede')}</p></header>
    ${qs.length ? `<section class="card"><div class="list">${qs.map(q => `
      <a class="row" style="color:inherit;text-decoration:none;flex-wrap:nowrap" href="#/exam/${q.exam}/${q.section}?mode=practice">
        <span class="jp" lang="ja" style="font-weight:700;width:24px;color:var(--ink-3);flex:none">${KANJI[q.section]}</span>
        <span class="stack tight" style="gap:0;min-width:0;flex:1"><span class="small" lang="ja" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(stripHtml(q.stem).replace(/\s+/g, ' ').slice(0, 80))}</span>
          <span class="xs muted">${t('test_n', { n: q.exam })} · ${t('sec_' + q.section)} · Q${q.n}</span></span>
        <span class="chip ng" style="flex:none">${t('missed_times', { n: store.s.mistakes[q.id].count })}</span></a>`).join('')}</div></section>`
    : `<div class="card empty"><div class="display-jp" style="color:var(--ok)">完</div><p>${t('no_mistakes')}</p></div>`}
  </div>`;
}

export async function mistakesPractice(main) {
  const qs = await loadMistakes();
  const byId = Object.fromEntries(qs.map(q => [q.id, q]));
  const chosen = {};
  main.innerHTML = `<div class="page">
    <a class="small" href="#/mistakes">← ${t('mistakes_title')}</a>
    <h1 class="h1">${t('practice_all')}</h1>
    ${qs.map((q, i) => `${q.passageHtml ? `<details class="card flat"><summary class="small" style="cursor:pointer;font-weight:600">${t('test_n', { n: q.exam })} · 本文</summary><div class="passage" lang="ja" style="margin-top:12px">${q.passageHtml}</div></details>` : ''}
      ${questionHtml(q, { label: `${i + 1} · ${t('test_n', { n: q.exam })} ${KANJI[q.section]}` })}`).join('')
      || `<div class="card empty"><p>${t('no_mistakes')}</p></div>`}
  </div>`;
  main.onclick = e => {
    const opt = e.target.closest('.opt'); if (!opt) return;
    const q = byId[opt.dataset.q]; if (chosen[q.id]) return;
    const n = +opt.dataset.n; chosen[q.id] = n;
    recordAnswer(q.id, q.section, n === q.answer); store.save();
    const label = opt.closest('.q').querySelector('.q-num').textContent;
    opt.closest('.q').outerHTML = questionHtml(q, { chosen: n, reveal: true, label });
    if (n === q.answer) toast(t('cleared'));
  };
  bindListening(main, id => byId[id]);
  return () => { main.onclick = null; };
}
