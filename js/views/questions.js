// Shared question renderer used by mock tests and the mistakes review.
import { t } from '../i18n.js';
import { icon, esc, stripHtml, toast } from '../util.js';
import { speak, stop, ttsSupported, jaVoices } from '../tts.js';

const optNum = ['1', '2', '3', '4'];

/** transcript HTML → readable HTML with speaker labels highlighted */
export function transcriptHtml(html) {
  return html.replace(/(^|<br>|\n)\s*(男の人|女の人|男|女|店員|客|先生|学生)\s*[:：]/g, '$1<span class="who">$2：</span>');
}
const transcriptText = html => stripHtml(html.replace(/<br\s*\/?>/gi, '\n'));

/**
 * Render one question.
 * opts: { chosen, reveal (bool: show correctness), showScript, practice }
 */
export function questionHtml(q, { chosen, reveal, label } = {}) {
  const isListen = q.section === 'listening';
  const blank = q.options.every(o => !o.trim());
  const maxLen = Math.max(...q.options.map(o => stripHtml(o).length));
  const cols = blank ? 'cols-4' : maxLen <= 8 ? 'cols-4' : maxLen <= 18 ? 'cols-2' : '';
  const opts = q.options.map((o, i) => {
    const n = i + 1;
    let cls = '';
    if (reveal) { if (n === q.answer) cls = 'correct'; else if (n === chosen) cls = 'wrong'; }
    const mark = reveal && n === q.answer ? icon('check') : reveal && n === chosen ? icon('x') : '';
    return `<button type="button" class="opt ${cls}" data-q="${q.id}" data-n="${n}" aria-pressed="${chosen === n}" ${reveal ? 'aria-disabled="true"' : ''}>
      <span class="n">${optNum[i]}</span><span lang="ja">${blank ? '' : o}</span><span class="mark">${mark}</span></button>`;
  }).join('');
  const explain = q.explanation && reveal
    ? `<details class="explain-wrap" ${isListen ? '' : 'open'}><summary class="small" style="cursor:pointer;font-weight:600;color:var(--ai)">${isListen ? t('show_script') : t('explanation')}</summary>
       <div class="explain" lang="ja" style="margin-top:8px">${transcriptHtml(q.explanation)}</div></details>` : '';
  return `<article class="q ${reveal ? 'locked' : ''}" id="q-${q.id.replaceAll('.', '-')}" data-qid="${q.id}">
    <div class="q-meta"><span class="q-num">${label || ('Q' + q.n)}</span>${q.points > 1 ? `<span class="chip xs">${q.points}pt</span>` : ''}
      ${reveal ? `<span class="chip ${chosen === q.answer ? 'ok' : 'ng'}">${chosen === q.answer ? t('correct') : chosen ? t('wrong') : t('answer_is', { n: q.answer })}</span>` : ''}</div>
    ${isListen && q.explanation ? listenHtml(q) : ''}
    <div class="q-stem" lang="ja">${q.stem}</div>
    ${blank ? `<p class="xs muted">${t('listen_options')}</p>` : ''}
    <div class="opts ${cols}" role="group" aria-label="${esc(label || 'Q' + q.n)}">${opts}</div>
    ${explain}
  </article>`;
}

function listenHtml(q) {
  return `<div class="listen" data-listen="${q.id}">
    <button type="button" class="btn sm" data-play="${q.id}">${icon('play')}<span>${t('play')}</span></button>
    <div class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <span class="xs muted" style="flex:1">${t('replay_hint')}</span></div>`;
}

/** Wire up play buttons inside root. getQ(id) returns the question. */
export function bindListening(root, getQ) {
  // one handler per root: replace any handler left by a previous view
  if (root._listen) root.removeEventListener('click', root._listen);
  root._listen = e => {
    const b = e.target.closest('[data-play]'); if (!b) return;
    const q = getQ(b.dataset.play); if (!q) return;
    const box = b.closest('.listen');
    if (box.classList.contains('playing')) { stop(); return; }
    if (!ttsSupported) return toast(t('no_tts'));
    if (!jaVoices().length) toast(t('no_voice'));
    root.querySelectorAll('.listen.playing').forEach(x => setPlaying(x, false));
    setPlaying(box, true);
    speak(transcriptText(q.explanation), { onEnd: () => setPlaying(box, false) })
      .catch(() => setPlaying(box, false));
  };
  root.addEventListener('click', root._listen);
}
function setPlaying(box, on) {
  box.classList.toggle('playing', on);
  const b = box.querySelector('[data-play]');
  if (b) b.innerHTML = `${icon(on ? 'stop' : 'play')}<span>${t(on ? 'stop' : 'play')}</span>`;
}
