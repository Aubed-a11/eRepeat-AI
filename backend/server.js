'use strict';
/*
 * eRepeat AI : serveur des comptes.
 * - inscription (élève, parent, répétiteur) avec code à 6 chiffres envoyé par e-mail
 * - connexion par e-mail et mot de passe, jeton de session
 * - liaison parent/répétiteur avec un élève grâce à son matricule
 * - matricule pour chaque utilisateur, suivi des résultats, cours et exercices du répétiteur, travail en ligne, messagerie
 * Le serveur sert aussi l'application (dossier ../public).
 */
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

/* Lecture facultative du fichier .env (sans dépendance) */
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* pas de .env */ }

const PROD = process.env.NODE_ENV === 'production';
const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');
const ALLOWED_RAW = (process.env.ALLOWED_ORIGIN || '').split(',').map(x => x.trim().replace(/\/$/, '')).filter(Boolean);
/* ALLOWED_ORIGIN=* : n'importe quelle application (site, mobile) peut appeler l'API. Sans danger ici : l'accès se fait par jeton dans l'en-tête, jamais par cookie. */
const ALLOW_ANY = ALLOWED_RAW.includes('*');
const ALLOWED_ORIGINS = ALLOWED_RAW.filter(x => x !== '*');
const CODE_TTL = 10 * 60 * 1000;
const RESEND_GAP = (+process.env.RESEND_GAP_SECONDS || 30) * 1000;
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const CHAPTERS = ['m_eq', 'm_calc', 'm_pyth', 'f_fig', 'f_conj'];
const ROLES = ['student', 'parent', 'tutor'];

/* ---------- Configuration ---------- */
let SECRET = process.env.APP_SECRET || '';
if (PROD && SECRET.length < 24) {
  console.error('APP_SECRET manquant ou trop court (24 caractères minimum). Voir le fichier LISEZMOI.');
  process.exit(1);
}
if (!SECRET) SECRET = 'secret-de-developpement-a-ne-pas-utiliser-en-production';

function buildMailer() {
  const from = process.env.MAIL_FROM || (process.env.GMAIL_USER ? 'eRepeat AI <' + process.env.GMAIL_USER + '>' : 'eRepeat AI <no-reply@localhost>');
  if (process.env.BREVO_API_KEY) {
    /* Envoi par HTTPS (port 443) : fonctionne sur les hébergeurs qui bloquent les ports SMTP (Render gratuit, par exemple). */
    const url = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
    const t = {
      async sendMail({ from, to, subject, text, html }) {
        const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(from);
        const sender = m ? { name: (m[1] || '').trim() || 'eRepeat AI', email: m[2].trim() } : { name: 'eRepeat AI', email: String(from).trim() };
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 15000);
        try {
          const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text, htmlContent: html }) });
          if (!r.ok) throw new Error('Brevo a refusé l’envoi (HTTP ' + r.status + ') : ' + (await r.text()).slice(0, 200));
        } finally { clearTimeout(tm); }
      }
    };
    return { t, from, mode: 'brevo' };
  }
  if (process.env.SMTP_HOST) {
    const o = { host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587, secure: process.env.SMTP_SECURE === 'true' };
    if (process.env.SMTP_USER) o.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' };
    if (process.env.SMTP_INSECURE === '1') { o.ignoreTLS = true; o.tls = { rejectUnauthorized: false }; }
    return { t: nodemailer.createTransport(o), from, mode: 'smtp' };
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') } });
    return { t, from, mode: 'gmail' };
  }
  if (PROD && process.env.MAIL_MODE !== 'console') {
    console.error('Aucune messagerie configurée. Renseignez BREVO_API_KEY (recommandé en ligne) ou GMAIL_USER et GMAIL_APP_PASSWORD (voir LISEZMOI).');
    process.exit(1);
  }
  return { t: null, from, mode: 'console' };
}
const MAIL = buildMailer();

/* ---------- Base de données (PostgreSQL ou fichier JSON en développement) ---------- */
const { createStore, emptyDb } = require('./store');
const store = createStore(process.env, DATA_DIR);
if (PROD && store.kind === 'json') console.warn('ATTENTION : aucune base PostgreSQL (DATABASE_URL). Les données sont dans un fichier : à éviter en production.');
let db = emptyDb();
let dirty = false, timer = null, flushing = Promise.resolve();
function save() {
  dirty = true;
  if (timer) return;
  timer = setTimeout(() => { flush().catch(e => console.error('Écriture en base impossible :', e.message)); }, 200);
}
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!dirty) return flushing;
  dirty = false;
  flushing = flushing.then(() => store.flush(db)).catch(e => { dirty = true; throw e; });
  return flushing;
}
async function shutdown() {
  try { await flush(); await store.close(); } catch (e) { console.error(e.message); }
  process.exit(0);
}
['SIGINT', 'SIGTERM'].forEach(sg => process.on(sg, shutdown));

/* ---------- Utilitaires ---------- */
const now = () => Date.now();
const lower = s => String(s || '').trim().toLowerCase();
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const validEmail = e => e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const mask = e => { const [u, d] = e.split('@'); return u.slice(0, 2) + '***@' + d; };
const pub = u => ({ id: u.id, role: u.role, name: u.name, email: u.email, matricule: u.matricule });
const byEmail = e => Object.values(db.users).find(u => u.email === e);

async function hashPw(pw) { const salt = crypto.randomBytes(16); const k = await scrypt(pw, salt, 64); return salt.toString('hex') + ':' + k.toString('hex'); }
async function checkPw(pw, stored) {
  const [s, h] = String(stored || '0:0').split(':');
  const k = await scrypt(pw, Buffer.from(s, 'hex'), 64);
  return safeEq(k.toString('hex'), h);
}
const DUMMY = '00000000000000000000000000000000:' + '0'.repeat(128);

const hits = new Map();
function limit(key, max, ms) {
  const t = now(), h = hits.get(key);
  if (!h || t > h.reset) { hits.set(key, { n: 1, reset: t + ms }); return true; }
  h.n++;
  return h.n <= max;
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (t > v.reset) hits.delete(k); for (const [k, v] of Object.entries(db.sessions)) if (t > v.exp) delete db.sessions[k]; }, 10 * 60 * 1000).unref();

const LINK_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PFX = { student: 'EL', parent: 'PA', tutor: 'RE' };
function newMatricule(role) {
  for (;;) {
    let c = '';
    for (let i = 0; i < 8; i++) c += LINK_ALPHA[crypto.randomInt(LINK_ALPHA.length)];
    c = PFX[role] + '-' + c.slice(0, 4) + '-' + c.slice(4);
    if (!Object.values(db.users).some(u => u.matricule === c)) return c;
  }
}
function ensureMat(u) { if (!u.matricule || !u.matricule.startsWith(PFX[u.role] + '-')) u.matricule = newMatricule(u.role); }

/* ---------- E-mail ---------- */
async function sendCode(u, code, reset) {
  const tu = u.role === 'student';
  const what = reset ? (tu ? 'changer ton mot de passe' : 'changer votre mot de passe') : (tu ? 'valider ton compte' : 'valider votre compte');
  const ignore = reset ? (tu ? 'Si tu n’as rien demandé, ignore ce message : ton mot de passe ne change pas.' : 'Si vous n’avez rien demandé, ignorez ce message : votre mot de passe ne change pas.') : (tu ? 'Si tu n’as pas créé de compte, ignore ce message.' : 'Si vous n’avez pas créé de compte, ignorez ce message.');
  const subject = (tu ? 'Ton code eRepeat AI : ' : 'Votre code eRepeat AI : ') + code;
  const text = [
    'Bonjour ' + u.name + ',', '',
    (tu ? 'Voici ton code pour ' : 'Voici votre code pour ') + what + ' sur eRepeat AI :', '',
    '    ' + code, '',
    'Il est valable 10 minutes.',
    ignore, '',
    'L’équipe eRepeat AI'
  ].join('\n');
  const html = '<div style="font-family:Arial,sans-serif;color:#0f1e45;max-width:480px;margin:auto;padding:24px">' +
    '<h2 style="color:#02215a;margin:0 0 4px">eRepeat <span style="color:#609dee">AI</span></h2>' +
    '<p style="color:#5b6a90;margin:0 0 20px;font-style:italic">Apprendre • Répéter • Réussir</p>' +
    '<p>Bonjour ' + esc(u.name) + ',</p>' +
    '<p>' + (tu ? 'Voici ton code pour ' : 'Voici votre code pour ') + what + ' :</p>' +
    '<p style="font-size:34px;letter-spacing:8px;font-weight:700;background:#e3ebfd;border-radius:12px;padding:14px 0;text-align:center;color:#0c51dd">' + code + '</p>' +
    '<p>Il est valable 10 minutes.</p>' +
    '<p style="color:#5b6a90;font-size:13px">' + ignore + '</p></div>';
  if (!MAIL.t) { console.log('[e-mail simulé] à ' + u.email + ' : ' + subject); return; }
  await MAIL.t.sendMail({ from: MAIL.from, to: u.email, subject, text, html });
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function issueCode(u, reset) {
  const key = reset ? 'reset:' + u.id : u.id;
  const c = db.codes[key];
  const t = now();
  if (c && t - c.sent < RESEND_GAP) return { wait: Math.ceil((RESEND_GAP - (t - c.sent)) / 1000) };
  const hourStart = t - 3600 * 1000;
  const recent = (c && c.log ? c.log : []).filter(x => x > hourStart);
  if (recent.length >= 5) return { wait: 600 };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  recent.push(t);
  db.codes[key] = { hash: hmac(key + ':' + code), exp: t + CODE_TTL, attempts: 0, sent: t, log: recent };
  save();
  try { await sendCode(u, code, reset); } catch (e) {
    console.error('Échec d’envoi de l’e-mail :', e.message);
    delete db.codes[key]; save();
    return { fail: true };
  }
  return { ok: true };
}

/* ---------- Application Express ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const BIG = ['/api/works', '/api/submit'];
app.use(BIG, (req, res, next) => (req.method === 'POST' && !req.headers.authorization ? res.status(401).json({ error: 'auth', message: 'Connexion requise.' }) : next()), express.json({ limit: '6mb' }));
app.use(express.json({ limit: '60kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'" + (ALLOWED_ORIGINS.length ? ' ' + ALLOWED_ORIGINS.join(' ') : '') + "; frame-ancestors 'none'");
  if (req.headers.origin && (ALLOW_ANY || ALLOWED_ORIGINS.includes(req.headers.origin))) {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ANY ? '*' : req.headers.origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const fail = (res, status, error, message) => res.status(status).json({ error, message });
const ip = req => req.ip || 'x';

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const s = tok && db.sessions[sha(tok)];
  if (!s || now() > s.exp || !db.users[s.userId]) return fail(res, 401, 'auth', 'Session expirée. Reconnecte-toi.');
  req.user = db.users[s.userId]; req.tokenHash = sha(tok);
  next();
}
const need = role => (req, res, next) => req.user.role === role || (Array.isArray(role) && role.includes(req.user.role)) ? next() : fail(res, 403, 'role', 'Action non autorisée pour ce type de compte.');
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { console.error(e); fail(res, 500, 'server', 'Erreur du serveur. Réessaie dans un instant.'); });

function newSession(u) {
  const tok = crypto.randomBytes(32).toString('base64url');
  db.sessions[sha(tok)] = { userId: u.id, exp: now() + SESSION_TTL };
  save();
  return tok;
}

app.get('/api/health', (req, res) => res.json({ ok: true, mail: MAIL.mode }));

app.post('/api/signup', wrap(async (req, res) => {
  if (!limit('su:' + ip(req), 20, 3600e3)) return fail(res, 429, 'rate', 'Trop de tentatives. Réessaie plus tard.');
  const b = req.body || {};
  const role = b.role, email = lower(b.email), name = clean(b.name, 40), pw = String(b.password || '');
  if (!ROLES.includes(role)) return fail(res, 400, 'role', 'Choisis ton type de compte.');
  if (name.length < 2) return fail(res, 400, 'name', 'Écris ton prénom (2 lettres au moins).');
  if (!validEmail(email)) return fail(res, 400, 'email', 'Adresse e-mail invalide.');
  if (pw.length < 8 || pw.length > 72) return fail(res, 400, 'password', 'Le mot de passe doit contenir au moins 8 caractères.');
  if (b.consent !== true) return fail(res, 400, 'consent', 'Accepte les conditions pour créer ton compte.');
  let u = byEmail(email);
  if (u && u.verified) return fail(res, 409, 'email_used', 'Cette adresse e-mail a déjà un compte. Connecte-toi.');
  if (!u) { u = { id: crypto.randomUUID(), email, createdAt: now(), verified: false }; db.users[u.id] = u; }
  u.role = role; u.name = name; u.passHash = await hashPw(pw);
  ensureMat(u);
  save();
  const r = await issueCode(u);
  if (r.fail) return fail(res, 502, 'mail_failed', 'L’e-mail n’a pas pu être envoyé. Vérifie l’adresse et réessaie.');
  if (r.wait) return res.json({ ok: true, email: mask(email), wait: r.wait });
  res.json({ ok: true, email: mask(email), wait: RESEND_GAP / 1000 });
}));

app.post('/api/resend', wrap(async (req, res) => {
  const email = lower((req.body || {}).email);
  if (!limit('rs:' + ip(req), 20, 3600e3)) return fail(res, 429, 'rate', 'Trop de demandes. Réessaie plus tard.');
  const u = byEmail(email);
  if (u && !u.verified) {
    const r = await issueCode(u);
    if (r.fail) return fail(res, 502, 'mail_failed', 'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.');
    if (r.wait) return res.json({ ok: true, wait: r.wait });
  }
  res.json({ ok: true, wait: RESEND_GAP / 1000 });
}));

app.post('/api/verify', wrap(async (req, res) => {
  if (!limit('vf:' + ip(req), 40, 3600e3)) return fail(res, 429, 'rate', 'Trop de tentatives. Réessaie plus tard.');
  const email = lower((req.body || {}).email), code = String((req.body || {}).code || '').replace(/\D/g, '');
  const u = byEmail(email), c = u && db.codes[u.id];
  if (!u || !c) return fail(res, 400, 'invalid_code', 'Code incorrect ou expiré. Demande un nouveau code.');
  if (now() > c.exp) { delete db.codes[u.id]; save(); return fail(res, 400, 'expired', 'Ce code a expiré. Demande un nouveau code.'); }
  c.attempts++;
  if (c.attempts > 5) { delete db.codes[u.id]; save(); return fail(res, 429, 'too_many', 'Trop d’essais. Demande un nouveau code.'); }
  if (code.length !== 6 || !safeEq(hmac(u.id + ':' + code), c.hash)) { save(); return fail(res, 400, 'invalid_code', 'Code incorrect. Il te reste ' + (5 - c.attempts) + ' essai' + (5 - c.attempts > 1 ? 's' : '') + '.'); }
  u.verified = true; delete db.codes[u.id]; save();
  res.json({ token: newSession(u), user: pub(u) });
}));

/* ----- Mot de passe oublié : code par e-mail, puis nouveau mot de passe ----- */
app.post('/api/forgot', wrap(async (req, res) => {
  const email = lower((req.body || {}).email);
  if (!limit('fg:' + ip(req), 15, 3600e3) || !limit('fe:' + email, 5, 3600e3)) return fail(res, 429, 'rate', 'Trop de demandes. Réessaie plus tard.');
  const u = byEmail(email);
  if (u && u.verified) {
    const r = await issueCode(u, true);
    if (r.fail) return fail(res, 502, 'mail_failed', 'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.');
  }
  res.json({ ok: true, email: validEmail(email) ? mask(email) : '', wait: RESEND_GAP / 1000 });
}));

app.post('/api/reset', wrap(async (req, res) => {
  if (!limit('rp:' + ip(req), 40, 3600e3)) return fail(res, 429, 'rate', 'Trop de tentatives. Réessaie plus tard.');
  const b = req.body || {}, email = lower(b.email), code = String(b.code || '').replace(/\D/g, ''), pw = String(b.password || '');
  const u = byEmail(email), key = u && 'reset:' + u.id, c = u && db.codes[key];
  if (!u || !c || !u.verified) return fail(res, 400, 'invalid_code', 'Code incorrect ou expiré. Demande un nouveau code.');
  if (now() > c.exp) { delete db.codes[key]; save(); return fail(res, 400, 'expired', 'Ce code a expiré. Demande un nouveau code.'); }
  c.attempts++;
  if (c.attempts > 5) { delete db.codes[key]; save(); return fail(res, 429, 'too_many', 'Trop d’essais. Demande un nouveau code.'); }
  if (code.length !== 6 || !safeEq(hmac(key + ':' + code), c.hash)) { save(); return fail(res, 400, 'invalid_code', 'Code incorrect. Il te reste ' + (5 - c.attempts) + ' essai' + (5 - c.attempts > 1 ? 's' : '') + '.'); }
  if (pw.length < 8 || pw.length > 72) return fail(res, 400, 'password', 'Le mot de passe doit contenir au moins 8 caractères.');
  u.passHash = await hashPw(pw);
  delete db.codes[key];
  for (const [k, ss] of Object.entries(db.sessions)) if (ss.userId === u.id) delete db.sessions[k];
  save();
  res.json({ token: newSession(u), user: pub(u) });
}));

app.post('/api/login', wrap(async (req, res) => {
  const email = lower((req.body || {}).email), pw = String((req.body || {}).password || '');
  if (!limit('li:' + ip(req), 40, 900e3) || !limit('le:' + email, 10, 900e3)) return fail(res, 429, 'rate', 'Trop de tentatives. Réessaie dans quelques minutes.');
  const u = byEmail(email);
  const ok = await checkPw(pw, u ? u.passHash : DUMMY);
  if (!u || !ok) return fail(res, 401, 'login', 'E-mail ou mot de passe incorrect.');
  if (!u.verified) return fail(res, 403, 'unverified', 'Ton compte n’est pas encore validé. Entre le code reçu par e-mail.');
  res.json({ token: newSession(u), user: pub(u) });
}));

app.post('/api/logout', auth, (req, res) => { delete db.sessions[req.tokenHash]; save(); res.json({ ok: true }); });

function linkedAdults(studentId) {
  return db.links.filter(l => l.studentId === studentId).map(l => { const a = db.users[l.adultId]; return a ? { linkId: l.id, name: a.name, role: a.role, matricule: a.matricule } : null; }).filter(Boolean);
}
app.get('/api/me', auth, (req, res) => {
  const u = req.user, out = { user: pub(u) };
  if (u.role === 'student') out.linked = linkedAdults(u.id);
  res.json(out);
});

app.delete('/api/me', auth, wrap(async (req, res) => {
  const u = req.user;
  if (!(await checkPw(String((req.body || {}).password || ''), u.passHash))) return fail(res, 401, 'login', 'Mot de passe incorrect.');
  db.links = db.links.filter(l => l.studentId !== u.id && l.adultId !== u.id);
  db.assignments = db.assignments.filter(a => a.studentId !== u.id && a.tutorId !== u.id);
  purgeUserContent(u);
  delete db.progress[u.id]; delete db.codes[u.id];
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k];
  delete db.users[u.id]; save();
  res.json({ ok: true });
}));

/* ----- Résultats de l'élève ----- */
function sanitizeProgress(b) {
  const out = { mastery: {}, hist: [], done: [], updatedAt: now() };
  const m = (b && b.mastery) || {};
  CHAPTERS.forEach(k => { const v = +m[k]; if (isFinite(v) && m[k] !== null && m[k] !== undefined) out.mastery[k] = Math.max(0, Math.min(1, v)); });
  (Array.isArray(b && b.hist) ? b.hist.slice(-200) : []).forEach(h => {
    if (h && CHAPTERS.includes(h.chap) && isFinite(+h.t)) out.hist.push({ t: +h.t, chap: h.chap, ok: !!h.ok, first: h.first === undefined ? undefined : !!h.first, tag: ['methode', 'calcul', 'signe', 'oubli', 'notion'].includes(h.tag) ? h.tag : null });
  });
  (Array.isArray(b && b.done) ? b.done.slice(-60) : []).forEach(t => { if (isFinite(+t)) out.done.push(+t); });
  return out;
}
app.put('/api/progress', auth, need('student'), (req, res) => { db.progress[req.user.id] = sanitizeProgress(req.body); save(); res.json({ ok: true }); });
app.get('/api/progress', auth, need('student'), (req, res) => res.json(db.progress[req.user.id] || null));

function summarize(p) {
  if (!p) return { empty: true, mastery: {}, rate: null, exercises: 0, sessions: 0, week: 0, last: null, errors: {} };
  const firsts = p.hist.filter(h => h.first !== undefined), errors = {};
  p.hist.slice(-40).forEach(h => { if (h.tag) errors[h.tag] = (errors[h.tag] || 0) + 1; });
  const lim = now() - 7 * 864e5;
  return { empty: false, mastery: p.mastery, rate: firsts.length ? Math.round(100 * firsts.filter(h => h.first).length / firsts.length) : null, exercises: p.hist.length, sessions: p.done.length, week: p.done.filter(t => t > lim).length, last: p.hist.length ? p.hist[p.hist.length - 1].t : (p.done.length ? p.done[p.done.length - 1] : null), errors };
}

/* ----- Liaison parent / répétiteur avec un élève ----- */
app.post('/api/link', auth, need(['parent', 'tutor']), (req, res) => {
  if (!limit('lk:' + req.user.id, 15, 3600e3)) return fail(res, 429, 'rate', 'Trop de tentatives. Réessaie plus tard.');
  let raw = String((req.body || {}).matricule || (req.body || {}).code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length === 10 && raw.startsWith('EL')) raw = raw.slice(2);
  const code = 'EL-' + raw.slice(0, 4) + '-' + raw.slice(4);
  const s = raw.length === 8 && Object.values(db.users).find(u => u.role === 'student' && u.verified && u.matricule === code);
  if (!s) return fail(res, 404, 'code', 'Matricule introuvable. Vérifie-le avec l’élève (format EL-XXXX-XXXX).');
  if (db.links.some(l => l.studentId === s.id && l.adultId === req.user.id)) return fail(res, 409, 'exists', 'Cet élève est déjà dans ta liste.');
  db.links.push({ id: crypto.randomUUID(), studentId: s.id, adultId: req.user.id, at: now() });
  save();
  res.json({ ok: true, student: s.name });
});
app.delete('/api/link/:id', auth, (req, res) => {
  const i = db.links.findIndex(l => l.id === req.params.id && (l.studentId === req.user.id || l.adultId === req.user.id));
  if (i < 0) return fail(res, 404, 'link', 'Liaison introuvable.');
  const l = db.links[i]; db.links.splice(i, 1);
  db.assignments = db.assignments.filter(a => !(a.studentId === l.studentId && a.tutorId === l.adultId));
  dropStudentFromTutor(l.adultId, l.studentId);
  save(); res.json({ ok: true });
});
app.get('/api/children', auth, need(['parent', 'tutor']), (req, res) => {
  const list = db.links.filter(l => l.adultId === req.user.id).map(l => {
    const s = db.users[l.studentId]; if (!s) return null;
    const o = { linkId: l.id, studentId: s.id, name: s.name, summary: summarize(db.progress[s.id]) };
    o.matricule = s.matricule;
    o.works = worksFor(s.id, req.user.role === 'tutor' ? req.user.id : null);
    if (req.user.role === 'tutor') o.assignments = db.assignments.filter(a => a.tutorId === req.user.id && a.studentId === s.id).map(a => ({ id: a.id, chap: a.chap, note: a.note, at: a.at, doneAt: a.doneAt }));
    return o;
  }).filter(Boolean);
  res.json({ children: list });
});

/* ----- Devoirs du répétiteur ----- */
app.post('/api/assign', auth, need('tutor'), (req, res) => {
  const b = req.body || {};
  if (!CHAPTERS.includes(b.chap)) return fail(res, 400, 'chap', 'Chapitre invalide.');
  if (!db.links.some(l => l.adultId === req.user.id && l.studentId === b.studentId)) return fail(res, 403, 'link', 'Cet élève n’est pas dans ta liste.');
  const a = { id: crypto.randomUUID(), tutorId: req.user.id, studentId: b.studentId, chap: b.chap, note: clean(b.note, 200), at: now(), doneAt: null };
  db.assignments.push(a); save();
  res.json({ ok: true, id: a.id });
});
app.delete('/api/assignments/:id', auth, need('tutor'), (req, res) => {
  const n = db.assignments.length;
  db.assignments = db.assignments.filter(a => !(a.id === req.params.id && a.tutorId === req.user.id));
  save(); res.json({ ok: db.assignments.length < n });
});
app.get('/api/assignments', auth, need('student'), (req, res) => {
  res.json({ assignments: db.assignments.filter(a => a.studentId === req.user.id).map(a => ({ id: a.id, chap: a.chap, note: a.note, at: a.at, doneAt: a.doneAt, tutor: (db.users[a.tutorId] || {}).name || '' })) });
});
app.post('/api/assignments/:id/done', auth, need('student'), (req, res) => {
  const a = db.assignments.find(x => x.id === req.params.id && x.studentId === req.user.id);
  if (!a) return fail(res, 404, 'assignment', 'Devoir introuvable.');
  if (!a.doneAt) { a.doneAt = now(); save(); }
  res.json({ ok: true });
});


/* ----- Contenus du répétiteur : cours, exercices, travail en ligne ----- */
const MAX_FILE = 3 * 1024 * 1024;
function sniff(b) {
  if (b.slice(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
function saveFile(f) {
  if (!f || !f.data) return null;
  const buf = Buffer.from(String(f.data).replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) return null;
  if (buf.length > MAX_FILE) throw 'Fichier trop lourd (3 Mo maximum).';
  const mime = sniff(buf);
  if (!mime) throw 'Format non accepté : PDF, PNG, JPEG ou WEBP.';
  const id = crypto.randomUUID();
  store.putFile(id, mime, buf);
  return { id, name: clean(f.name, 80) || 'document', mime, size: buf.length };
}
const rmFile = f => { if (f) store.delFile(f.id); };
const studentsOf = tid => db.links.filter(l => l.adultId === tid).map(l => l.studentId);
const person = id => { const u = db.users[id]; return u ? { id: u.id, name: u.name, matricule: u.matricule, role: u.role } : null; };
const subOf = (wid, sid) => db.submissions.find(x => x.workId === wid && x.studentId === sid);
const subSummary = s => (s ? { score: s.score, total: s.total, at: s.at, hasText: !!s.text, hasFile: !!s.file, feedback: !!s.feedback } : null);
function dropStudentFromTutor(tid, sid) {
  db.works.forEach(w => { if (w.tutorId === tid && w.studentIds.includes(sid)) { w.studentIds = w.studentIds.filter(x => x !== sid); db.submissions.filter(x => x.workId === w.id && x.studentId === sid).forEach(x => rmFile(x.file)); db.submissions = db.submissions.filter(x => !(x.workId === w.id && x.studentId === sid)); } });
  db.works = db.works.filter(w => { if (w.studentIds.length) return true; rmFile(w.file); db.submissions.filter(x => x.workId === w.id).forEach(x => rmFile(x.file)); db.submissions = db.submissions.filter(x => x.workId !== w.id); return false; });
}
function purgeUserContent(u) {
  db.works.filter(w => w.tutorId === u.id).forEach(w => { rmFile(w.file); db.submissions.filter(x => x.workId === w.id).forEach(x => rmFile(x.file)); db.submissions = db.submissions.filter(x => x.workId !== w.id); });
  db.works = db.works.filter(w => w.tutorId !== u.id);
  db.submissions.filter(x => x.studentId === u.id).forEach(x => rmFile(x.file));
  db.submissions = db.submissions.filter(x => x.studentId !== u.id);
  db.works.forEach(w => { w.studentIds = w.studentIds.filter(x => x !== u.id); });
  db.messages = db.messages.filter(m => m.from !== u.id && m.to !== u.id);
}
function worksFor(sid, tid) {
  return db.works.filter(w => w.studentIds.includes(sid) && (!tid || w.tutorId === tid)).sort((a, b) => b.at - a.at).slice(0, 20).map(w => {
    const s = subOf(w.id, sid);
    return { id: w.id, kind: w.kind, title: w.title, subject: w.subject, tutor: (db.users[w.tutorId] || {}).name || '', at: w.at, due: w.due, done: !!s, score: s ? s.score : null, total: s ? s.total : null };
  });
}
function cleanQuestions(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const q of arr.slice(0, 20)) {
    const text = clean(q && q.q, 300), raw = Array.isArray(q && q.opts) ? q.opts.slice(0, 4).map(o => clean(o, 120)) : [];
    const ans = +(q && q.ans);
    if (text.length < 2 || !Number.isInteger(ans) || ans < 0 || ans >= raw.length || !raw[ans]) return null;
    const map = [], opts = [];
    raw.forEach((o, i) => { if (o) { map[i] = opts.length; opts.push(o); } });
    if (opts.length < 2) return null;
    out.push({ q: text, opts, ans: map[ans], expl: clean(q.expl, 300) });
  }
  return out;
}
const bodyText = s => String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
const fileErr = (res, e) => (typeof e === 'string' ? fail(res, 400, 'file', e) : null);

app.post('/api/works', auth, need('tutor'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!['cours', 'exercice'].includes(b.kind)) return fail(res, 400, 'kind', 'Choisis : cours ou exercice.');
  const title = clean(b.title, 120);
  if (title.length < 2) return fail(res, 400, 'title', 'Donne un titre (2 lettres au moins).');
  let questions = [];
  if (b.kind === 'exercice' && Array.isArray(b.questions) && b.questions.length) {
    questions = cleanQuestions(b.questions);
    if (!questions) return fail(res, 400, 'questions', 'Chaque question doit avoir un énoncé, 2 à 4 réponses et une bonne réponse.');
  }
  const mine = studentsOf(req.user.id);
  let ids = mine;
  if (Array.isArray(b.studentIds) && b.studentIds.length) { ids = b.studentIds.filter(id => mine.includes(id)); if (!ids.length) return fail(res, 400, 'students', 'Élève introuvable dans ta liste.'); }
  if (!ids.length) return fail(res, 400, 'students', 'Aucun élève lié. Ajoute d’abord un élève avec son matricule.');
  let file = null;
  try { file = saveFile(b.file); } catch (e) { const r = fileErr(res, e); if (r) return r; throw e; }
  const body = bodyText(b.body).slice(0, 8000);
  if (!body && !file && !questions.length) return fail(res, 400, 'empty', 'Ajoute un texte, un document ou des questions.');
  const w = { id: crypto.randomUUID(), tutorId: req.user.id, kind: b.kind, title, subject: clean(b.subject, 40) || 'Autre', body, questions, file, studentIds: ids, due: /^\d{4}-\d{2}-\d{2}$/.test(b.due || '') ? b.due : null, at: now() };
  db.works.push(w); save();
  res.json({ ok: true, id: w.id });
}));

app.get('/api/works', auth, need(['tutor', 'student']), (req, res) => {
  const u = req.user;
  if (u.role === 'tutor') {
    return res.json({ works: db.works.filter(w => w.tutorId === u.id).sort((a, b) => b.at - a.at).map(w => ({ id: w.id, kind: w.kind, title: w.title, subject: w.subject, at: w.at, due: w.due, hasFile: !!w.file, qCount: w.questions.length, targets: w.studentIds.map(person).filter(Boolean), done: db.submissions.filter(s => s.workId === w.id).length })) });
  }
  res.json({ works: db.works.filter(w => w.studentIds.includes(u.id)).sort((a, b) => b.at - a.at).map(w => ({ id: w.id, kind: w.kind, title: w.title, subject: w.subject, tutor: person(w.tutorId), at: w.at, due: w.due, hasFile: !!w.file, qCount: w.questions.length, sub: subSummary(subOf(w.id, u.id)) })) });
});

function subFull(s, w) {
  if (!s) return null;
  const o = { id: s.id, score: s.score, total: s.total, text: s.text, hasFile: !!s.file, fileName: s.file && s.file.name, at: s.at, attempts: s.attempts, feedback: s.feedback };
  if (w.questions.length) o.results = w.questions.map((q, i) => ({ ok: s.answers[i] === q.ans, mine: s.answers[i], ans: q.ans, expl: q.expl }));
  return o;
}
app.get('/api/works/:id', auth, need(['tutor', 'student']), (req, res) => {
  const w = db.works.find(x => x.id === req.params.id), u = req.user;
  if (!w || (u.role === 'tutor' ? w.tutorId !== u.id : !w.studentIds.includes(u.id))) return fail(res, 404, 'work', 'Contenu introuvable.');
  const base = { id: w.id, kind: w.kind, title: w.title, subject: w.subject, body: w.body, due: w.due, at: w.at, hasFile: !!w.file, fileId: w.file && w.file.id, fileName: w.file && w.file.name, tutor: person(w.tutorId) };
  if (u.role === 'tutor') {
    base.questions = w.questions;
    base.targets = w.studentIds.map(person).filter(Boolean);
    base.submissions = db.submissions.filter(s => s.workId === w.id).map(s => Object.assign(subFull(s, w), { student: person(s.studentId), fileId: s.file && s.file.id }));
    return res.json({ work: base });
  }
  base.questions = w.questions.map(q => ({ q: q.q, opts: q.opts }));
  const s = subOf(w.id, u.id), sf = subFull(s, w);
  if (sf && s.file) sf.fileId = s.file.id;
  res.json({ work: base, sub: sf });
});

app.post('/api/submit/:id', auth, need('student'), wrap(async (req, res) => {
  const w = db.works.find(x => x.id === req.params.id && x.studentIds.includes(req.user.id));
  if (!w || w.kind !== 'exercice') return fail(res, 404, 'work', 'Exercice introuvable.');
  const b = req.body || {}, q = w.questions;
  let answers = [], score = null, total = null;
  if (q.length) {
    answers = Array.isArray(b.answers) ? b.answers : [];
    if (answers.length !== q.length || answers.some(x => !Number.isInteger(x) || x < 0 || x > 3)) return fail(res, 400, 'answers', 'Réponds à toutes les questions.');
    score = q.reduce((n, qq, i) => n + (answers[i] === qq.ans ? 1 : 0), 0); total = q.length;
  }
  const text = bodyText(b.text).slice(0, 3000);
  let file = null;
  try { file = saveFile(b.file); } catch (e) { const r = fileErr(res, e); if (r) return r; throw e; }
  if (!q.length && !text && !file) return fail(res, 400, 'empty', 'Écris ta réponse ou dépose ton travail.');
  let s = subOf(w.id, req.user.id);
  if (!s) { s = { id: crypto.randomUUID(), workId: w.id, studentId: req.user.id, attempts: 0, feedback: null }; db.submissions.push(s); }
  if (file) { rmFile(s.file); s.file = file; }
  Object.assign(s, { answers, score, total, text, at: now(), attempts: s.attempts + 1 });
  save();
  res.json({ ok: true, sub: subFull(s, w) });
}));

app.post('/api/submissions/:id/feedback', auth, need('tutor'), (req, res) => {
  const s = db.submissions.find(x => x.id === req.params.id), w = s && db.works.find(x => x.id === s.workId && x.tutorId === req.user.id);
  if (!w) return fail(res, 404, 'sub', 'Travail introuvable.');
  const t = clean(String((req.body || {}).text || ''), 600);
  s.feedback = t ? { text: t, at: now() } : null; save();
  res.json({ ok: true });
});
app.delete('/api/works/:id', auth, need('tutor'), (req, res) => {
  const w = db.works.find(x => x.id === req.params.id && x.tutorId === req.user.id);
  if (!w) return fail(res, 404, 'work', 'Contenu introuvable.');
  rmFile(w.file); db.submissions.filter(x => x.workId === w.id).forEach(x => rmFile(x.file));
  db.submissions = db.submissions.filter(x => x.workId !== w.id); db.works = db.works.filter(x => x !== w); save();
  res.json({ ok: true });
});
app.get('/api/files/:id', auth, wrap(async (req, res) => {
  const id = req.params.id, u = req.user;
  let f = null, ok = false;
  const w = db.works.find(x => x.file && x.file.id === id);
  if (w) { f = w.file; ok = u.id === w.tutorId || w.studentIds.includes(u.id); }
  else {
    const s = db.submissions.find(x => x.file && x.file.id === id), sw = s && db.works.find(x => x.id === s.workId);
    if (s) { f = s.file; ok = u.id === s.studentId || (sw && u.id === sw.tutorId); }
  }
  if (!f || !ok || !/^[0-9a-f-]{36}$/.test(id)) return fail(res, 404, 'file', 'Document introuvable.');
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(f.name));
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  const blob = await store.getFile(id);
  if (!blob) return fail(res, 404, 'file', 'Document introuvable.');
  res.setHeader('Content-Length', blob.buf.length);
  res.end(blob.buf);
}));

/* ----- Messagerie : répétiteur, élève, parent ----- */
function contactIds(u) {
  const set = new Set(), L = db.links, role = id => (db.users[id] || {}).role;
  if (u.role === 'student') L.filter(l => l.studentId === u.id && role(l.adultId) === 'tutor').forEach(l => set.add(l.adultId));
  else if (u.role === 'tutor') { const mine = studentsOf(u.id); mine.forEach(id => set.add(id)); L.filter(l => mine.includes(l.studentId) && role(l.adultId) === 'parent').forEach(l => set.add(l.adultId)); }
  else { const kids = studentsOf(u.id); L.filter(l => kids.includes(l.studentId) && role(l.adultId) === 'tutor').forEach(l => set.add(l.adultId)); }
  set.delete(u.id);
  return [...set].filter(id => db.users[id]);
}
const thread = (a, b) => db.messages.filter(m => (m.from === a && m.to === b) || (m.from === b && m.to === a));
app.get('/api/threads', auth, (req, res) => {
  const me = req.user.id;
  const list = contactIds(req.user).map(id => {
    const t = thread(me, id), last = t[t.length - 1];
    return { user: person(id), last: last ? { text: last.text.slice(0, 80), at: last.at, mine: last.from === me } : null, unread: t.filter(m => m.to === me && !m.read).length };
  }).sort((a, b) => ((b.last || {}).at || 0) - ((a.last || {}).at || 0));
  res.json({ threads: list });
});
app.get('/api/unread', auth, (req, res) => res.json({ n: db.messages.filter(m => m.to === req.user.id && !m.read).length }));
app.get('/api/messages/:uid', auth, (req, res) => {
  if (!contactIds(req.user).includes(req.params.uid)) return fail(res, 403, 'contact', 'Vous ne pouvez pas écrire à cette personne.');
  const t = thread(req.user.id, req.params.uid);
  let ch = false; t.forEach(m => { if (m.to === req.user.id && !m.read) { m.read = true; ch = true; } });
  if (ch) save();
  res.json({ with: person(req.params.uid), messages: t.slice(-200).map(m => ({ id: m.id, text: m.text, at: m.at, mine: m.from === req.user.id })) });
});
app.post('/api/messages', auth, (req, res) => {
  const b = req.body || {}, text = bodyText(b.text).slice(0, 1000);
  if (!limit('msg:' + req.user.id, 80, 3600e3)) return fail(res, 429, 'rate', 'Trop de messages. Réessaie plus tard.');
  if (!contactIds(req.user).includes(b.to)) return fail(res, 403, 'contact', 'Vous ne pouvez pas écrire à cette personne.');
  if (!text) return fail(res, 400, 'empty', 'Écris ton message.');
  db.messages.push({ id: crypto.randomUUID(), from: req.user.id, to: b.to, text, at: now(), read: false });
  if (db.messages.length > 20000) db.messages = db.messages.slice(-15000);
  save(); res.json({ ok: true });
});

app.use('/api', (req, res) => fail(res, 404, 'notfound', 'Introuvable.'));

/* ----- Application statique ----- */
if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res, p) => { if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(p)) res.setHeader('Cache-Control', 'no-cache'); }
  }));
  app.use((req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
} else {
  app.use((req, res) => fail(res, 404, 'notfound', 'Introuvable.'));
}

async function init() {
  db = Object.assign(emptyDb(), await store.load());
  Object.values(db.users).forEach(u => { if (u.role) ensureMat(u); });
  dirty = true; await flush();
  return db;
}
function start(port) {
  const p = port === undefined ? PORT : port;
  return init().then(() => app.listen(p, () => console.log('eRepeat AI : http://localhost:' + p + ' (messagerie : ' + MAIL.mode + ', base : ' + store.kind + ')')));
}
if (require.main === module) start().catch(e => { console.error('Démarrage impossible :', e.message); process.exit(1); });
module.exports = { app, start, flush, init };
