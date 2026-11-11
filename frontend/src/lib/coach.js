/* Coach : l'IA du serveur si elle est activée, sinon quelques conseils de méthode hors connexion. */
import { api } from './api.js';

/* ctx : { grade, subjName, topic, course }. Renvoie le texte de l'IA, ou lève une erreur (code ai_off si l'IA n'est pas activée). */
export async function askAI(messages, ctx) {
  const r = await api('POST', '/coach', { messages, subject: ctx.subjName || '', topic: ctx.topic || '', course: ctx.course || '' });
  return r.text;
}

export function localCoach(msg, ctx) {
  const l = msg.toLowerCase();
  if (/équation|equation|inconnue/.test(l)) return 'Une équation est une égalité avec une valeur inconnue. Pour commencer, repère ce qui est ajouté ou soustrait à x. Quelle opération vois-tu dans ton exemple ?';
  if (/pythagore|triangle|hypoténuse/.test(l)) return 'Repère d’abord l’angle droit : le côté en face est l’hypoténuse, le plus long. Écris ensuite : hypoténuse² = somme des carrés des deux autres côtés. Quelles sont les longueurs que tu connais ?';
  if (/développ|dévelop|réduire|littéral/.test(l)) return 'Pour développer k(x + m), le nombre k multiplie chaque terme de la parenthèse. Essaie d’écrire k × x puis k × m, et dis-moi ce que tu obtiens.';
  if (/figure|métaphore|comparaison|hyperbole/.test(l)) return 'Cherche d’abord un mot de comparaison (comme, pareil à). S’il y en a un, c’est une comparaison, sinon pense à la métaphore. Quelle phrase veux-tu analyser ?';
  if (/conjug|temps|verbe|subjonctif/.test(l)) return 'Repère le mot qui indique le moment (hier, demain, quand j’étais petit, si…). Il t’aide à choisir le temps. Quelle phrase te pose problème ?';
  if (/indice/.test(l)) return 'Regarde l’opération qui accompagne l’inconnue. Pour l’annuler, utilise l’opération inverse des deux côtés de l’égalité. Essaie la première étape et dis-moi ce que tu trouves.';
  if (/merci/.test(l)) return 'Avec plaisir ! Continue comme ça. Veux-tu faire un exercice pour t’entraîner ?';
  if (ctx && ctx.topic) return 'Tu travailles « ' + ctx.topic + ' ». Je ne peux pas encore analyser ta question en détail. Écris l’exercice ou l’étape qui te bloque, relis ton cours, puis essaie une première étape. Ton répétiteur peut aussi t’aider.';
  return 'Merci pour ta question. Pour bien t’aider, montre-moi l’exercice ou explique l’étape qui te bloque. Nous avançons progressivement, avec un indice à la fois.';
}
