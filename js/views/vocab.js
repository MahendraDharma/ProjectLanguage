import { t } from '../i18n.js';
import { store } from '../store.js';
import { icon, esc, shuffle, stripHtml } from '../util.js';
import { vocabCards } from '../data.js';
import { grade, isDue, boxCounts, BOXES } from '../srs.js';
import { speak, ttsSupported } from '../tts.js';

const TYPES = ['reading', 'writing', 'context', 'synonym', 'usage'];

export async function vocab(main, _, params) {
  const all = await vocabCards();
  const s = store.s;
  const deck = TYPES.includes(params.get('deck')) ? params.get('deck') : 'all';
  const cards = deck === 'all' ? all : all.filter(c => c.type === deck);
  let queue = null, cur = 0, flipped = false, doneCount = 0;

  const overview = () => {
    const due = cards.filter(c => isDue(c.id));
    const fresh = cards.filter(c => !s.srs[c.id]);
    const boxes = boxCounts(cards);
    main.innerHTML = `<div class="page">
      <header class="page-head"><span class="eyebrow">語彙 · ${all.length}</span><h1 class="h1">${t('vocab_title')}</h1><p class="lede">${t('vocab_lede')}</p></header>
      <div class="row" style="gap:6px">${['all', ...TYPES].map(d => `<a class="btn sm ${d === deck ? 'indigo' : ''}" href="#/vocab?deck=${d}">${d === 'all' ? t('filter_all') : t('deck_' + d)}
        <span class="xs" style="opacity:.7">${d === 'all' ? all.length : all.filter(c => c.type === d).length}</span></a>`).join('')}</div>
      <div class="grid c2">
        <section class="card stack">
          <span class="eyebrow">${t('cards_due')}</span><b style="font:800 var(--t-4xl)/1 var(--f-display);color:var(--shu)">${due.length}</b>
          <button class="btn primary" data-start="due" ${due.length ? '' : 'disabled'}>${icon('play')}${t('study_due')}</button>
        </section>
        <section class="card stack">
          <span class="eyebrow">${t('new_cards')}</span><b style="font:800 var(--t-4xl)/1 var(--f-display)">${fresh.length}</b>
          <button class="btn" data-start="new" ${fresh.length ? '' : 'disabled'}>${icon('sparkle')}${t('study_new')} (${Math.min(s.settings.dailyGoal, fresh.length)})</button>
        </section>
      </div>
      <section class="card stack tight"><span class="eyebrow">Leitner</span>
        <div class="boxes">${boxes.map((n, i) => `<div><b>${n}</b>${t('box')} ${i + 1}</div>`).join('')}</div></section>
    </div>`;
    main.querySelectorAll('[data-start]').forEach(b => b.onclick = () => {
      queue = b.dataset.start === 'due' ? shuffle(due) : shuffle(fresh).slice(0, s.settings.dailyGoal);
      cur = 0; doneCount = 0; flipped = false; study();
    });
  };

  const backHtml = c => {
    if (c.type === 'synonym') return `<div class="fc-ans" lang="ja">${t('synonym_of')} ${c.back}</div>`;
    if (c.type === 'usage') return `<span class="eyebrow">${t('correct_usage')}</span><div class="fc-ctx" lang="ja" style="color:var(--ink);font-size:20px">${c.back}</div>`;
    return `<div class="fc-ans" lang="ja">${c.back}</div>`;
  };
  const lookupWord = c => stripHtml(c.type === 'writing' ? c.front : c.type === 'context' ? c.back : c.front);

  const study = () => {
    if (cur >= queue.length) {
      main.innerHTML = `<div class="page"><div class="card pad-lg empty"><div class="display-jp" style="color:var(--shu)">完</div>
        <h1 class="h2">${t('session_done')}</h1><p class="muted">${doneCount}</p><button class="btn primary" data-back>${t('back')}</button></div></div>`;
      main.querySelector('[data-back]').onclick = overview; return;
    }
    const c = queue[cur];
    const long = stripHtml(c.front).length > 8;
    main.innerHTML = `<div class="page" style="max-width:640px">
      <div class="row between"><button class="btn ghost sm" data-back>${icon('back')}${t('back')}</button>
        <span class="chip">${t('deck_' + c.type)}</span><span class="small muted">${cur + 1} / ${queue.length}</span></div>
      <div class="meter"><i style="width:${cur / queue.length * 100}%"></i></div>
      <div class="fc-wrap"><div class="fc ${flipped ? 'flipped' : ''}" role="button" tabindex="0" aria-label="${t('tap_flip')}">
        <div class="fc-face fc-front"><div class="fc-word ${long ? 'long' : ''}" lang="ja">${c.front}</div>
          ${c.type !== 'context' && c.type !== 'usage' ? `<p class="fc-ctx" lang="ja">${c.ctx}</p>` : ''}
          <span class="xs muted">${t('tap_flip')} · <kbd>Space</kbd></span></div>
        <div class="fc-face fc-back">${c.type !== 'context' && c.type !== 'usage' ? `<div class="h3" lang="ja" style="font-family:var(--f-jp)">${c.front}</div>` : ''}${backHtml(c)}
          <p class="fc-ctx" lang="ja">${c.ctx}</p>
          <div class="row" style="justify-content:center">
            ${ttsSupported ? `<button class="btn sm" data-say>${icon('play')}${t('play')}</button>` : ''}
            <a class="btn sm" target="_blank" rel="noopener" href="https://jisho.org/search/${encodeURIComponent(lookupWord(c))}">${t('look_up')} ${icon('ext')}</a>
            <a class="btn sm ghost" href="#/exam/${c.exam}/vocab">${t('test_n', { n: c.exam })}</a></div></div>
      </div></div>
      <div class="fc-actions" ${flipped ? '' : 'hidden'}>
        <button class="btn" data-g="0">${t('srs_again')}<small><kbd>1</kbd></small></button>
        <button class="btn indigo" data-g="1">${t('srs_good')}<small style="color:inherit;opacity:.8"><kbd>2</kbd></small></button>
        <button class="btn" data-g="2">${t('srs_easy')}<small><kbd>3</kbd></small></button>
      </div></div>`;
    const fc = main.querySelector('.fc');
    const flip = () => { flipped = !flipped; fc.classList.toggle('flipped', flipped); main.querySelector('.fc-actions').hidden = !flipped; };
    fc.onclick = e => { if (e.target.closest('a,button')) return; flip(); };
    main.querySelector('[data-back]').onclick = overview;
    main.querySelector('[data-say]')?.addEventListener('click', () => speak(stripHtml(c.type === 'reading' ? c.back : c.type === 'writing' ? c.back : c.front)));
    main.querySelectorAll('[data-g]').forEach(b => b.onclick = () => rate(+b.dataset.g));
  };
  const rate = g => {
    const c = queue[cur]; grade(c.id, g); doneCount++;
    if (g === 0) queue.push(c); // see it again this session
    cur++; flipped = false; study();
  };
  const key = e => {
    if (!queue || cur >= (queue?.length || 0) || e.target.matches('input,textarea,select')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); main.querySelector('.fc')?.click(); }
    else if (flipped && /^[123]$/.test(e.key)) rate(+e.key - 1);
  };
  document.addEventListener('keydown', key);
  overview();
  return () => document.removeEventListener('keydown', key);
}
