const { SMTPServer } = require('smtp-server'); const { simpleParser } = require('mailparser');
const { spawn } = require('child_process'); const fs = require('fs'), os = require('os'), path = require('path');
const mails = [];
const smtp = new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS'], onData(stream, s, cb) { simpleParser(stream).then(m => { mails.push(m); cb(); }); } });
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + m); if (!c) fails++; };
smtp.listen(2525, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'er-'));
  const PGL = !!process.env.PGLITE_DIR, PGR = !!process.env.DATABASE_URL, PG = PGL || PGR;
  const spawnSrv = () => spawn('node', ['server.js'], { env: { ...process.env, PORT: '3100', DATA_DIR: dir, ...(PGL ? { PGLITE_DIR: path.join(dir, 'pg') } : {}), ALLOWED_ORIGIN: 'https://erepeat.vercel.app, https://app.example.bj/', SMTP_HOST: '127.0.0.1', SMTP_PORT: '2525', SMTP_INSECURE: '1', MAIL_FROM: 'eRepeat AI <horticeadognigbo@gmail.com>', RESEND_GAP_SECONDS: '1' }, stdio: 'inherit' });
  let srv = spawnSrv(); console.log('Base testée : ' + (PGR ? 'PostgreSQL réel (pilote pg)' : PGL ? 'PostgreSQL (PGlite)' : 'fichier JSON'));
  const ready = async () => { for (let i = 0; i < 80; i++) { try { const h = await fetch('http://127.0.0.1:3100/api/health'); if (h.ok) return; } catch (e) { /* pas encore prêt */ } await new Promise(r => setTimeout(r, 250)); } throw new Error('serveur non démarré'); };
  await ready();
  const B = 'http://127.0.0.1:3100/api';
  const call = async (m, p, body, tok) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const lastCode = () => (mails[mails.length - 1].text.match(/\b(\d{6})\b/) || [])[1];
  try {
    // Inscription élève
    let r = await call('POST', '/signup', { role: 'student', name: 'Koffi', email: 'koffi@test.bj', password: 'motdepasse1', consent: true });
    ok(r.s === 200 && r.j.email === 'ko***@test.bj', 'inscription élève acceptée, e-mail masqué');
    await wait(400);
    ok(mails.length === 1 && /horticeadognigbo@gmail.com/.test(mails[0].from.text) && mails[0].to.text === 'koffi@test.bj', 'e-mail reçu par le serveur SMTP, expéditeur horticeadognigbo@gmail.com');
    ok(/^Ton code eRepeat AI : \d{6}$/.test(mails[0].subject), 'objet : ' + mails[0].subject);
    r = await call('POST', '/login', { email: 'koffi@test.bj', password: 'motdepasse1' }); ok(r.s === 403 && r.j.error === 'unverified', 'connexion refusée tant que le compte n’est pas validé');
    r = await call('POST', '/verify', { email: 'koffi@test.bj', code: '000000' }); ok(r.s === 400, 'mauvais code refusé : ' + r.j.message);
    const code = lastCode();
    r = await call('POST', '/verify', { email: 'koffi@test.bj', code }); ok(r.s === 200 && r.j.token && r.j.user.role === 'student', 'bon code : compte validé et connecté');
    const tokS = r.j.token;
    r = await call('POST', '/verify', { email: 'koffi@test.bj', code }); ok(r.s === 400, 'le code ne sert qu’une fois');
    r = await call('POST', '/signup', { role: 'parent', name: 'X', email: 'koffi@test.bj', password: 'motdepasse1', consent: true }); ok(r.s === 400, 'prénom trop court refusé');
    r = await call('POST', '/signup', { role: 'parent', name: 'Xavier', email: 'koffi@test.bj', password: 'motdepasse1', consent: true }); ok(r.s === 409, 'adresse déjà utilisée refusée');
    r = await call('POST', '/signup', { role: 'parent', name: 'Marie', email: 'marie@test.bj', password: 'court', consent: true }); ok(r.s === 400 && r.j.error === 'password', 'mot de passe trop court refusé');
    r = await call('POST', '/signup', { role: 'parent', name: 'Marie', email: 'marie@test.bj', password: 'motdepasse2', consent: false }); ok(r.s === 400 && r.j.error === 'consent', 'consentement obligatoire');
    // parent
    r = await call('POST', '/signup', { role: 'parent', name: 'Marie', email: 'marie@test.bj', password: 'motdepasse2', consent: true }); ok(r.s === 200, 'inscription parent');
    await wait(300); r = await call('POST', '/verify', { email: 'marie@test.bj', code: lastCode() }); const tokP = r.j.token; ok(!!tokP && r.j.user.role === 'parent', 'parent validé');
    // répétiteur : renvoi du code
    r = await call('POST', '/signup', { role: 'tutor', name: 'Pascal', email: 'pascal@test.bj', password: 'motdepasse3', consent: true }); ok(r.s === 200, 'inscription répétiteur');
    await wait(300); const n1 = mails.length; r = await call('POST', '/resend', { email: 'pascal@test.bj' }); await wait(300);
    ok(mails.length === n1, 'renvoi trop rapide : pas de second e-mail'); await wait(1100); r = await call('POST', '/resend', { email: 'pascal@test.bj' }); await wait(400);
    ok(mails.length === n1 + 1, 'renvoi du code après le délai');
    r = await call('POST', '/verify', { email: 'pascal@test.bj', code: lastCode() }); const tokT = r.j.token; ok(!!tokT, 'répétiteur validé avec le nouveau code');
    // essais limités
    r = await call('POST', '/signup', { role: 'student', name: 'Ama', email: 'ama@test.bj', password: 'motdepasse4', consent: true }); await wait(300);
    let last; for (let i = 0; i < 6; i++) last = await call('POST', '/verify', { email: 'ama@test.bj', code: '111111' }); ok(last.s === 429 || last.j.error === 'too_many', 'au bout de 5 essais le code est invalidé');
    r = await call('POST', '/verify', { email: 'ama@test.bj', code: lastCode() }); ok(r.s === 400, 'même le bon code est refusé après l’invalidation');
    // connexion
    r = await call('POST', '/login', { email: 'koffi@test.bj', password: 'faux' }); ok(r.s === 401, 'mauvais mot de passe refusé');
    r = await call('POST', '/login', { email: 'koffi@test.bj', password: 'motdepasse1' }); ok(r.s === 200 && r.j.token, 'connexion élève');
    // liaison
    r = await call('GET', '/me', null, tokS); const lc = r.j.user.matricule; ok(/^EL-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(lc), 'matricule élève : ' + lc);
    ok(/^PA-/.test((await call('GET', '/me', null, tokP)).j.user.matricule) && /^RE-/.test((await call('GET', '/me', null, tokT)).j.user.matricule), 'matricules parent (PA-) et répétiteur (RE-)');
    r = await call('POST', '/link', { code: 'ZZZZ-ZZZZ' }, tokP); ok(r.s === 404, 'code de liaison inconnu refusé');
    r = await call('POST', '/link', { matricule: lc.toLowerCase() }, tokP); ok(r.s === 200 && r.j.student === 'Koffi', 'parent lié à l’élève');
    r = await call('POST', '/link', { matricule: lc.slice(3) }, tokT); ok(r.s === 200, 'répétiteur lié à l’élève');
    r = await call('POST', '/link', { code: lc }, tokS); ok(r.s === 403, 'un élève ne peut pas se lier');
    // progrès
    r = await call('PUT', '/progress', { mastery: { m_eq: 0.2, m_calc: 0.8, hack: 5 }, hist: [{ t: Date.now(), chap: 'm_eq', ok: false, first: false, tag: 'signe' }, { t: Date.now(), chap: 'm_eq', ok: true, first: true, tag: null }, { chap: 'zzz', t: 1 }], done: [Date.now()] }, tokS); ok(r.s === 200, 'résultats envoyés par l’élève');
    r = await call('GET', '/children', null, tokP); const ch = r.j.children[0];
    ok(ch && ch.name === 'Koffi' && ch.summary.mastery.m_eq === 0.2 && !('hack' in ch.summary.mastery) && ch.summary.exercises === 2 && ch.summary.rate === 50 && ch.summary.errors.signe === 1, 'le parent voit les résultats filtrés (2 exercices, 50 %, 1 erreur de signe)');
    // devoirs
    r = await call('POST', '/assign', { studentId: ch.studentId, chap: 'm_eq', note: 'Revois la méthode avant jeudi' }, tokP); ok(r.s === 403, 'un parent ne peut pas donner de devoir');
    r = await call('POST', '/assign', { studentId: ch.studentId, chap: 'm_eq', note: 'Revois la méthode avant jeudi' }, tokT); ok(r.s === 200, 'devoir donné par le répétiteur'); const aid = r.j.id;
    r = await call('GET', '/assignments', null, tokS); ok(r.j.assignments.length === 1 && r.j.assignments[0].tutor === 'Pascal', 'l’élève voit le devoir');
    r = await call('POST', '/assignments/' + aid + '/done', null, tokS); ok(r.s === 200, 'devoir marqué fait');
    r = await call('GET', '/children', null, tokT); ok(r.j.children[0].assignments[0].doneAt > 0, 'le répétiteur voit le devoir fait');
    r = await call('GET', '/children', null, tokS); ok(r.s === 403, 'un élève ne lit pas la liste d’enfants');
    r = await call('GET', '/children'); ok(r.s === 401, 'accès sans jeton refusé');

    // ----- cours, exercices, travail en ligne
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 65)]).toString('base64');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]).toString('base64');
    const dl = async (id, tok) => { const x = await fetch(B + '/files/' + id, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} }); return { s: x.status, t: x.headers.get('content-type'), n: (await x.arrayBuffer()).byteLength }; };
    r = await call('POST', '/works', { kind: 'cours', title: 'Pythagore', body: 'Dans un triangle rectangle…' }, tokP); ok(r.s === 403, 'un parent ne peut pas publier de contenu');
    r = await call('POST', '/works', { kind: 'cours', title: 'Pythagore : le cours', subject: 'Mathématiques', body: 'Dans un triangle rectangle, BC² = AB² + AC².', file: { name: 'cours pythagore.pdf', data: pdf } }, tokT); ok(r.s === 200, 'cours publié avec un PDF'); const wc = r.j.id;
    r = await call('POST', '/works', { kind: 'cours', title: 'Faux', body: 'x', file: { name: 'a.pdf', data: Buffer.from('<html><script>alert(1)</script></html>').toString('base64') } }, tokT); ok(r.s === 400 && r.j.error === 'file', 'faux PDF (HTML déguisé) refusé');
    r = await call('POST', '/works', { kind: 'cours', title: 'Trop gros', body: 'x', file: { name: 'a.pdf', data: Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(3.2 * 1024 * 1024)]).toString('base64') } }, tokT); ok(r.s === 400 && /3 Mo/.test(r.j.message), 'fichier de plus de 3 Mo refusé');
    r = await call('POST', '/works', { kind: 'exercice', title: 'Questions', questions: [{ q: 'Une seule réponse', opts: ['a', ''], ans: 0 }] }, tokT); ok(r.s === 400 && r.j.error === 'questions', 'question avec une seule réponse refusée');
    r = await call('POST', '/works', { kind: 'exercice', title: 'Quiz Pythagore', subject: 'Mathématiques', due: '2026-12-01', questions: [{ q: 'Hypoténuse ?', opts: ['Le plus long côté', 'Le plus court côté', 'Un angle'], ans: 0, expl: 'Elle est en face de l’angle droit.' }, { q: '3² + 4² = ?', opts: ['25', '49', '12', '7'], ans: 0 }] }, tokT); ok(r.s === 200, 'exercice à choix publié'); const wq = r.j.id;
    r = await call('POST', '/works', { kind: 'exercice', title: 'Rédaction', body: 'Décris ton marché préféré.' }, tokT); ok(r.s === 200, 'exercice à réponse libre publié'); const wf = r.j.id;
    r = await call('GET', '/works', null, tokS); ok(r.j.works.length === 3 && r.j.works[0].tutor.matricule.startsWith('RE-'), 'l’élève voit ses 3 contenus, avec le matricule du répétiteur');
    r = await call('GET', '/works/' + wq, null, tokS); ok(r.j.work.questions.length === 2 && !('ans' in r.j.work.questions[0]) && r.j.sub === null, 'l’élève ne reçoit pas les bonnes réponses avant de répondre');
    r = await call('POST', '/submit/' + wq, { answers: [0] }, tokS); ok(r.s === 400, 'réponses incomplètes refusées');
    r = await call('POST', '/submit/' + wq, { answers: [0, 1] }, tokS); ok(r.s === 200 && r.j.sub.score === 1 && r.j.sub.total === 2 && r.j.sub.results[1].ok === false && r.j.sub.results[1].ans === 0, 'correction automatique : 1/2, bonne réponse indiquée');
    r = await call('POST', '/submit/' + wq, { answers: [0, 0] }, tokS); ok(r.s === 200 && r.j.sub.score === 2 && r.j.sub.attempts === 2, 'nouvel essai : 2/2');
    r = await call('POST', '/submit/' + wf, { text: '' }, tokS); ok(r.s === 400, 'réponse libre vide refusée');
    r = await call('POST', '/submit/' + wf, { text: 'Mon marché, c’est Dantokpa.', file: { name: 'brouillon.png', data: png } }, tokS); ok(r.s === 200, 'réponse libre avec photo déposée');
    r = await call('POST', '/submit/' + wc, { text: 'x' }, tokS); ok(r.s === 404, 'on ne répond pas à un cours');
    r = await call('GET', '/works/' + wf, null, tokT); const sub = r.j.work.submissions[0]; ok(sub.student.name === 'Koffi' && sub.student.matricule === lc && sub.text.includes('Dantokpa') && sub.hasFile, 'le répétiteur voit le travail de Koffi avec son matricule');
    r = await call('POST', '/submissions/' + sub.id + '/feedback', { text: 'Bien ! Ajoute le nom du quartier.' }, tokT); ok(r.s === 200, 'commentaire du répétiteur');
    r = await call('GET', '/works/' + wf, null, tokS); ok(r.j.sub.feedback.text.startsWith('Bien'), 'l’élève lit le commentaire');
    r = await call('POST', '/submissions/' + sub.id + '/feedback', { text: 'x' }, tokP); ok(r.s === 403, 'un parent ne commente pas');
    r = await call('GET', '/works/' + wc, null, tokS); const fid = r.j.work.fileId;
    let f = await dl(fid, tokS); ok(f.s === 200 && f.t === 'application/pdf' && f.n === 209, 'l’élève télécharge le PDF du cours');
    f = await dl(fid, tokT); ok(f.s === 200, 'le répétiteur télécharge son PDF');
    f = await dl(fid, tokP); ok(f.s === 404, 'un parent ne télécharge pas le cours');
    f = await dl(fid, null); ok(f.s === 401, 'téléchargement sans connexion refusé');
    r = await call('GET', '/works/' + wf, null, tokT); f = await dl(r.j.work.submissions[0].fileId, tokT); ok(f.s === 200 && f.t === 'image/png', 'le répétiteur télécharge la photo de l’élève');
    r = await call('GET', '/children', null, tokP); const pk = r.j.children[0]; ok(pk.matricule === lc && pk.works.length === 3 && pk.works.find(x => x.id === wq).score === 2 && pk.works.filter(x => x.done).length === 2, 'le parent voit les contenus faits et la note 2/2');
    r = await call('GET', '/me', null, tokS);
    // messagerie
    r = await call('GET', '/threads', null, tokS); const tT = r.j.threads; ok(tT.length === 1 && tT[0].user.role === 'tutor', 'l’élève ne peut écrire qu’à son répétiteur');
    const idT = tT[0].user.id, idS = (await call('GET', '/me', null, tokS)).j.user.id, idP = (await call('GET', '/me', null, tokP)).j.user.id;
    r = await call('POST', '/messages', { to: idP, text: 'Salut' }, tokS); ok(r.s === 403, 'élève → parent refusé');
    r = await call('POST', '/messages', { to: idT, text: 'Bonjour monsieur, j’ai fini l’exercice.' }, tokS); ok(r.s === 200, 'élève → répétiteur');
    r = await call('GET', '/unread', null, tokT); ok(r.j.n === 1, 'le répétiteur a 1 message non lu');
    r = await call('GET', '/messages/' + idS, null, tokT); ok(r.j.messages.length === 1 && r.j.with.matricule === lc, 'le répétiteur lit le message');
    r = await call('GET', '/unread', null, tokT); ok(r.j.n === 0, 'le message est marqué lu');
    r = await call('POST', '/messages', { to: idS, text: 'Bravo Koffi !' }, tokT); ok(r.s === 200, 'répétiteur → élève');
    r = await call('POST', '/messages', { to: idP, text: 'Koffi progresse bien.' }, tokT); ok(r.s === 200, 'répétiteur → parent de son élève');
    r = await call('GET', '/threads', null, tokP); ok(r.j.threads.length === 1 && r.j.threads[0].unread === 1, 'le parent voit son échange avec le répétiteur');
    r = await call('POST', '/messages', { to: idT, text: '   ' }, tokP); ok(r.s === 400, 'message vide refusé');
    r = await call('DELETE', '/works/' + wc, null, tokP); ok(r.s === 403, 'un parent ne supprime pas un contenu');
    r = await call('DELETE', '/works/' + wc, null, tokT); ok(r.s === 200 && (await dl(fid, tokT)).s === 404, 'contenu supprimé, document effacé');
    // l'élève retire le parent
    r = await call('GET', '/me', null, tokS); const lk = r.j.linked.find(x => x.role === 'parent');
    r = await call('DELETE', '/link/' + lk.linkId, null, tokS); ok(r.s === 200, 'l’élève retire le parent');
    r = await call('GET', '/children', null, tokP); ok(r.j.children.length === 0, 'le parent ne voit plus l’élève');
    // suppression du compte
    r = await call('DELETE', '/me', { password: 'faux' }, tokS); ok(r.s === 401, 'suppression refusée avec un mauvais mot de passe');
    r = await call('DELETE', '/me', { password: 'motdepasse1' }, tokS); ok(r.s === 200, 'compte élève supprimé');
    r = await call('GET', '/me', null, tokS); ok(r.s === 401, 'la session de l’élève n’existe plus');
    r = await call('POST', '/logout', null, tokP); ok(r.s === 200, 'déconnexion');
    // mot de passe oublié
    const nm = mails.length;
    r = await call('POST', '/forgot', { email: 'inconnu@test.bj' }); await wait(300); ok(r.s === 200 && mails.length === nm, 'adresse inconnue : même réponse, aucun e-mail');
    r = await call('POST', '/forgot', { email: 'pascal@test.bj' }); await wait(500); ok(r.s === 200 && mails.length === nm + 1 && /changer votre mot de passe/.test(mails[mails.length - 1].text), 'mot de passe oublié : code envoyé par e-mail');
    const rc = lastCode();
    r = await call('POST', '/reset', { email: 'pascal@test.bj', code: '000000', password: 'nouveaumdp1' }); ok(r.s === 400, 'reset : mauvais code refusé');
    r = await call('POST', '/reset', { email: 'pascal@test.bj', code: rc, password: 'court' }); ok(r.s === 400 && r.j.error === 'password', 'reset : mot de passe trop court refusé');
    r = await call('POST', '/verify', { email: 'pascal@test.bj', code: rc }); ok(r.s === 400, 'le code de réinitialisation ne valide pas un compte');
    r = await call('POST', '/reset', { email: 'pascal@test.bj', code: rc, password: 'nouveaumdp1' }); ok(r.s === 200 && r.j.token, 'reset : nouveau mot de passe accepté et connexion');
    const tokT2 = r.j.token;
    r = await call('POST', '/reset', { email: 'pascal@test.bj', code: rc, password: 'autremdp123' }); ok(r.s === 400, 'reset : le code ne sert qu’une fois');
    r = await call('GET', '/me', null, tokT); ok(r.s === 401, 'reset : les anciennes sessions sont fermées');
    r = await call('POST', '/login', { email: 'pascal@test.bj', password: 'motdepasse3' }); ok(r.s === 401, 'reset : l’ancien mot de passe ne marche plus');
    r = await call('POST', '/login', { email: 'pascal@test.bj', password: 'nouveaumdp1' }); ok(r.s === 200, 'reset : le nouveau mot de passe marche');
    // CORS pour le site sur Vercel
    let cr = await fetch(B + '/me', { method: 'OPTIONS', headers: { Origin: 'https://erepeat.vercel.app', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    ok(cr.status === 204 && cr.headers.get('access-control-allow-origin') === 'https://erepeat.vercel.app' && /Authorization/.test(cr.headers.get('access-control-allow-headers')), 'CORS : site Vercel autorisé');
    cr = await fetch(B + '/me', { method: 'OPTIONS', headers: { Origin: 'https://app.example.bj' } }); ok(cr.headers.get('access-control-allow-origin') === 'https://app.example.bj', 'CORS : deuxième origine autorisée (barre finale ignorée)');
    cr = await fetch(B + '/me', { method: 'OPTIONS', headers: { Origin: 'https://pirate.example' } }); ok(!cr.headers.get('access-control-allow-origin'), 'CORS : origine inconnue refusée');
    // redémarrage : les données sont bien conservées (liens, messages, session)
    r = await call('POST', '/signup', { role: 'student', name: 'Eli', email: 'eli@test.bj', password: 'motdepasse5', consent: true }); await wait(400);
    r = await call('POST', '/verify', { email: 'eli@test.bj', code: lastCode() }); const tokE = r.j.token; const matE = r.j.user.matricule, idE = r.j.user.id;
    r = await call('POST', '/link', { matricule: matE }, tokT2); ok(r.s === 200, 'avant redémarrage : nouvel élève lié au répétiteur');
    r = await call('POST', '/messages', { to: idE, text: 'Bienvenue Eli, à bientôt.' }, tokT2); ok(r.s === 200, 'avant redémarrage : message envoyé');
    srv.kill('SIGTERM'); await wait(PG ? 1500 : 500); srv = spawnSrv(); await ready();
    r = await call('POST', '/login', { email: 'pascal@test.bj', password: 'nouveaumdp1' }); ok(r.s === 200, 'après redémarrage : le compte et le nouveau mot de passe sont conservés'); const tokT3 = r.j.token;
    r = await call('GET', '/threads', null, tokT3); ok(r.s === 200 && r.j.threads.length === 1 && /Bienvenue Eli/.test(r.j.threads[0].last.text), 'après redémarrage : lien et message conservés');
    r = await call('GET', '/me', null, tokE); ok(r.s === 200 && r.j.user.matricule === matE, 'après redémarrage : la session et le matricule sont conservés');
    // mot de passe stocké haché
    srv.kill('SIGTERM'); await wait(PG ? 1500 : 500);
    if (PG) {
      let pdb; if (PGR) { const { Client } = require('pg'); const cl = new Client({ connectionString: process.env.DATABASE_URL }); await cl.connect(); pdb = { query: (q) => cl.query(q), close: () => cl.end() }; } else { const { PGlite } = require('@electric-sql/pglite'); pdb = new PGlite(path.join(dir, 'pg')); }
      const all = (await pdb.query('SELECT data::text AS d FROM records')).rows.map(x => x.d).join('\n'); const nf = (await pdb.query('SELECT count(*)::int AS n FROM files')).rows[0].n;
      ok(!all.includes('motdepasse') && !all.includes('nouveaumdp') && /passHash/.test(all), 'aucun mot de passe en clair dans PostgreSQL (hachage scrypt seulement)'); ok(nf >= 0, 'table des documents présente (' + nf + ' document(s))'); await pdb.close();
    } else {
      const raw = fs.readFileSync(path.join(dir, 'db.json'), 'utf8'); ok(!raw.includes('motdepasse') && !/"code"/.test(raw), 'aucun mot de passe en clair dans la base'); ok(fs.readdirSync(path.join(dir, 'files')).length >= 0, 'dossier des documents présent');
    }
  } catch (e) { console.error(e); fails++; }
  srv.kill(); smtp.close(); console.log(fails ? fails + ' ÉCHEC(S)' : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
});
