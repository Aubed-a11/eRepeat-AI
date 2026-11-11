/* État de l'élève : maîtrise par chapitre, historique, séances. Enregistré sur l'appareil, puis envoyé au serveur. */
import { TAGS } from './content.js';
import { CHN, SUBJECTS, freeId, topicsOfGrade } from './catalog.js';

export const emptyFocus = () => ({ subj: 'm', tid: '', topic: '', course: '' });
export const emptyState = () => ({ diag: false, mastery: {}, hist: [], done: [], chat: [], focus: emptyFocus() });
export function loadState(uid) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('erepeat_ai_v2_' + uid)); } catch (e) { /* aucun état */ }
  d = d || {};
  return { diag: !!d.diag, mastery: d.mastery || {}, hist: d.hist || [], done: d.done || [], chat: d.chat || [], focus: { ...emptyFocus(), ...(d.focus || {}) } };
}
export function storeState(uid, s) { try { localStorage.setItem('erepeat_ai_v2_' + uid, JSON.stringify(s)); } catch (e) { /* plein */ } }
export const dropState = uid => { try { localStorage.removeItem('erepeat_ai_v2_' + uid); } catch (e) { /* rien */ } };

export const P = (s, id) => (typeof s.mastery[id] === 'number' ? s.mastery[id] : null);
export const levelFor = (s, id) => { const p = P(s, id); if (p === null) return 2; return p < .4 ? 1 : p < .7 ? 2 : 3; };
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
export function streak(s) {
  const set = {}; s.hist.forEach(h => { set[dayKey(h.t)] = 1; });
  let n = 0; const d = new Date();
  if (!set[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (set[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const weekDone = s => { const lim = Date.now() - 7 * 864e5; return s.done.filter(t => t > lim).length; };
export function rate(s) {
  const r = s.hist.filter(h => h.first !== undefined && h.first !== null);
  if (!r.length) return null;
  return Math.round(100 * r.filter(h => h.first).length / r.length);
}
/* Sujets évalués de la classe de l'élève (sujets du catalogue de sa classe, plus les sujets libres). */
export const evaluated = (s, grade) => topicsOfGrade(grade).concat(SUBJECTS.map(x => CHN(freeId(x.id)))).filter(t => P(s, t.id) !== null);
export const ranked = (s, grade) => evaluated(s, grade).sort((a, b) => P(s, a.id) - P(s, b.id));
export function topTag(s, chap) {
  const l = s.hist.filter(h => h.tag && (!chap || h.chap === chap)).slice(-20);
  if (!l.length) return null;
  const c = {}; l.forEach(h => { c[h.tag] = (c[h.tag] || 0) + 1; });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
}
export function globalPct(s, grade) {
  const v = evaluated(s, grade).map(t => P(s, t.id));
  return v.length ? Math.round(100 * v.reduce((a, b) => a + b, 0) / v.length) : null;
}
export function reco(s, name, grade) {
  const rk = ranked(s, grade);
  if (!rk.length) return { chap: null, text: 'Commence par un diagnostic dans la matière de ton choix, ' + name + '. Il me permet de repérer tes points forts et ce qu’il faut renforcer.', reason: 'Aucun résultat pour le moment : le diagnostic sert de point de départ.' };
  const w = rk[0], p = Math.round(P(s, w.id) * 100), t = topTag(s, w.id) || topTag(s);
  return {
    chap: w.id,
    text: 'Aujourd’hui, travaille « ' + w.name + ' » : tu maîtrises ' + p + ' % de ce sujet.' + (t ? ' Des erreurs de type « ' + TAGS[t].toLowerCase() + ' » ont été repérées dans tes derniers exercices.' : ''),
    reason: 'Ce sujet a le niveau de maîtrise le plus bas parmi ceux que tu as déjà travaillés' + (t ? ', et c’est là que reviennent le plus tes erreurs « ' + TAGS[t].toLowerCase() + ' ».' : '.')
  };
}
/* Moyenne de maîtrise, tous sujets confondus (vues du parent et du répétiteur). */
export const gpOf = m => { const v = Object.keys(m || {}).map(k => m[k]).filter(x => typeof x === 'number'); return v.length ? Math.round(100 * v.reduce((a, b) => a + b, 0) / v.length) : null; };
