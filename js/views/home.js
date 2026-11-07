import { t, lang } from '../i18n.js';
import { store, streak, today } from '../store.js';
import { icon, pct, esc } from '../util.js';
import { examIndex, vocabCards, grammar, SECTIONS, KANJI } from '../data.js';
import { dueCount } from '../srs.js';

export async function home(main) {
  const s = store.s;
  const [idx, cards, gram] = await Promise.all([examIndex(), vocabCards(), grammar()]);
  const days = Math.ceil((new Date(s.settings.examDate + 'T00:00') - new Date(today() + 'T00:00')) / 86400000);
  const totalAnswered = Object.values(s.stats).reduce((a, x) => a + x.t, 0);
  const totalCorrect = Object.values(s.stats).reduce((a, x) => a + x.c, 0);
  const due = dueCount(cards);
  const newCards = cards.filter(c => !s.srs[c.id]).length;
  const mistakes = Object.keys(s.mistakes).length;
  const nextGrammar = gram.find(g => !s.learned[g.id]);
  const taken = new Set(s.attempts.map(a => a.exam));
  const nextExam = idx.exams.find(e => !taken.has(e.id)) || idx.exams[0];
  const recent = [...s.attempts].reverse().slice(0, 5);
  const dateFmt = new Intl.DateTimeFormat(lang() === 'ja' ? 'ja-JP' : lang() === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // resume an unfinished session
  const resumeKey = Object.entries(s.sessions).filter(([, v]) => !v.submitted && Object.keys(v.answers || {}).length)
    .sort((a, b) => (b[1].touched || 0) - (a[1].touched || 0))[0];

  const plan = [
    due ? { href: '#/vocab', ic: 'cards', title: t('plan_cards'), sub: t('due_now', { n: due }) }
        : { href: '#/vocab', ic: 'cards', title: t('plan_cards'), sub: `${t('new_cards')}: ${newCards}` },
    nextGrammar && { href: `#/grammar/${nextGrammar.id}`, ic: 'grammar', title: t('plan_grammar'), sub: `<span lang="ja" class="jp">${esc(nextGrammar.pattern)}</span>` },
    mistakes ? { href: '#/mistakes', ic: 'mistakes', title: t('plan_mistakes'), sub: `${mistakes}` } : null,
    { href: `#/exam/${nextExam.id}/vocab`, ic: 'exam', title: t('plan_exam'), sub: t('test_n', { n: nextExam.id }) },
  ].filter(Boolean).slice(0, 4);

  main.innerHTML = `
  <div class="page">
    <section class="hero" aria-labelledby="hero-title">
      <div class="stack">
        <span class="eyebrow">${t('hello')} · JLPT N3</span>
        <h1 id="hero-title">${t('hero_title')}</h1>
        <p class="lede">${t('hero_sub')}</p>
        <div class="row" style="margin-top:8px">
          ${resumeKey
            ? `<a class="btn primary" href="#/exam/${resumeKey[0].split('/')[0]}/${resumeKey[0].split('/')[1]}?mode=${resumeKey[0].split('/')[2]}">${icon('play')}${t('continue')} · ${t('test_n', { n: resumeKey[0].split('/')[0] })} ${t('sec_' + resumeKey[0].split('/')[1])}</a>`
            : `<a class="btn primary" href="${plan[0].href}">${icon('arrow')}${t('start_today')}</a>`}
          <a class="btn" href="#/exams">${t('nav_exams')}</a>
        </div>
      </div>
      <div class="stack tight" style="justify-self:end;text-align:right">
        <div class="countdown" style="justify-content:flex-end"><b>${Math.max(0, days)}</b><span class="muted">${t('days_left')}</span></div>
        <span class="small muted">${t('until_exam')} · ${dateFmt.format(new Date(s.settings.examDate + 'T00:00'))}</span>
        <a class="small" href="#/settings">${t('set_exam_date')}</a>
      </div>
    </section>

    <section class="grid c4" aria-label="Stats">
      ${statCard('flame', streak(), t('streak'))}
      ${statCard('check', totalAnswered, t('answered'))}
      ${statCard('sparkle', totalAnswered ? pct(totalCorrect, totalAnswered) + '%' : '—', t('accuracy'))}
      ${statCard('cards', due, t('cards_due'))}
    </section>

    <div class="grid c2">
      <section class="card stack" aria-labelledby="plan-h">
        <h2 id="plan-h" class="h3">${t('today_plan')}</h2>
        <div class="list">
          ${plan.map(p => `<a class="row" href="${p.href}" style="color:inherit;text-decoration:none;flex-wrap:nowrap">
            <span class="chip ai" style="width:36px;height:36px;padding:0;justify-content:center">${icon(p.ic)}</span>
            <span class="stack tight" style="gap:0;min-width:0"><b class="small">${p.title}</b><span class="xs muted">${p.sub}</span></span>
            <span class="spacer"></span>${icon('arrow', 'muted')}</a>`).join('')}
        </div>
      </section>
      <section class="card stack" aria-labelledby="skill-h">
        <h2 id="skill-h" class="h3">${t('skills')}</h2>
        ${SECTIONS.map(sec => { const st = s.stats[sec] || { c: 0, t: 0 }; const p = pct(st.c, st.t);
          return `<div class="skill-row"><span><span class="jp" lang="ja" style="color:var(--ink-3);margin-right:6px">${KANJI[sec]}</span>${t('sec_' + sec)}</span>
            <div class="meter ${p >= 70 ? 'ok' : p < 50 && st.t ? 'shu' : ''}"><i style="width:${p}%"></i></div><b>${st.t ? p + '%' : '—'}</b></div>`; }).join('')}
        <p class="xs muted">${t('pass_line')}</p>
      </section>
    </div>

    <section class="card stack" aria-labelledby="recent-h">
      <div class="section-head"><h2 id="recent-h" class="h3">${t('recent')}</h2><a class="small" href="#/exams">${t('nav_exams')} →</a></div>
      ${recent.length ? `<div class="list">${recent.map(a => `
        <a class="row" style="color:inherit;text-decoration:none" href="#/exam/${a.exam}/${a.section}?mode=${a.mode}">
          <span class="jp" lang="ja" style="font-weight:700;width:24px;color:var(--ink-3)">${KANJI[a.section]}</span>
          <span class="small"><b>${t('test_n', { n: a.exam })}</b> · ${t('sec_' + a.section)}</span>
          <span class="chip ${a.mode === 'exam' ? 'shu' : ''}">${t('mode_' + a.mode)}</span>
          <span class="spacer"></span>
          <b class="small" style="font-variant-numeric:tabular-nums">${pct(a.points, a.max)}%</b>
          <span class="xs muted">${new Date(a.date).toLocaleDateString()}</span>
        </a>`).join('')}</div>`
        : `<div class="empty" style="padding:24px"><p class="small">${t('no_attempts')}</p><a class="btn" href="#/exam/${nextExam.id}/vocab">${t('plan_exam')}</a></div>`}
    </section>
  </div>`;
}

const statCard = (ic, val, label) => `<div class="card stat">
  <span class="row" style="gap:8px;color:var(--ink-3)">${icon(ic)}<span class="xs" style="font-weight:600">${label}</span></span>
  <b style="margin-top:8px">${val}</b></div>`;
