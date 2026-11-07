// Leitner spaced repetition: box 0..5 → review interval in days.
import { store, logActivity } from './store.js';
const INTERVAL = [0, 1, 3, 7, 14, 30];
const DAY = 86400000;
export const BOXES = INTERVAL.length;

export function cardState(id) { return store.s.srs[id]; }
export function isDue(id, now = Date.now()) { const c = store.s.srs[id]; return !!c && c.due <= now; }
export function grade(id, g) { // g: 0 again, 1 good, 2 easy
  const c = store.s.srs[id] || { box: 0, due: 0 };
  if (g === 0) { c.box = 0; c.due = Date.now() + 60 * 1000; }
  else { c.box = Math.min(BOXES - 1, c.box + g); c.due = startOfDay() + INTERVAL[c.box] * DAY; if (INTERVAL[c.box] === 0) c.due = Date.now() + 10 * 60 * 1000; }
  store.s.srs[id] = c; logActivity(1); store.save();
}
function startOfDay() { const d = new Date(); d.setHours(4, 0, 0, 0); return d.getTime(); }
export function dueCount(cards) { const now = Date.now(); return cards.filter(c => isDue(c.id, now)).length; }
export function boxCounts(cards) { const b = Array(BOXES).fill(0); cards.forEach(c => { const s = store.s.srs[c.id]; if (s) b[s.box]++; }); return b; }
