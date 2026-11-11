/* Coach : réponses de base hors connexion, ou passerelle IA si VITE_AI_ENDPOINT est défini. */
import { CH, TAGS } from './content.js';
import { P, topTag } from './student.js';
import { AI_ENDPOINT } from './api.js';

export const AI_ON = !!AI_ENDPOINT;
const SYSTEM = 'Tu es eRepeat AI, tuteur numérique pour des collégiens du Bénin (classe de 3e, programmes béninois : mathématiques et français). Règles : tutoie l’élève ; phrases courtes et simples ; guide par indices progressifs : pose d’abord une question ou donne un premier indice, ne donne pas la réponse finale d’un exercice tant que l’élève n’a pas essayé ; si l’élève a essayé deux fois et reste bloqué, explique la méthode pas à pas sur un exemple différent ; vérifie chaque calcul avec soin avant de l’écrire ; utilise si possible des exemples de la vie courante au Bénin (marché, prix en francs CFA, trajets) ; réponds uniquement sur le travail scolaire ; ne demande jamais de données personnelles ; si tu n’es pas sûr, dis-le et invite à demander au répétiteur ; réponse de 6 lignes maximum, sans tableau, symboles mathématiques en texte simple (x², ×, ÷, −).';

function context(s, name) {
  const m = CH.map(c => { const p = P(s, c.id); return c.name + ' : ' + (p === null ? 'non évalué' : Math.round(p * 100) + ' %'); }).join(' ; ');
  const t = topTag(s);
  return 'Contexte élève : prénom ' + name + ', classe de 3e. Maîtrise par chapitre : ' + m + '.' + (t ? ' Erreur la plus fréquente : ' + TAGS[t].toLowerCase() + '.' : '');
}

export function localCoach(msg) {
  const l = msg.toLowerCase();
  if (/équation|equation|inconnue/.test(l)) return 'Une équation est une égalité avec une valeur inconnue. Pour commencer, repère ce qui est ajouté ou soustrait à x. Quelle opération vois-tu dans ton exemple ?';
  if (/pythagore|triangle|hypoténuse/.test(l)) return 'Repère d’abord l’angle droit : le côté en face est l’hypoténuse, le plus long. Écris ensuite : hypoténuse² = somme des carrés des deux autres côtés. Quelles sont les longueurs que tu connais ?';
  if (/développ|dévelop|réduire|littéral/.test(l)) return 'Pour développer k(x + m), le nombre k multiplie chaque terme de la parenthèse. Essaie d’écrire k × x puis k × m, et dis-moi ce que tu obtiens.';
  if (/figure|métaphore|comparaison|hyperbole/.test(l)) return 'Cherche d’abord un mot de comparaison (comme, pareil à). S’il y en a un, c’est une comparaison, sinon pense à la métaphore. Quelle phrase veux-tu analyser ?';
  if (/conjug|temps|verbe|subjonctif/.test(l)) return 'Repère le mot qui indique le moment (hier, demain, quand j’étais petit, si…). Il t’aide à choisir le temps. Quelle phrase te pose problème ?';
  if (/indice/.test(l)) return 'Regarde l’opération qui accompagne l’inconnue. Pour l’annuler, utilise l’opération inverse des deux côtés de l’égalité. Essaie la première étape et dis-moi ce que tu trouves.';
  if (/merci/.test(l)) return 'Avec plaisir ! Continue comme ça. Veux-tu faire un exercice pour t’entraîner ?';
  return 'Merci pour ta question. Pour bien t’aider, montre-moi l’exercice ou explique l’étape qui te bloque. Nous avançons progressivement, avec un indice à la fois.';
}

export async function askAI(messages, s, name) {
  if (!AI_ENDPOINT) throw Object.assign(new Error('local'), { code: 'local' });
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(AI_ENDPOINT, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: SYSTEM + '\n\n' + context(s, name), messages }) });
    if (!res.ok) throw Object.assign(new Error('http'), { code: 'http' });
    const j = await res.json();
    return j.text;
  } finally { clearTimeout(tm); }
}
