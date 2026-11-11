/* Fausse IA (format de l'API Anthropic) pour les tests de bout en bout : 4 exercices exacts, résolution exacte, coach qui répète le contexte. */
const http = require('http');
http.createServer((rq, rs) => {
  let d = ''; rq.on('data', c => { d += c; }); rq.on('end', () => {
    const send = text => { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ content: [{ type: 'text', text }] })); };
    const b = JSON.parse(d), sys = b.system, user = b.messages[b.messages.length - 1].content;
    const w = (a, c, e) => [{ t: a, tag: 'calcul', why: 'Vérifie ton calcul.' }, { t: c, tag: 'methode', why: 'Mauvaise opération.' }, { t: e, tag: 'notion', why: 'Relis le cours.' }];
    const H = ['Indice 1', 'Indice 2', 'Indice 3'];
    if (/Tu es un enseignant/.test(sys)) {
      const topic = (/Sujet : (.*)\./.exec(user) || [])[1] || '';
      const course = /<cours>/.test(user) ? ' (cours)' : '';
      return send(JSON.stringify([3, 5, 7, 9, 11, 13, 15, 17].map((k, i) => ({ q: 'Combien font ' + k + ' + ' + (i + 1) + ' ? [' + topic + course + ']', sub: 'Calcule.', correct: String(k + i + 1), wrongs: w(String(k + i + 2), String(k + i), String(k * (i + 1) + 40)), hints: H, expl: k + ' + ' + (i + 1) + ' = ' + (k + i + 1) + '.' }))));
    }
    if (/correcteur/.test(sys)) {
      const out = [], re = /^(\d+)\. Combien font (\d+) \+ (\d+) \?[^\n]*\n((?:   \d+\) .*\n?)+)/gm; let m;
      while ((m = re.exec(user))) { const v = +m[2] + +m[3]; const opts = m[4].trim().split('\n').map(l => l.replace(/^\s*\d+\)\s*/, '')); out.push({ id: +m[1], calc: m[2] + '+' + m[3], choice: opts.indexOf(String(v)) }); }
      return send(JSON.stringify(out));
    }
    const cls = /classe de ([^\s.,]+)/.exec(sys), sj = /Matière travaillée : ([^.]*)\./.exec(sys), tp = /Sujet : ([^.\n]*)\./.exec(sys);
    send('Réponse IA | classe ' + (cls ? cls[1] : '?') + ' | ' + (sj ? sj[1] : '?') + ' | ' + (tp ? tp[1] : '?') + ' | ' + (/<cours>/.test(sys) ? 'cours lu' : 'sans cours'));
  });
}).listen(+process.env.PORT || 3199, '127.0.0.1');
