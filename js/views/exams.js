import { t } from '../i18n.js';
import { store, recordAnswer } from '../store.js';
import { icon, esc, pct, fmtTime, toast, $, $$ } from '../util.js';
import { examIndex, exam, flatten, score, SECTIONS, KANJI, MINUTES } from '../data.js';
import { questionHtml, bindListening } from './questions.js';
import { stop as stopTts } from '../tts.js';

const PART_MAX = 60;

/* ───────────────────────── list ───────────────────────── */
export async function examList(main, _, params) {
  const idx = await examIndex();
  const s = store.s;
  const filter = params.get('f') || 'all';
  const best = (id, sec) => {
    const as = s.attempts.filter(a => a.exam === id && a.section === sec);
    return as.length ? Math.max(...as.map(a => pct(a.points, a.max))) : null;
  };
  const exams = idx.exams.filter(e => {
    const taken = s.attempts.some(a => a.exam === e.id);
    return filter === 'all' || (filter === 'done' ? taken : !taken);
  });
  main.innerHTML = `<div class="page wide">
    <header class="page-head">
      <span class="eyebrow">模擬試験 · ${idx.exams.length}</span>
      <h1 class="h1">${t('exams_title')}</h1>
      <p class="lede">${t('exams_lede')}</p>
    </header>
    <div class="row between">
      <div class="seg" role="group" aria-label="Filter">${['all', 'todo', 'done'].map(f =>
        `<button type="button" data-f="${f}" aria-pressed="${filter === f}">${t('filter_' + f)}</button>`).join('')}</div>
      <span class="small muted">${SECTIONS.map(x => `<span class="jp" lang="ja">${KANJI[x]}</span> ${t('sec_' + x)} ${MINUTES[x]}${t('minutes')}`).join(' · ')}</span>
    </div>
    <div class="grid auto" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
      ${exams.map(e => `<div class="card exam-card">
        <div class="row between"><span class="stack tight" style="gap:0"><span class="eyebrow">JLPT N3</span><span class="num">${t('test_n', { n: e.id })}</span></span>
          ${SECTIONS.every(sec => s.attempts.some(a => a.exam === e.id && a.section === sec && a.mode === 'exam'))
            ? `<a class="btn sm" href="#/report/${e.id}">${t('full_report')}</a>` : ''}</div>
        <div class="sec-links">${SECTIONS.map(sec => { const n = e.counts[sec] || 0; const b = best(e.id, sec);
          return `<a class="sec-link ${n ? '' : 'disabled'}" href="#/exam/${e.id}/${sec}" ${n ? '' : 'aria-disabled="true" tabindex="-1"'}>
            <span class="kanji" lang="ja">${KANJI[sec]}</span>
            <span><b style="font-weight:600">${t('sec_' + sec)}</b><br><span class="xs muted">${n ? `${n} ${t('questions')}` : t('not_available')}</span></span>
            ${b != null ? `<span class="chip ${b >= 60 ? 'ok' : 'ng'}">${t('best')} ${b}%</span>` : icon('arrow', 'muted')}</a>`; }).join('')}</div>
      </div>`).join('')}
    </div>
  </div>`;
  main.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { location.hash = `#/exams?f=${b.dataset.f}`; });
}

/* ───────────────────────── runner ───────────────────────── */
export async function examRun(main, [id, section], params) {
  id = +id;
  const mode = params.get('mode') === 'exam' ? 'exam' : 'practice';
  const ex = await exam(id);
  const qs = flatten(ex, section);
  const byId = Object.fromEntries(qs.map(q => [q.id, q]));
  const key = `${id}/${section}/${mode}`;
  const s = store.s;
  let ses = s.sessions[key];
  if (!ses) { ses = s.sessions[key] = { answers: {}, startedAt: Date.now() }; }
  if (mode === 'exam' && !ses.deadline && !ses.submitted) ses.deadline = Date.now() + MINUTES[section] * 60000;
  store.save();

  if (!qs.length) {
    main.innerHTML = `<div class="page"><div class="empty"><div class="display-jp">無</div><p>${t('not_available')}</p><a class="btn" href="#/exams">${t('back')}</a></div></div>`;
    return;
  }

  const answered = () => qs.filter(q => ses.answers[q.id] != null).length;
  const reveal = q => mode === 'practice' ? ses.answers[q.id] != null : !!ses.submitted;

  function summaryHtml() {
    const r = score(qs, ses.answers);
    const p = pct(r.points, r.max);
    const parts = Object.entries(r.parts);
    const idxSec = SECTIONS.indexOf(section);
    const nextSec = SECTIONS.slice(idxSec + 1).find(x => (ex.sections[x]?.groups || []).length);
    const allExam = SECTIONS.every(sec => !ex.sections[sec]?.groups.length || s.attempts.some(a => a.exam === id && a.section === sec && a.mode === 'exam'));
    return `<section class="card pad-lg result-hero" aria-label="${t('result')}">
      <div class="ring" style="--p:${p};--ring:${p >= 60 ? 'var(--ok)' : 'var(--shu)'}"><div><span><b>${p}%</b><br><span class="xs muted">${t('score')}</span></span></div></div>
      <div class="stack">
        <h2 class="h2">${t('correct_count', { c: r.correct, t: r.total })}</h2>
        <div class="row">${parts.map(([k, v]) => `<span class="chip ai">${t('part_' + k)} · ${Math.round(v.points / v.max * PART_MAX)}/${PART_MAX}</span>`).join('')}</div>
        <div class="row">
          ${nextSec ? `<a class="btn primary" href="#/exam/${id}/${nextSec}?mode=${mode}">${t('next_section')} · ${t('sec_' + nextSec)}</a>` : ''}
          ${mode === 'exam' && allExam ? `<a class="btn indigo" href="#/report/${id}">${t('full_report')}</a>` : ''}
          <button type="button" class="btn" data-restart>${t('restart')}</button>
        </div>
        <p class="xs muted">${t('scaled_note')}</p>
      </div></section>`;
  }

  function paletteHtml() {
    return qs.map(q => {
      const a = ses.answers[q.id];
      const cls = reveal(q) ? (a === q.answer ? 'ok' : 'ng') : a != null ? 'done' : '';
      return `<a href="#q" data-jump="${q.id}" class="${cls}">${q.n}</a>`;
    }).join('');
  }

  function barHtml() {
    const a = answered();
    const done = mode === 'practice' ? a === qs.length : ses.submitted;
    return `<div class="inner">
      <a class="btn ghost icon-btn" href="#/exams" aria-label="${t('back')}">${icon('back')}</a>
      <div class="stack tight title" style="gap:0">
        <b class="small">${t('test_n', { n: id })} · ${t('sec_' + section)}</b>
        <span class="xs muted" data-count>${t('answered_of', { a, t: qs.length })}</span>
      </div>
      <div class="meter ${done ? 'ok' : ''}"><i style="width:${pct(a, qs.length)}%"></i></div>
      ${mode === 'exam' && !ses.submitted ? `<span class="timer" data-timer>${icon('clock')}<span>--:--</span></span>
        <button type="button" class="btn primary sm" data-submit>${t('submit')}</button>` : ''}
      <details class="drawer" style="position:relative">
        <summary class="btn sm" aria-label="${t('questions_map')}">${icon('list')}</summary>
        <div class="card" style="position:absolute;right:0;top:46px;width:min(340px,86vw);z-index:30">
          <p class="eyebrow" style="margin-bottom:8px">${t('questions_map')}</p><div class="palette" data-palette>${paletteHtml()}</div></div>
      </details>
    </div>`;
  }

  function bodyHtml() {
    let lastPassage = null, html = '';
    const sec = ex.sections[section];
    sec.groups.forEach((g, gi) => {
      html += `<section class="group">${g.instruction ? `<div class="group-head" lang="ja">${g.instruction}</div>` : ''}`;
      qs.filter(q => q.gi === gi).forEach(q => {
        if (q.passage != null && q.passage !== lastPassage) {
          html += `<div class="passage" lang="ja">${q.passageHtml}</div>`; lastPassage = q.passage;
        }
        html += questionHtml(q, { chosen: ses.answers[q.id], reveal: reveal(q) });
      });
      html += `</section>`;
    });
    return html;
  }

  function renderAll() {
    const showSummary = mode === 'practice' ? answered() === qs.length : ses.submitted;
    main.innerHTML = `<div class="quiz-bar" data-bar>${barHtml()}</div>
      <div class="page" style="margin-top:24px">
        <div class="row between">
          <div class="seg" role="group" aria-label="${t('mode')}">${['practice', 'exam'].map(m =>
            `<button type="button" data-mode="${m}" aria-pressed="${mode === m}">${t('mode_' + m)}</button>`).join('')}</div>
          <div class="row" style="gap:6px">${SECTIONS.map(x => `<a class="btn sm ${x === section ? 'indigo' : ''}" href="#/exam/${id}/${x}?mode=${mode}" title="${t('sec_' + x)}" lang="ja">${KANJI[x]}</a>`).join('')}</div>
        </div>
        <h1 class="sr-only">${t('test_n', { n: id })} ${t('sec_' + section)}</h1>
        ${showSummary ? summaryHtml() : ''}
        ${bodyHtml()}
        <div class="row between">
          <a class="xs muted" href="${esc(ex.sections[section].source)}" target="_blank" rel="noopener">${t('source')}: dethitiengnhat.com ${icon('ext')}</a>
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

  function submit(auto) {
    if (ses.submitted) return;
    const left = qs.length - answered();
    if (!auto && left && !confirm(t('confirm_submit', { n: left }))) return;
    stopTts();
    const r = score(qs, ses.answers);
    qs.forEach(q => recordAnswer(q.id, section, ses.answers[q.id] === q.answer));
    s.attempts.push({ exam: id, section, mode, date: Date.now(), correct: r.correct, total: r.total, points: r.points, max: r.max, parts: r.parts });
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
      if (reveal(q)) return;
      ses.touched = Date.now();
      if (mode === 'practice') {
        ses.answers[q.id] = n;
        recordAnswer(q.id, section, n === q.answer);
        if (answered() === qs.length && !ses.recorded) {
          const r = score(qs, ses.answers);
          s.attempts.push({ exam: id, section, mode, date: Date.now(), correct: r.correct, total: r.total, points: r.points, max: r.max, parts: r.parts });
          ses.recorded = true; store.save(); renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
        }
        store.save();
        const art = opt.closest('.q');
        art.outerHTML = questionHtml(q, { chosen: n, reveal: true });
      } else {
        ses.answers[q.id] = ses.answers[q.id] === n ? undefined : n;
        if (ses.answers[q.id] === undefined) delete ses.answers[q.id];
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
  id = +id;
  const s = store.s;
  const latest = sec => [...s.attempts].reverse().find(a => a.exam === id && a.section === sec && a.mode === 'exam');
  const atts = SECTIONS.map(latest);
  const sum = { lang: { p: 0, m: 0 }, read: { p: 0, m: 0 }, listen: { p: 0, m: 0 } };
  atts.forEach(a => a && Object.entries(a.parts || {}).forEach(([k, v]) => { sum[k].p += v.points; sum[k].m += v.max; }));
  const scaled = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v.m ? Math.round(v.p / v.m * PART_MAX) : null]));
  const complete = atts.filter(Boolean).length >= 2 && Object.values(scaled).every(v => v != null);
  const total = Object.values(scaled).reduce((a, b) => a + (b || 0), 0);
  const pass = complete && total >= 95 && Object.values(scaled).every(v => v >= 19);
  main.innerHTML = `<div class="page">
    <a class="small" href="#/exams">← ${t('nav_exams')}</a>
    <header class="page-head"><span class="eyebrow">JLPT N3 · ${t('full_report')}</span><h1 class="h1">${t('test_n', { n: id })}</h1></header>
    ${complete ? `<section class="card pad-lg result-hero">
      <div class="hanko ${pass ? '' : 'fail'}" lang="ja">${pass ? '合格' : '不合格'}</div>
      <div class="stack">
        <div class="row" style="align-items:baseline"><b style="font:800 var(--t-4xl)/1 var(--f-display)">${total}</b><span class="muted">/ 180</span>
          <span class="chip ${pass ? 'ok' : 'ng'}">${t(pass ? 'pass' : 'fail')}</span></div>
        <p class="small muted">${t('pass_line')}</p>
      </div></section>
      <section class="grid c3">${Object.entries(scaled).map(([k, v]) => `<div class="card stack tight">
        <span class="eyebrow">${t('part_' + k)}</span><b style="font-size:var(--t-2xl)">${v}<span class="muted small"> / 60</span></b>
        <div class="meter ${v >= 19 ? 'ok' : 'shu'}"><i style="width:${v / 60 * 100}%"></i></div></div>`).join('')}</section>
      <p class="xs muted">${t('scaled_note')}</p>`
    : `<div class="card empty"><div class="display-jp">未</div><p>${t('report_missing')}</p></div>`}
    <section class="card stack"><div class="list">${SECTIONS.map((sec, i) => `<a class="row" style="color:inherit;text-decoration:none" href="#/exam/${id}/${sec}?mode=exam">
      <span class="jp" lang="ja" style="font-weight:700;width:24px;color:var(--ink-3)">${KANJI[sec]}</span><span class="small">${t('sec_' + sec)}</span><span class="spacer"></span>
      ${atts[i] ? `<b class="small">${t('correct_count', { c: atts[i].correct, t: atts[i].total })}</b>` : `<span class="chip">${t('filter_todo')}</span>`}${icon('arrow', 'muted')}</a>`).join('')}</div></section>
  </div>`;
}
