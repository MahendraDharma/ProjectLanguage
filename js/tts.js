// Listening via Web Speech API: reads the transcript with a ja-JP voice.
// Speaker labels (男：/女：) switch pitch so dialogues are easier to follow.
import { store } from './store.js';

const synth = window.speechSynthesis;
export const ttsSupported = !!synth && 'SpeechSynthesisUtterance' in window;
let voices = [];
function refresh() { voices = ttsSupported ? synth.getVoices().filter(v => /^ja(-|_|$)/i.test(v.lang)) : []; }
if (ttsSupported) { refresh(); synth.onvoiceschanged = refresh; }
export const jaVoices = () => (refresh(), voices);

function pickVoice(gender) {
  const vs = jaVoices(); if (!vs.length) return null;
  const pref = store.s.settings.voice;
  if (pref) { const v = vs.find(v => v.name === pref); if (v) return v; }
  const male = /otoya|ichiro|keita|daichi|naoki|male|男/i, female = /kyoko|haruka|ayumi|nanami|sayaka|female|女|google/i;
  if (gender === 'm') return vs.find(v => male.test(v.name)) || vs[0];
  if (gender === 'f') return vs.find(v => female.test(v.name)) || vs[0];
  return vs[0];
}

/** Split transcript text into utterance segments with a speaker hint. */
export function segments(text) {
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const out = [];
  let last = null;
  for (let line of lines) {
    let who = null;
    const m = line.match(/^(男|女|男の人|女の人|M|F|店員|客|先生|学生)\s*[:：]\s*/);
    if (m) { who = /女|F/.test(m[1]) ? 'f' : 'm'; line = line.slice(m[0].length); }
    if (/^[1-4１-４]\s/.test(line)) who = 'n';
    out.push({ who: who || last || 'n', text: line });
    if (who && who !== 'n') last = who; else if (!who) last = null;
  }
  return out;
}

let token = 0;
export function stop() { token++; if (ttsSupported) synth.cancel(); }

/** Speak segments sequentially. Returns a promise that resolves when done or stopped. */
export function speak(text, { onEnd } = {}) {
  stop();
  if (!ttsSupported) return Promise.reject(new Error('no-tts'));
  const my = ++token;
  const segs = segments(text);
  const rate = +store.s.settings.rate || 1;
  return new Promise(resolve => {
    let i = 0;
    const next = () => {
      if (my !== token || i >= segs.length) { onEnd && onEnd(); return resolve(); }
      const s = segs[i++];
      const u = new SpeechSynthesisUtterance(s.text);
      u.lang = 'ja-JP'; u.rate = rate;
      const v = pickVoice(s.who); if (v) u.voice = v;
      u.pitch = s.who === 'm' ? 0.8 : s.who === 'f' ? 1.2 : 1;
      u.onend = () => setTimeout(next, s.who === 'n' ? 450 : 250);
      u.onerror = () => setTimeout(next, 50);
      synth.speak(u);
    };
    next();
  });
}
