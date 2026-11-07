import { t, lang } from '../i18n.js';
import { store, logActivity } from '../store.js';
import { icon, esc, shuffle } from '../util.js';
import { grammar } from '../data.js';

const meaning = g => g.meaning[lang()] || g.meaning.en;
const norm = s => s.toLowerCase().normalize('NFKC').replace(/[\s〜～~・]/g, '');

export async function grammarList(main, _, params) {
  const items = await grammar();
  const s = store.s;
  const q = params.get('q') || '';
  const hide = params.get('hide') === '1';
  const learned = items.filter(g => s.learned[g.id]).length;
  main.innerHTML = `<div class="page">
    <header class="page-head">
      <span class="eyebrow">文法 · JLPT N3</span>
      <div class="row between"><h1 class="h1">${t('grammar_title')}</h1>
        <a class="btn primary" href="#/grammar/quiz">${icon('sparkle')}${t('grammar_quiz')}</a></div>
      <p class="lede">${t('grammar_lede')}</p>
    </header>
    <div class="card flat stack" style="padding:16px">
      <div class="search">${icon('search')}<input class="input" type="search" id="gq" value="${esc(q)}" placeholder="${t('search_grammar')}" aria-label="${t('search_grammar')}"></div>
      <div class="row between">
        <label class="switch" style="min-height:32px;gap:12px"><span class="small">${t('hide_meanings')}</span><input type="checkbox" id="ghide" ${hide ? 'checked' : ''}></label>
        <div class="row" style="gap:8px;min-width:200px;flex:1;max-width:320px"><div class="meter ok" style="flex:1"><i style="width:${learned / items.length * 100}%"></i></div><span class="xs muted">${t('learned_n', { n: learned })}</span></div>
      </div>
    </div>
    <div class="list ${hide ? 'quiz-hide' : ''}" id="glist" style="gap:0"></div>
  </div>`;
  const list = main.querySelector('#glist');
  const draw = () => {
    const qq = norm(main.querySelector('#gq').value);
    const f = items.map((g, i) => ({ g, i })).filter(({ g }) => !qq || norm(g.pattern + g.romaji + g.meaning.en + (g.meaning.id || '')).includes(qq));
    list.innerHTML = f.map(({ g, i }) => `<a class="g-item" href="#/grammar/${g.id}">
      <span class="idx">${String(i + 1).padStart(2, '0')}</span>
      <span class="stack tight" style="gap:2px;min-width:0"><span class="pat" lang="ja">${esc(g.pattern)} <span class="xs muted" style="font-family:var(--f-ui);font-weight:500">${esc(g.romaji)}</span></span>
        <span class="mean">${esc(meaning(g))}</span></span>
      ${s.learned[g.id] ? `<span class="chip ok">${icon('check')}</span>` : icon('arrow', 'muted')}</a>`).join('')
      || `<div class="empty"><div class="display-jp">無</div></div>`;
  };
  draw();
  main.querySelector('#gq').addEventListener('input', draw);
  main.querySelector('#ghide').addEventListener('change', e => list.classList.toggle('quiz-hide', e.target.checked));
}

export async function grammarDetail(main, [id]) {
  const items = await grammar();
  const i = items.findIndex(g => g.id === id);
  const g = items[i];
  if (!g) { main.innerHTML = `<div class="page"><div class="empty"><p>${t('not_found')}</p></div></div>`; return; }
  const s = store.s;
  const prev = items[i - 1], next = items[i + 1];
  const rel = g.related.map(r => items.find(x => x.id === r)).filter(Boolean);
  main.innerHTML = `<div class="page">
    <a class="small" href="#/grammar">← ${t('grammar_title')}</a>
    <header class="card pad-lg g-hero">
      <div class="row between"><span class="eyebrow">N3 · ${String(i + 1).padStart(2, '0')}/${items.length}</span>
        <label class="switch" style="min-height:32px;gap:10px"><span class="small">${t('mark_learned')}</span><input type="checkbox" id="learned" ${s.learned[g.id] ? 'checked' : ''}></label></div>
      <h1 class="pat" lang="ja">${esc(g.pattern)}</h1>
      <p class="muted">${esc(g.romaji)}</p>
      <p class="h3 g-meaning">${esc(meaning(g))}</p>
      ${lang() === 'id' && g.meaning.id ? `<p class="small muted">EN: ${esc(g.meaning.en)}</p>` : ''}
    </header>
    ${g.formation ? `<section class="card stack tight"><h2 class="eyebrow">${t('formation')} · <span lang="ja">接続</span></h2><div class="prose" lang="en">${g.formation}</div></section>` : ''}
    ${g.explanation ? `<section class="card stack tight"><h2 class="eyebrow">${t('explanation_g')} · <span lang="ja">説明</span></h2><div class="prose" lang="en">${g.explanation}</div>
      ${t('en_only') ? `<p class="xs muted">${t('en_only')}</p>` : ''}</section>` : ''}
    <section class="card stack" id="exs">
      <div class="row between"><h2 class="eyebrow">${t('examples')} · <span lang="ja">例文</span></h2>
        <div class="row" style="gap:6px">
          <button type="button" class="btn sm" data-toggle="furi" aria-pressed="${s.settings.furigana}">${t('furigana')}</button>
          <button type="button" class="btn sm" data-toggle="tr" aria-pressed="false">${t('hide_tr')}</button></div></div>
      <div>${g.examples.map((e, k) => `<div class="ex"><span class="n">${k + 1}</span><div class="stack tight" style="gap:4px">
        <p class="ja" lang="ja">${e.ja}</p><p class="tr" lang="en">${esc(e.en)}</p></div></div>`).join('')}</div>
    </section>
    ${rel.length ? `<section class="stack tight"><h2 class="eyebrow">${t('related')}</h2><div class="row">${rel.map(r =>
      `<a class="chip ai" style="height:34px;font-size:14px" href="#/grammar/${r.id}" lang="ja">${esc(r.pattern)}</a>`).join('')}</div></section>` : ''}
    <nav class="row between" aria-label="Pager">
      ${prev ? `<a class="btn" href="#/grammar/${prev.id}">← <span lang="ja">${esc(prev.pattern)}</span></a>` : '<span></span>'}
      ${next ? `<a class="btn" href="#/grammar/${next.id}"><span lang="ja">${esc(next.pattern)}</span> →</a>` : ''}
    </nav>
    <a class="xs muted" href="${esc(g.source)}" target="_blank" rel="noopener">${t('source')}: dethitiengnhat.com ${icon('ext')}</a>
  </div>`;
  main.querySelector('#learned').onchange = e => { if (e.target.checked) { s.learned[g.id] = true; logActivity(1); } else delete s.learned[g.id]; store.save(); };
  const exs = main.querySelector('#exs');
  exs.onclick = e => {
    const b = e.target.closest('[data-toggle]');
    if (b) {
      const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on);
      if (b.dataset.toggle === 'furi') exs.classList.toggle('hide-furigana', !on);
      else exs.classList.toggle('hide-tr', on);
      return;
    }
    const tr = e.target.closest('.tr'); if (tr) tr.classList.toggle('shown');
  };
  if (!s.settings.furigana) exs.classList.add('hide-furigana');
}

export async function grammarQuiz(main) {
  const items = await grammar();
  const N = 10;
  let qs, k, right, picked;
  const start = () => {
    qs = shuffle(items).slice(0, N).map(g => ({ g, opts: shuffle([g, ...shuffle(items.filter(x => x !== g)).slice(0, 3)]) }));
    k = 0; right = 0; picked = null; draw();
  };
  const draw = () => {
    if (k >= qs.length) {
      main.innerHTML = `<div class="page"><div class="card pad-lg empty">
        <div class="display-jp" style="color:var(--shu)">${right >= 8 ? '優' : right >= 5 ? '良' : '可'}</div>
        <h1 class="h2">${t('quiz_done')}</h1><p class="h3">${right} / ${qs.length}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-again>${t('again')}</button><a class="btn" href="#/grammar">${t('grammar_title')}</a></div></div></div>`;
      main.querySelector('[data-again]').onclick = start; return;
    }
    const { g, opts } = qs[k];
    main.innerHTML = `<div class="page" style="max-width:640px">
      <div class="row between"><a class="small" href="#/grammar">← ${t('grammar_title')}</a><span class="small muted">${k + 1} / ${qs.length}</span></div>
      <div class="meter"><i style="width:${k / qs.length * 100}%"></i></div>
      <section class="card pad-lg stack">
        <span class="eyebrow">${t('quiz_prompt')}</span>
        <h1 class="h2">${esc(meaning(g))}</h1>
        <div class="opts ${picked ? 'locked' : ''}">${opts.map((o, i) => {
          const cls = picked ? (o === g ? 'correct' : o === picked ? 'wrong' : '') : '';
          return `<button type="button" class="opt ${cls}" data-i="${i}"><span class="n">${i + 1}</span><span lang="ja" style="font-size:18px;font-weight:600">${esc(o.pattern)}</span><span class="mark">${picked && o === g ? icon('check') : picked && o === picked ? icon('x') : ''}</span></button>`; }).join('')}</div>
        ${picked ? `<div class="explain"><p lang="ja">${g.examples[0]?.ja || ''}</p><p class="small muted" style="margin-top:4px">${esc(g.examples[0]?.en || '')}</p></div>
          <div class="row between"><a class="small" href="#/grammar/${g.id}">${esc(g.pattern)} →</a><button class="btn primary" data-next>${t('next')} ${icon('arrow')}</button></div>` : ''}
      </section></div>`;
    main.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (picked) return; picked = opts[+b.dataset.i]; if (picked === g) right++; logActivity(1); store.save(); draw();
      main.querySelector('[data-next]')?.focus();
    });
    const nx = main.querySelector('[data-next]'); if (nx) nx.onclick = () => { k++; picked = null; draw(); };
  };
  start();
  const key = e => {
    if (e.target.matches('input,textarea')) return;
    if (/^[1-4]$/.test(e.key) && !picked) main.querySelectorAll('.opt')[+e.key - 1]?.click();
    else if ((e.key === 'Enter' || e.key === ' ') && picked) { e.preventDefault(); main.querySelector('[data-next]')?.click(); }
  };
  document.addEventListener('keydown', key);
  return () => document.removeEventListener('keydown', key);
}
