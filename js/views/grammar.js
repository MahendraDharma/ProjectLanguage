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
      <div class="row between"><h1 class="title">${t('grammar_title')}</h1>
        <a class="btn primary" href="#/grammar/quiz">${t('grammar_quiz')}</a></div>
      <p class="sub">${t('grammar_lede')}</p>
    </header>
    <div class="stack tight">
      <div class="search">${icon('search')}<input class="input" type="search" id="gq" value="${esc(q)}" placeholder="${t('search_grammar')}" aria-label="${t('search_grammar')}"></div>
      <div class="row between">
        <label class="switch" style="gap:12px"><span class="small muted">${t('hide_meanings')}</span><input type="checkbox" id="ghide" ${hide ? 'checked' : ''}></label>
        <span class="meta">${t('learned_n', { n: learned })}</span>
      </div>
    </div>
    <div class="panel compact"><div class="rows ${hide ? 'quiz-hide' : ''}" id="glist"></div></div>
  </div>`;
  const list = main.querySelector('#glist');
  const draw = () => {
    const qq = norm(main.querySelector('#gq').value);
    const f = items.map((g, i) => ({ g, i })).filter(({ g }) => !qq || norm(g.pattern + g.romaji + g.meaning.en + (g.meaning.id || '')).includes(qq));
    list.innerHTML = f.map(({ g, i }) => `<a class="g-row" href="#/grammar/${g.id}">
      <span class="meta">${String(i + 1).padStart(2, '0')}</span>
      <span class="stack flush" style="min-width:0"><span><span class="pat" lang="ja">${esc(g.pattern)}</span><span class="rom">${esc(g.romaji)}</span></span>
        <span class="mean">${esc(meaning(g))}</span></span>
      ${s.learned[g.id] ? `<span class="ok-t" title="${t('mark_learned')}">${icon('check')}</span>` : icon('chevron')}</a>`).join('')
      || `<div class="empty"><p class="small">—</p></div>`;
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
  main.innerHTML = `<div class="page doc">
    <div class="row between"><a class="small link" href="#/grammar">${t('grammar_title')}</a><span class="meta">${String(i + 1).padStart(2, '0')} / ${items.length}</span></div>
    <header class="stack tight">
      <h1 class="g-pattern" lang="ja">${esc(g.pattern)}</h1>
      <p class="meta">${esc(g.romaji)}</p>
      <p class="h2 g-meaning" style="margin-top:8px">${esc(meaning(g))}</p>
      ${lang() === 'id' && g.meaning.id ? `<p class="small muted">${esc(g.meaning.en)}</p>` : ''}
      <label class="switch" style="justify-content:flex-start"><span class="small muted">${t('mark_learned')}</span><input type="checkbox" id="learned" ${s.learned[g.id] ? 'checked' : ''}></label>
    </header>
    ${g.formation ? `<section class="panel stack tight"><h2 class="h3">${t('formation')} <span class="faint" lang="ja">接続</span></h2><div class="prose" lang="en">${g.formation}</div></section>` : ''}
    ${g.explanation ? `<section class="panel stack tight"><h2 class="h3">${t('explanation_g')} <span class="faint" lang="ja">説明</span></h2><div class="prose" lang="en">${g.explanation}</div>
      ${t('en_only') ? `<p class="meta">${t('en_only')}</p>` : ''}</section>` : ''}
    <section class="panel stack" id="exs">
      <div class="row between"><h2 class="h3">${t('examples')} <span class="faint" lang="ja">例文</span></h2>
        <div class="seg" role="group">
          <button type="button" data-toggle="furi" aria-pressed="${s.settings.furigana}">${t('furigana')}</button>
          <button type="button" data-toggle="tr" aria-pressed="false">${t('hide_tr')}</button></div></div>
      <div>${g.examples.map((e, k) => `<div class="ex"><span class="meta" style="line-height:40px">${k + 1}</span><div class="stack flush">
        <p class="ja" lang="ja">${e.ja}</p><p class="tr" lang="en">${esc(e.en)}</p></div></div>`).join('')}</div>
    </section>
    ${rel.length ? `<section class="stack tight"><h2 class="h3">${t('related')}</h2><div class="chips">${rel.map(r =>
      `<a class="chiplink" href="#/grammar/${r.id}" lang="ja">${esc(r.pattern)}</a>`).join('')}</div></section>` : ''}
    <nav class="row between" aria-label="Pager">
      ${prev ? `<a class="btn" href="#/grammar/${prev.id}">${icon('back')}<span lang="ja">${esc(prev.pattern)}</span></a>` : '<span></span>'}
      ${next ? `<a class="btn" href="#/grammar/${next.id}"><span lang="ja">${esc(next.pattern)}</span>${icon('arrow')}</a>` : ''}
    </nav>
    <a class="meta link" href="${esc(g.source)}" target="_blank" rel="noopener">${t('source')}: dethitiengnhat.com</a>
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
      main.innerHTML = `<div class="page doc"><section class="panel result">
        <div class="stack flush"><span class="small muted">${t('quiz_done')}</span><span class="fig">${right}<small>/ ${qs.length}</small></span></div>
        <div class="row"><button class="btn primary" data-again>${t('again')}</button><a class="btn" href="#/grammar">${t('grammar_title')}</a></div></section></div>`;
      main.querySelector('[data-again]').onclick = start; return;
    }
    const { g, opts } = qs[k];
    main.innerHTML = `<div class="page doc" style="max-width:640px">
      <div class="row between"><a class="small link" href="#/grammar">${t('grammar_title')}</a><span class="meta">${k + 1} / ${qs.length}</span></div>
      <div class="bar"><i style="transform:scaleX(${k / qs.length})"></i></div>
      <section class="panel stack">
        <span class="small muted">${t('quiz_prompt')}</span>
        <h1 class="h2">${esc(meaning(g))}</h1>
        <div class="opts ${picked ? 'locked' : ''}">${opts.map((o, i) => {
          const cls = picked ? (o === g ? 'correct' : o === picked ? 'wrong' : '') : '';
          return `<button type="button" class="opt ${cls}" data-i="${i}" aria-pressed="${picked === o}"><span class="oval" aria-hidden="true">${i + 1}</span><span lang="ja" style="font-size:17px;font-weight:500">${esc(o.pattern)}</span>${picked && o === g ? `<span class="mark ok-t">${t('correct')}</span>` : picked && o === picked ? `<span class="mark ng-t">${t('wrong')}</span>` : ''}</button>`; }).join('')}</div>
        ${picked ? `<div class="explain"><div class="body"><p lang="ja">${g.examples[0]?.ja || ''}</p><p class="small muted" style="margin-top:4px;font-family:var(--f-ui)">${esc(g.examples[0]?.en || '')}</p></div></div>
          <div class="row between"><a class="small link" href="#/grammar/${g.id}" lang="ja">${esc(g.pattern)}</a><button class="btn primary" data-next>${t('next')}</button></div>` : ''}
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
