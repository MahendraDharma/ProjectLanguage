import { t, lang } from '../i18n.js';
import { store, streak, today } from '../store.js';
import { icon, pct, esc } from '../util.js';
import { examIndex, vocabCards, grammar, SECTIONS, KANJI } from '../data.js';
import { dueCount } from '../srs.js';

const PASS_PCT = 95 / 180 * 100;
const locale = () => ({ ja: 'ja-JP', id: 'id-ID', en: 'en-GB' }[lang()]);

export async function home(main) {
  const s = store.s;
  const [idx, cards, gram] = await Promise.all([examIndex(), vocabCards(), grammar()]);
  const examDate = new Date(s.settings.examDate + 'T00:00');
  const days = Math.max(0, Math.ceil((examDate - new Date(today() + 'T00:00')) / 86400000));
  const answered = Object.values(s.stats).reduce((a, x) => a + x.t, 0);
  const correct = Object.values(s.stats).reduce((a, x) => a + x.c, 0);
  const todayCount = s.days[today()] || 0;
  const due = dueCount(cards);
  const fresh = cards.filter(c => !s.srs[c.id]).length;
  const mistakes = Object.keys(s.mistakes).length;
  const nextGrammar = gram.find(g => !s.learned[g.id]);
  const learned = gram.filter(g => s.learned[g.id]).length;
  const doneSets = idx.exams.filter(e => SECTIONS.every(sec => !e.counts[sec] || s.attempts.some(a => a.exam === e.id && a.section === sec))).length;
  const taken = new Set(s.attempts.map(a => a.exam));
  const nextExam = idx.exams.find(e => !taken.has(e.id)) || idx.exams[0];
  const resume = Object.entries(s.sessions).filter(([, v]) => !v.submitted && Object.keys(v.answers || {}).length)
    .sort((a, b) => (b[1].touched || 0) - (a[1].touched || 0))[0];
  const dateLong = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' }).format(examDate);

  let primary;
  if (resume) {
    const [e, sec, mode] = resume[0].split('/');
    primary = `<a class="btn primary lg" href="#/exam/${e}/${sec}?mode=${mode}">${t('continue')} · ${t('test_n', { n: e })}, ${t('sec_' + sec)}</a>`;
  } else {
    primary = `<a class="btn primary lg" href="#/exam/${nextExam.id}/vocab">${t('plan_exam')} · ${t('test_n', { n: nextExam.id })}</a>`;
  }

  const plan = [
    { href: '#/vocab', ic: 'cards', label: t('plan_cards'), meta: due ? t('due_now', { n: due }) : t('new_avail', { n: fresh }) },
    nextGrammar && { href: `#/grammar/${nextGrammar.id}`, ic: 'grammar', label: `${t('plan_grammar')} <span class="faint" lang="ja">${esc(nextGrammar.pattern)}</span>`, meta: `${learned}/${gram.length}` },
    mistakes && { href: '#/mistakes', ic: 'mistakes', label: t('plan_mistakes'), meta: String(mistakes) },
    { href: `#/exam/${nextExam.id}/vocab`, ic: 'exam', label: t('plan_exam'), meta: t('test_n', { n: nextExam.id }) },
  ].filter(Boolean);

  const recent = [...s.attempts].reverse().slice(0, 6);
  const dfmt = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' });

  main.innerHTML = `
  <div class="page">
    <section class="home-hero" aria-labelledby="hero-title">
      <div class="stack">
        <p class="meta">${t('hello')}</p>
        <h1 id="hero-title" lang="${lang()}">${t('hero_title')}</h1>
        <p class="sub">${t('hero_sub')}</p>
        <div class="actions">${primary}<a class="btn lg" href="#/exams">${t('nav_exams')}</a></div>
      </div>
      <div class="ticket-wrap">${ticketHtml({ days, dateLong, doneSets, total: idx.exams.length, learned, gramTotal: gram.length })}</div>
    </section>

    <section class="stats" aria-label="${t('nav_home')}">
      ${stat(t('streak'), streak(), todayCount ? t('studied_today') : t('days_streak_none'))}
      ${stat(t('answered'), answered.toLocaleString(locale()), t('vs_today', { n: todayCount }))}
      ${stat(t('accuracy'), answered ? pct(correct, answered) + '%' : '—', answered ? t('of_answers', { n: answered.toLocaleString(locale()) }) : '')}
    </section>

    <div class="dash">
      <section class="panel chart" aria-labelledby="chart-h">
        <div class="panel-head"><h2 id="chart-h" class="h3">${t('chart_title')}</h2>
          <div class="legend">${SECTIONS.map((sec, i) => `<span><i style="background:var(--ink${i ? '-' + (i + 1) : ''})"></i>${t('sec_' + sec)}</span>`).join('')}</div></div>
        <div data-chart>${chartSvg(s.attempts)}</div>
        ${s.attempts.length ? '' : `<p class="small faint" style="margin-top:12px">${t('chart_empty')}</p>`}
      </section>
      <div class="stack">
        <section class="panel compact" aria-labelledby="plan-h">
          <h2 id="plan-h" class="h3" style="margin-bottom:8px">${t('today_plan')}</h2>
          <div class="rows">${plan.map(p => `<a class="rowlink" href="${p.href}">${icon(p.ic)}<span class="label small">${p.label}</span><span class="meta">${p.meta}</span>${icon('chevron')}</a>`).join('')}</div>
        </section>
        <section class="panel compact" aria-labelledby="sec-h">
          <div class="panel-head" style="margin-bottom:4px"><h2 id="sec-h" class="h3">${t('skills')}</h2><span class="meta">${t('accuracy')}</span></div>
          <div class="rows">${SECTIONS.map(sec => { const st = s.stats[sec] || { c: 0, t: 0 }; const p = pct(st.c, st.t);
            return `<div class="secrow"><span class="small">${t('sec_' + sec)}</span><span class="meta">${st.t ? p + '%' : '—'}</span>
              <div class="bar"><i style="transform:scaleX(${p / 100})"></i></div></div>`; }).join('')}</div>
          <p class="meta" style="margin-top:8px">${t('pass_line')}</p>
        </section>
      </div>
    </div>

    <section class="panel" aria-labelledby="recent-h">
      <div class="panel-head"><h2 id="recent-h" class="h3">${t('recent')}</h2><a class="small link" href="#/exams">${t('nav_exams')}</a></div>
      ${recent.length ? `<table class="results"><thead><tr><th>${t('col_test')}</th><th>${t('col_section')}</th><th class="hide-m">${t('col_mode')}</th><th class="r">${t('col_score')}</th><th class="r hide-m">${t('col_date')}</th></tr></thead><tbody>
        ${recent.map(a => `<tr data-href="#/exam/${a.exam}/${a.section}?mode=${a.mode}"><td>${t('test_n', { n: a.exam })}</td><td>${t('sec_' + a.section)}</td>
          <td class="hide-m faint">${t('mode_' + a.mode)}</td><td class="r mono">${a.correct}/${a.total} · ${pct(a.points, a.max)}%</td><td class="r meta hide-m">${dfmt.format(new Date(a.date))}</td></tr>`).join('')}
        </tbody></table>`
      : `<div class="empty" style="padding:8px 0"><p class="small">${t('no_attempts')}</p><a class="btn sm" href="#/exam/${nextExam.id}/vocab">${t('plan_exam')}</a></div>`}
    </section>
  </div>`;
  const box = main.querySelector('[data-chart]');
  const draw = () => { const w = Math.round(box.clientWidth); if (w > 0) box.innerHTML = chartSvg(s.attempts, w); };
  draw();
  const ro = new ResizeObserver(draw); ro.observe(box);
  main.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.hash = tr.dataset.href; });
  return () => ro.disconnect();
}

const stat = (label, fig, change) => `<div class="panel compact stat"><span class="label">${label}</span><span class="fig">${fig}</span><span class="meta">${change}</span></div>`;

function ticketHtml({ days, dateLong, doneSets, total, learned, gramTotal }) {
  return `<article class="ticket" aria-label="${t('ticket_title')}">
    <div class="ticket-head"><b lang="ja">受験票</b><span>${t('ticket_practice')}</span></div>
    <div class="ticket-grid">
      <div class="ticket-cell"><small>${t('ticket_level')}</small><b>N3</b></div>
      <div class="ticket-cell"><small>${t('ticket_date')}</small><b>${esc(dateLong)}</b></div>
    </div>
    <div class="ticket-grid">
      <div class="ticket-cell"><small>${t('ticket_sets')}</small><b class="tnum">${doneSets} / ${total}</b></div>
      <div class="ticket-cell"><small>${t('ticket_cards')}</small><b class="tnum">${learned} / ${gramTotal}</b></div>
    </div>
    <div class="ticket-days">
      <div><small style="font:400 11px/14px var(--f-ui);color:var(--paper-ink-2)">${t('ticket_left')}</small><div class="big">${days}<small>${t('days_left')}</small></div></div>
      <div class="note">${t('ticket_practice_note')}</div>
    </div>
  </article>`;
}

/** Line chart: one series per section, % score per attempt, pass line in the accent. */
function chartSvg(attempts, W = 640) {
  const H = W < 480 ? 220 : 300, L = 36, R = 12, T = 12, B = 28;
  const list = attempts.slice(-16);
  const n = Math.max(list.length, 2);
  const x = i => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => T + (H - T - B) * (1 - v / 100);
  let g = '';
  for (const v of [0, 25, 50, 75, 100]) g += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  g += `<line class="pass" x1="${L}" x2="${W - R}" y1="${y(PASS_PCT)}" y2="${y(PASS_PCT)}"/><text class="pass-label" x="${W - R}" y="${y(PASS_PCT) - 6}" text-anchor="end">${t('chart_pass')} 95/180</text>`;
  SECTIONS.forEach((sec, si) => {
    const pts = list.map((a, i) => ({ a, i })).filter(p => p.a.section === sec).map(p => [x(p.i), y(pct(p.a.points, p.a.max))]);
    if (!pts.length) return;
    if (pts.length > 1) g += `<path class="s${si}" fill="none" stroke-width="1.5" d="${smooth(pts)}"/>`;
    pts.forEach(([px, py], k) => { g += `<circle class="d${si}" cx="${px}" cy="${py}" r="${k === pts.length - 1 ? 3.5 : 2.5}"/>`; });
  });
  if (list.length) {
    const df = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' });
    g += `<text class="axis" x="${x(0)}" y="${H - 6}" text-anchor="start">${df.format(new Date(list[0].date))}</text>`;
    if (list.length > 1) g += `<text class="axis" x="${x(list.length - 1)}" y="${H - 6}" text-anchor="end">${df.format(new Date(list[list.length - 1].date))}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${t('chart_title')}">${g}</svg>`;
}
function smooth(p) {
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length; i++) { const [x0, y0] = p[i - 1], [x1, y1] = p[i]; const cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
  return d;
}
