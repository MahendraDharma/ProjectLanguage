import { t, setLang } from './i18n.js';
import { store } from './store.js';
import { icon, $, esc } from './util.js';
import { stop as stopTts } from './tts.js';
import { home } from './views/home.js';
import { examList, examRun, examReport } from './views/exams.js';
import { grammarList, grammarDetail, grammarQuiz } from './views/grammar.js';
import { vocab } from './views/vocab.js';
import { mistakes, mistakesPractice } from './views/mistakes.js';
import { settings } from './views/settings.js';
import { LEVEL_IDS, level } from './courses.js';

const NAV = [
  ['/', 'home', 'nav_home'],
  ['/exams', 'exam', 'nav_exams'],
  ['/grammar', 'grammar', 'nav_grammar'],
  ['/vocab', 'cards', 'nav_vocab'],
  ['/mistakes', 'mistakes', 'nav_mistakes'],
  ['/settings', 'settings', 'nav_settings'],
];

const ROUTES = [
  [/^\/$/, home],
  [/^\/exams$/, examList],
  [/^\/exam\/(N[1-5]-[a-z]?\d+)\/(vocab|grammar_reading|listening)$/, examRun],
  [/^\/report\/(N[1-5]-[a-z]?\d+)$/, examReport],
  [/^\/grammar$/, grammarList],
  [/^\/grammar\/quiz$/, grammarQuiz],
  [/^\/grammar\/(N[1-5])\/([\w-]+)$/, grammarDetail],
  [/^\/vocab$/, vocab],
  [/^\/mistakes$/, mistakes],
  [/^\/mistakes\/practice$/, mistakesPractice],
  [/^\/settings$/, settings],
];

function applySettings() {
  const s = store.s.settings;
  setLang(s.lang);
  document.documentElement.dataset.theme = s.theme;
  document.body.classList.toggle('hide-furigana', !s.furigana);
}

function mistakeCount() { return Object.keys(store.s.mistakes).length; }

function renderNav(path) {
  const active = p => (p === '/' ? path === '/' : path.startsWith(p.replace(/s$/, ''))) ? 'aria-current="page"' : '';
  const mc = mistakeCount();
  const link = ([p, ic, k]) => `<a href="#${p}" ${active(p)}>${icon(ic)}<span>${t(k)}</span>${p === '/mistakes' && mc ? `<span class="count">${mc}</span>` : '<span></span>'}</a>`;
  $('#nav-label').innerHTML = `${t('course_ja')} <span class="faint">· JLPT</span>`;
  $('#level-pick').innerHTML = levelPicker();
  $('#brand-level').textContent = level();
  $('#nav').innerHTML = NAV.filter(n => n[0] !== '/settings').map(link).join('');
  $('#tabbar').innerHTML = NAV.filter(n => n[0] !== '/settings').map(link).join('');
  $('#sidebar-foot').innerHTML = `<nav class="nav">${link(NAV.find(n => n[0] === '/settings'))}</nav>
    <div class="seg" role="group" aria-label="Language" style="align-self:flex-start">${['ja', 'id', 'en'].map(l =>
    `<button type="button" data-lang="${l}" aria-pressed="${store.s.settings.lang === l}" lang="${l}">${{ ja: '日本語', id: 'Indonesia', en: 'English' }[l]}</button>`).join('')}</div>`;
  document.querySelector('.skip').textContent = t('skip');
}

let cleanup = null;
export async function render() {
  stopTts();
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  applySettings();
  renderNav(path);
  const main = $('#main');
  const route = ROUTES.find(([re]) => re.test(path));
  if (!route) { main.innerHTML = `<div class="page doc"><div class="empty"><p>${t('not_found')}</p><a class="btn" href="#/">${t('nav_home')}</a></div></div>`; return; }
  const m = path.match(route[0]);
  main.innerHTML = `<div class="page"><p class="faint small">${t('loading')}</p></div>`;
  try {
    const r = await route[1](main, m.slice(1), params);
    if (typeof r === 'function') cleanup = r;
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="page doc"><div class="empty"><p>${t('load_error')}</p><code class="meta">${esc(e.message)}</code></div></div>`;
  }
  const titleEl = main.querySelector('h1');
  document.title = (titleEl ? titleEl.textContent.trim() + ' · ' : '') + 'Michi';
}

export function levelPicker() {
  return `<div class="seg levels" role="group" aria-label="${t('level')}">${LEVEL_IDS.map(L =>
    `<button type="button" data-level="${L}" aria-pressed="${level() === L}">${L}</button>`).join('')}</div>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if (b) { store.s.settings.lang = b.dataset.lang; store.save(); render(); return; }
  const lv = e.target.closest('[data-level]');
  if (lv) {
    store.s.settings.level = lv.dataset.level; store.save();
    const path = (location.hash.slice(1) || '/').split('?')[0];
    if (/^\/(exam|report)\/|^\/grammar\/(N|quiz)/.test(path)) location.hash = path.startsWith('/grammar') ? '#/grammar' : '#/exams';
    else render();
  }
});

let lastPath = null;
window.addEventListener('hashchange', () => {
  const p = (location.hash.slice(1) || '/').split('?')[0];
  const samePage = p === lastPath; lastPath = p;
  render().then(() => { if (!samePage) { window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); } });
});
lastPath = (location.hash.slice(1) || '/').split('?')[0];
render();
