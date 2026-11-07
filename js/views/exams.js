import { t } from '../i18n.js';
import { store, recordAnswer } from '../store.js';
import { icon, esc, pct, fmtTime, toast, $, $$ } from '../util.js';
import { examIndex, exam, flatten, score, SECTIONS } from '../data.js';
import { level, levelOf, LEVELS, secLabel, secKanji, testName, testNameFromKey, scaled as scaleParts } from '../courses.js';
import { levelPicker } from '../app.js';
import { passLine } from './home.js';
import { questionHtml, bindListening } from './questions.js';
import { stop as stopTts } from '../tts.js';


/* ───────────────────────── list ───────────────────────── */
const KINDS = ['jlpt', 'practice', 'open'];
export async function examList(main, _, params) {
  const L = level();
  const idx = await examIndex();
  const K = e => `${L}-${e.id}`;
  const s = store.s;
  const filter = params.get('f') || 'all';
  const best = (id, sec) => {
    const as = s.attempts.filter(a => a.exam === `${L}-${id}` && a.section === sec);
    return as.length ? Math.max(...as.map(a => pct(a.points, a.max))) : null;
  };
  const exams = idx.exams.filter(e => {
    const taken = s.attempts.some(a => a.exam === K(e));
    return filter === 'all' || (filter === 'done' ? taken : !taken);
  });
  const total = e => SECTIONS.reduce((a, sec) => a + (e.counts[sec] || 0), 0);
  main.innerHTML = `<div class="page">
    <header class="page-head">
      <div class="mobile-only">${levelPicker()}</div>
      <h1 class="title">${t('exams_title', { level: L })} <span class="muted">${idx.exams.length}</span></h1>
      <p class="sub">${t('exams_lede')}</p>
    </header>
    <div class="row between">
      <div class="seg" role="group" aria-label="Filter">${['all', 'todo', 'done'].map(f =>
        `<button type="button" data-f="${f}" aria-pressed="${filter === f}">${t('filter_' + f)}</button>`).join('')}</div>
      <span class="meta">${SECTIONS.map(x => `${secLabel(x)} ${LEVELS[L].minutes[x]} ${t('minutes')}`).join(' · ')}</span>
    </div>
    ${KINDS.map(kind => { const list = exams.filter(e => (e.kind || 'jlpt') === kind); if (!list.length) return '';
      return `<section class="stack" aria-label="${t('kind_' + kind)}">
      <div class="stack flush"><h2 class="h3">${t('kind_' + kind)} <span class="faint">${list.length}</span></h2>
        ${kind === 'open' ? `<p class="small muted">${t('open_note')} <a class="link" href="https://github.com/evanclan/OpenJLPT" target="_blank" rel="noopener">OpenJLPT</a></p>` : ''}</div>
    <div class="exam-grid">
      ${list.map(e => {
        const full = SECTIONS.every(sec => !e.counts[sec] || s.attempts.some(a => a.exam === K(e) && a.section === sec && a.mode === 'exam'));
        return `<div class="panel exam-card">
        <div class="head"><b>${testName(e)}</b>
          ${full ? `<a class="small link" href="#/report/${K(e)}">${t('full_report')}</a>` : `<span class="meta">${total(e)} ${t('questions')}</span>`}</div>
        ${SECTIONS.map(sec => { const n = e.counts[sec] || 0; const b = best(e.id, sec);
          return `<a class="secline ${n ? '' : 'disabled'}" href="#/exam/${K(e)}/${sec}" ${n ? '' : 'aria-disabled="true" tabindex="-1"'}>
            <span class="k" lang="ja">${secKanji(sec)}</span><span>${secLabel(sec)}</span>
            <span class="meta">${!n ? t('not_available') : b != null ? `${b}% ${t('best')}` : `${n}`}</span></a>`; }).join('')}
      </div>`; }).join('')}
    </div></section>`; }).join('')}
  </div>`;
  main.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { location.hash = `#/exams?f=${b.dataset.f}`; });
}

/* ───────────────────────── runner ───────────────────────── */
export async function examRun(main, [id, section], params) {
  const L = levelOf(id);
  const mode = params.get('mode') === 'exam' ? 'exam' : 'practice';
  const ex = await exam(id);
  const qs = flatten(ex, section);
  const byId = Object.fromEntries(qs.map(q => [q.id, q]));
  const key = `${id}/${section}/${mode}`;
  const s = store.s;
  let ses = s.sessions[key];
  if (!ses) { ses = s.sessions[key] = { answers: {}, startedAt: Date.now() }; }
  if (mode === 'exam' && !ses.deadline && !ses.submitted) ses.deadline = Date.now() + LEVELS[L].minutes[section] * 60000;
  store.save();

  if (!qs.length) {
    main.innerHTML = `<div class="page doc"><div class="empty"><p>${t('not_available')}</p><a class="btn" href="#/exams">${t('back')}</a></div></div>`;
    return;
  }

  const answered = () => qs.filter(q => ses.answers[q.id] != null).length;
  const reveal = q => mode === 'practice' ? ses.answers[q.id] != null : !!ses.submitted;

  function summaryHtml() {
    const r = score(qs, ses.answers);
    const nextSec = SECTIONS.slice(SECTIONS.indexOf(section) + 1).find(x => (ex.sections[x]?.groups || []).length);
    const allExam = SECTIONS.every(sec => !ex.sections[sec]?.groups.length || s.attempts.some(a => a.exam === id && a.section === sec && a.mode === 'exam'));
    return `<section class="panel result" aria-label="${t('result')}">
      <div class="stack flush"><span class="small muted">${t('result')}</span><span class="fig">${r.correct}<small>/ ${r.total}</small></span><span class="meta">${pct(r.points, r.max)}%</span></div>
      <div class="stack">
        ${Object.entries(r.parts).map(([k, v]) => { const p = pct(v.points, v.max);
          return `<div class="partbar"><span class="small">${t('part_' + k)}</span><span class="mono small">${v.c}/${v.t} · ${p}%</span>
            <div class="track"><i style="width:${p}%"></i></div></div>`; }).join('')}
        <div class="row">
          ${nextSec ? `<a class="btn primary" href="#/exam/${id}/${nextSec}?mode=${mode}">${t('next_section')}: ${secLabel(nextSec, L)}</a>` : ''}
          ${mode === 'exam' && allExam ? `<a class="btn" href="#/report/${id}">${t('full_report')}</a>` : ''}
          <button type="button" class="btn ghost" data-restart>${t('restart')}</button>
        </div>
        <p class="meta">${passLine(L)}</p>
      </div></section>`;
  }

  function paletteHtml() {
    return qs.map(q => {
      const a = ses.answers[q.id];
      const cls = reveal(q) ? (a === q.answer ? 'ok' : 'ng') : '';
      return `<a href="#q" data-jump="${q.id}" class="${cls}" aria-label="Q${q.n}"><span class="oval ${a != null && !cls ? 'on' : ''}"></span>${q.n}</a>`;
    }).join('');
  }

  function barHtml() {
    const a = answered();
    return `<div class="inner">
      <a class="btn ghost icon sm" href="#/exams" aria-label="${t('back')}">${icon('back')}</a>
      <span class="title-s">${L} · ${testNameFromKey(id)} · ${secLabel(section, L)}</span>
      <span class="meta" data-count>${a}/${qs.length}</span>
      <div class="bar"><i style="transform:scaleX(${a / qs.length})"></i></div>
      ${mode === 'exam' && !ses.submitted ? `<span class="timer" data-timer>${icon('clock')}<span>--:--</span></span>
        <button type="button" class="btn primary sm" data-submit>${t('submit')}</button>` : ''}
      <details class="drawer" style="position:relative">
        <summary class="btn sm icon" aria-label="${t('questions_map')}">${icon('list')}</summary>
        <div class="menu"><p class="small muted" style="margin-bottom:12px">${t('questions_map')}</p><div class="palette" data-palette>${paletteHtml()}</div></div>
      </details>
    </div>`;
  }

  function bodyHtml() {
    let lastPassage = null, html = '';
    ex.sections[section].groups.forEach((g, gi) => {
      html += `<section class="group">${g.instruction ? `<div class="group-head" lang="ja">${g.instruction}</div>` : ''}`;
      qs.filter(q => q.gi === gi).forEach(q => {
        if (q.passage != null && q.passage !== lastPassage) { html += `<div class="passage" lang="ja">${q.passageHtml}</div>`; lastPassage = q.passage; }
        html += questionHtml(q, { chosen: ses.answers[q.id], reveal: reveal(q) });
      });
      html += `</section>`;
    });
    return html;
  }

  function renderAll() {
    const showSummary = mode === 'practice' ? answered() === qs.length : ses.submitted;
    main.innerHTML = `<div class="qbar" data-bar>${barHtml()}</div>
      <div class="page doc" style="margin-top:24px">
        <h1 class="sr-only">${L} ${testNameFromKey(id)} ${secLabel(section, L)}</h1>
        <div class="row between">
          <nav class="tabs" aria-label="${t('col_section')}">${SECTIONS.map(x => `<a href="#/exam/${id}/${x}?mode=${mode}" ${x === section ? 'aria-current="page"' : ''} class="${ex.sections[x]?.groups.length ? '' : 'disabled'}">${secLabel(x, L)}</a>`).join('')}</nav>
          <div class="seg" role="group" aria-label="${t('mode')}">${['practice', 'exam'].map(m =>
            `<button type="button" data-mode="${m}" aria-pressed="${mode === m}">${t('mode_' + m)}</button>`).join('')}</div>
        </div>
        ${showSummary ? summaryHtml() : ''}
        <div>${bodyHtml()}</div>
        <div class="row between">
          <a class="meta link" href="${esc(ex.sections[section].source)}" target="_blank" rel="noopener">${t('source')}: ${esc(ex.sections[section].sourceName || 'dethitiengnhat.com')}</a>
          <button type="button" class="btn sm ghost" data-restart>${t('restart')}</button>
        </div>
      </div>`;
    tick();
  }

  function refreshBar() {
    const bar = $('[data-bar]', main); if (!bar) return;
    const open = bar.querySelector('details')?.open;
    bar.innerHTML = barHtml();
    if (open) bar.querySelector('details').open = true;
    tick();
  }

  function record() {
    const r = score(qs, ses.answers);
    s.attempts.push({ exam: id, section, mode, date: Date.now(), correct: r.correct, total: r.total, points: r.points, max: r.max, parts: r.parts });
  }

  function submit(auto) {
    if (ses.submitted) return;
    const left = qs.length - answered();
    if (!auto && left && !confirm(t('confirm_submit', { n: left }))) return;
    stopTts();
    qs.forEach(q => recordAnswer(q.id, section, ses.answers[q.id] === q.answer));
    record();
    ses.submitted = true; ses.deadline = null; store.save();
    if (auto) toast(t('time_up'));
    renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  let timer = null;
  function tick() {
    const el = $('[data-timer] span', main);
    if (!el || !ses.deadline) return;
    const left = (ses.deadline - Date.now()) / 1000;
    el.textContent = fmtTime(left);
    el.parentElement.classList.toggle('warn', left < 300);
    if (left <= 0) submit(true);
  }
  if (mode === 'exam' && !ses.submitted) timer = setInterval(tick, 1000);

  main.onclick = e => {
    const opt = e.target.closest('.opt');
    if (opt) {
      const q = byId[opt.dataset.q]; const n = +opt.dataset.n;
      if (!q || reveal(q)) return;
      ses.touched = Date.now();
      if (mode === 'practice') {
        ses.answers[q.id] = n;
        recordAnswer(q.id, section, n === q.answer);
        if (answered() === qs.length && !ses.recorded) {
          record(); ses.recorded = true; store.save(); renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
        }
        store.save();
        opt.closest('.q').outerHTML = questionHtml(q, { chosen: n, reveal: true });
      } else {
        if (ses.answers[q.id] === n) delete ses.answers[q.id]; else ses.answers[q.id] = n;
        store.save();
        $$('.opt', opt.closest('.opts')).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.n === ses.answers[q.id])));
      }
      refreshBar();
      return;
    }
    const jump = e.target.closest('[data-jump]');
    if (jump) { e.preventDefault(); jump.closest('details').open = false; document.getElementById('q-' + jump.dataset.jump.replaceAll('.', '-'))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (e.target.closest('[data-submit]')) return submit(false);
    if (e.target.closest('[data-restart]')) {
      if (!confirm(t('confirm_restart'))) return;
      delete s.sessions[key]; store.save();
      clearInterval(timer);
      examRun(main, [String(id), section], params); return;
    }
    const m = e.target.closest('[data-mode]');
    if (m) location.hash = `#/exam/${id}/${section}?mode=${m.dataset.mode}`;
  };
  bindListening(main, qid => byId[qid]);
  renderAll();
  return () => { clearInterval(timer); main.onclick = null; };
}

/* ───────────────────────── full report ───────────────────────── */
export async function examReport(main, [id]) {
  const L = levelOf(id);
  const lv = LEVELS[L];
  const s = store.s;
  const ex = await exam(id);
  const secs = SECTIONS.filter(sec => ex.sections[sec]?.groups.length);
  const latest = sec => [...s.attempts].reverse().find(a => a.exam === id && a.section === sec && a.mode === 'exam');
  const atts = SECTIONS.map(latest);
  const sums = {};
  atts.forEach(a => a && Object.entries(a.parts || {}).forEach(([k, v]) => {
    const x = sums[k] || (sums[k] = { points: 0, max: 0 }); x.points += v.points; x.max += v.max; }));
  const rows = scaleParts(L, sums);
  const complete = secs.every(sec => latest(sec)) && rows.every(r => r.score != null);
  const total = rows.reduce((a, r) => a + (r.score || 0), 0);
  const pass = complete && total >= lv.pass && rows.every(r => r.score >= r.min);
  main.innerHTML = `<div class="page doc">
    <a class="small link" href="#/exams">${t('nav_exams')}</a>
    <header class="page-head"><h1 class="title">${t('full_report')} <span class="muted">${L} · ${testNameFromKey(id)}</span></h1></header>
    ${complete ? `<section class="panel result">
      <div class="stamp ${pass ? '' : 'fail'}" lang="ja">${pass ? '合格' : '不合格'}</div>
      <div class="stack">
        <div class="stack flush"><span class="fig" style="font:500 56px/1 var(--f-mincho)">${total}<small style="font-size:22px;color:var(--ink-3)"> / 180</small></span>
          <span class="small ${pass ? 'ok-t' : 'muted'}">${t(pass ? 'pass' : 'fail')} · ${passLine(L)}</span></div>
        ${rows.map(r => `<div class="partbar"><span class="small">${t('part_' + r.key)}</span><span class="mono small">${r.score} / ${r.max}</span>
          <div class="track"><i style="width:${r.score / r.max * 100}%"></i><b style="left:${r.min / r.max * 100}%" title="${r.min}"></b></div></div>`).join('')}
        <p class="meta">${t('scaled_note')}</p>
      </div></section>`
    : `<div class="panel empty"><p>${t('report_missing')}</p></div>`}
    <section class="panel compact"><div class="rows">${secs.map(sec => { const a = latest(sec); return `<a class="rowlink" href="#/exam/${id}/${sec}?mode=exam">
      <span class="mincho faint" lang="ja">${secKanji(sec, L)}</span><span class="label small">${secLabel(sec, L)}</span>
      <span class="meta">${a ? `${a.correct}/${a.total}` : t('filter_todo')}</span>${icon('chevron')}</a>`; }).join('')}</div></section>
  </div>`;
}
