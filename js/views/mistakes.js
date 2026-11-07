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
  main.innerHTML = `<div class="page doc">
    <header class="page-head">
      <div class="row between"><h1 class="title">${t('mistakes_title')} <span class="muted">${qs.length}</span></h1>
      ${qs.length ? `<a class="btn primary" href="#/mistakes/practice">${t('practice_all')}</a>` : ''}</div>
      <p class="sub">${t('mistakes_lede')}</p></header>
    ${qs.length ? `<section class="panel compact"><div class="rows">${qs.map(q => `
      <a class="rowlink" style="grid-template-columns:18px minmax(0,1fr) auto 18px;min-height:56px" href="#/exam/${q.exam}/${q.section}?mode=practice">
        <span class="mincho faint" lang="ja">${KANJI[q.section]}</span>
        <span class="stack flush" style="min-width:0"><span class="label mincho" lang="ja">${esc(stripHtml(q.stem).replace(/\s+/g, ' ').slice(0, 80))}</span>
          <span class="meta">${t('test_n', { n: q.exam })} · ${t('sec_' + q.section)} · ${String(q.n).padStart(2, '0')}</span></span>
        <span class="meta ng-t">${t('missed_times', { n: store.s.mistakes[q.id].count })}</span>${icon('chevron')}</a>`).join('')}</div></section>`
    : `<div class="panel empty"><p>${t('no_mistakes')}</p><a class="btn" href="#/exams">${t('nav_exams')}</a></div>`}
  </div>`;
}

export async function mistakesPractice(main) {
  const qs = await loadMistakes();
  const byId = Object.fromEntries(qs.map(q => [q.id, q]));
  const chosen = {};
  main.innerHTML = `<div class="page doc">
    <a class="small link" href="#/mistakes">${t('mistakes_title')}</a>
    <h1 class="title">${t('practice_all')}</h1>
    <div>${qs.map((q, i) => `${q.passageHtml ? `<details class="explain" style="padding-top:24px;border-top:1px solid var(--line)"><summary>${t('test_n', { n: q.exam })} · <span lang="ja">本文</span></summary><div class="passage" lang="ja" style="margin-top:12px">${q.passageHtml}</div></details>` : ''}
      ${questionHtml(q, { label: `${String(i + 1).padStart(2, '0')} · ${t('test_n', { n: q.exam })} ${KANJI[q.section]}` })}`).join('')
      || `<div class="panel empty"><p>${t('no_mistakes')}</p></div>`}</div>
  </div>`;
  main.onclick = e => {
    const opt = e.target.closest('.opt'); if (!opt) return;
    const q = byId[opt.dataset.q]; if (chosen[q.id]) return;
    const n = +opt.dataset.n; chosen[q.id] = n;
    recordAnswer(q.id, q.section, n === q.answer); store.save();
    const label = opt.closest('.q').querySelector('.q-meta span').textContent;
    opt.closest('.q').outerHTML = questionHtml(q, { chosen: n, reveal: true, label });
    if (n === q.answer) toast(t('cleared'));
  };
  bindListening(main, id => byId[id]);
  return () => { main.onclick = null; };
}
