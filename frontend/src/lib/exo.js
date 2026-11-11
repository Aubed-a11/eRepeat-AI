/* Préparation des exercices : générateur local exact si le sujet en a un, sinon IA du serveur (vérifiée). */
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { mk, localFor } from './content.js';
import { CHN, gradeLabel } from './catalog.js';

let healthP = null;
/* Le serveur indique s'il a une clé IA. Résultat mis en cache pour la session. */
export function aiStatus() {
  if (!healthP) healthP = api('GET', '/health').then(h => !!(h && h.ai)).catch(() => { healthP = null; return false; });
  return healthP;
}
export const resetAiStatus = () => { healthP = null; };
/* null tant qu'on ne sait pas, puis true ou false. */
export function useAiOn() {
  const [on, setOn] = useState(null);
  useEffect(() => { let off = false; aiStatus().then(v => { if (!off) setOn(v); }); return () => { off = true; }; }, []);
  return on;
}

export const hasLocal = id => !!localFor(CHN(id));
export const localQ = (id, level) => { const f = localFor(CHN(id)); return f ? f(level) : null; };

export const fromAI = (e, chap, level) => mk({ chap, level, q: e.q, sub: e.sub || '', correct: e.correct, wrongs: e.wrongs, hints: e.hints, expl: e.expl });

/* Demande n exercices à l'IA pour ce sujet. Les exercices reçus ont déjà été vérifiés par le serveur. */
export async function aiQuestions({ chap, grade, subjName, topicName, level, n, course }) {
  const r = await api('POST', '/exercises', { grade, subject: subjName, topic: topicName, level, n, course: course || '' });
  return (r.exercises || []).map(e => fromAI(e, chap, level));
}
export { gradeLabel };
