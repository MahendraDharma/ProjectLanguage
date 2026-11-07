import { t, LANGS } from '../i18n.js';
import { store } from '../store.js';
import { toast, esc } from '../util.js';
import { jaVoices, speak, ttsSupported } from '../tts.js';

export async function settings(main) {
  const s = store.s.settings;
  const voices = jaVoices();
  main.innerHTML = `<div class="page doc" style="max-width:640px">
    <header class="page-head"><h1 class="title">${t('settings_title')}</h1></header>
    <section class="panel stack">
      <div class="field"><label for="lang">${t('language')}</label>
        <select id="lang" class="input">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${s.lang === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><span class="label">${t('theme')}</span>
        <div class="seg" role="group">${['auto', 'light', 'dark'].map(x => `<button type="button" data-theme-set="${x}" aria-pressed="${s.theme === x}">${t('theme_' + x)}</button>`).join('')}</div></div>
      <div class="field"><label for="date">${t('exam_date')}</label><input id="date" class="input" type="date" value="${esc(s.examDate)}"></div>
      <div class="field"><label for="goal">${t('daily_goal')}</label><input id="goal" class="input" type="number" min="5" max="200" step="5" value="${s.dailyGoal}"></div>
      <label class="switch"><span class="small muted">${t('show_furigana')}</span><input type="checkbox" id="furi" ${s.furigana ? 'checked' : ''}></label>
    </section>
    <section class="panel stack">
      <div class="field"><label for="voice">${t('voice')}</label>
        <select id="voice" class="input" ${ttsSupported ? '' : 'disabled'}><option value="">${t('voice_auto')}</option>${voices.map(v => `<option ${s.voice === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
        ${!ttsSupported ? `<p class="meta">${t('no_tts')}</p>` : !voices.length ? `<p class="meta">${t('no_voice')}</p>` : ''}</div>
      <div class="field"><label for="rate">${t('voice_rate')} · <span id="rv">${s.rate}×</span></label>
        <div class="row"><input id="rate" type="range" min="0.6" max="1.4" step="0.05" value="${s.rate}" style="flex:1">
        <button class="btn sm" id="test" ${ttsSupported ? '' : 'disabled'}>${t('test_voice')}</button></div></div>
    </section>
    <section class="panel stack">
      <h2 class="h3">${t('data')}</h2><p class="small muted">${t('data_note')}</p>
      <div class="row"><button class="btn" id="exp">${t('export')}</button>
        <label class="btn" for="imp">${t('import')}</label><input id="imp" type="file" accept="application/json" hidden>
        <span class="spacer"></span><button class="btn ghost" id="reset" style="color:var(--ng)">${t('reset')}</button></div>
    </section>
    <section class="panel stack tight"><h2 class="h3">${t('about')}</h2><p class="small muted">${t('about_text')}</p>
      <p class="meta">Design pass: unslop by @heydamir (CC BY 4.0)</p></section>
  </div>`;
  const $ = s => main.querySelector(s);
  const save = (rerender = false) => { store.save(); toast(t('saved')); if (rerender) location.reload(); };
  $('#lang').onchange = e => { s.lang = e.target.value; store.save(); window.dispatchEvent(new HashChangeEvent('hashchange')); };
  main.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => { s.theme = b.dataset.themeSet; s.themeChosen = true; document.documentElement.dataset.theme = s.theme;
    main.querySelectorAll('[data-theme-set]').forEach(x => x.setAttribute('aria-pressed', x === b)); save(); });
  $('#date').onchange = e => { if (e.target.value) { s.examDate = e.target.value; save(); } };
  $('#goal').onchange = e => { s.dailyGoal = Math.max(5, Math.min(200, +e.target.value || 20)); save(); };
  $('#furi').onchange = e => { s.furigana = e.target.checked; document.body.classList.toggle('hide-furigana', !s.furigana); save(); };
  $('#voice').onchange = e => { s.voice = e.target.value; save(); };
  $('#rate').oninput = e => { s.rate = +e.target.value; $('#rv').textContent = s.rate + '×'; };
  $('#rate').onchange = () => save();
  $('#test').onclick = () => speak('男：すみません、駅はどこですか。\n女：まっすぐ行って、右に曲がったところです。').catch(() => toast(t('no_tts')));
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([store.export()], { type: 'application/json' }));
    a.download = `michi-n3-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#imp').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { store.import(await f.text()); toast(t('imported')); setTimeout(() => location.reload(), 600); } catch { toast(t('import_failed')); }
  };
  $('#reset').onclick = () => { if (confirm(t('confirm_reset'))) { store.reset(); location.reload(); } };
}
