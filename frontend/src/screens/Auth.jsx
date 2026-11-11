import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { maskEmail } from '../lib/format.js';
import { getPending, setPending } from '../lib/pending.js';
import { useAuth, useToast } from '../context/App.jsx';
import mark from '../assets/mark.png';

const ROLES = [
  ['student', 'Élève', 'Je révise mes cours avec l’IA', <svg key="s" viewBox="0 0 24 24"><path d="M4 5.5C6.5 4 9.5 4 12 5.5c2.5-1.5 5.5-1.5 8 0V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z" /><path d="M12 5.5V19" /></svg>],
  ['parent', 'Parent', 'Je suis les progrès de mon enfant', <svg key="p" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.7-3.5 3.2-5.5 6.5-5.5s5.8 2 6.5 5.5" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14.5c2.2.2 3.9 1.8 4.5 4.5" /></svg>],
  ['tutor', 'Répétiteur', 'J’accompagne mes élèves à domicile', <svg key="t" viewBox="0 0 24 24"><path d="M3 9l9-4 9 4-9 4z" /><path d="M7 11.5V16c1.5 1.5 3.2 2 5 2s3.5-.5 5-2v-4.5" /></svg>]
];
const consentText = r => (r === 'student'
  ? 'J’accepte les conditions d’utilisation et le suivi pédagogique de mes résultats. J’ai l’accord de mon parent ou tuteur.'
  : 'J’accepte les conditions d’utilisation et le traitement de mes données pour le suivi pédagogique.');

const Err = ({ msg }) => <div id="au-err" className={'err' + (msg ? ' on' : '')} role="alert">{msg}</div>;
const Link = ({ to, children, nav }) => <button type="button" className="backlink" style={{ display: 'inline', margin: 0 }} data-a="go" data-v={to} onClick={() => nav('/' + ({ signup: 'inscription', login: 'connexion', welcome: 'bienvenue', forgot: 'mot-de-passe-oublie' }[to]))}>{children}</button>;
const Back = ({ to, nav, children }) => <button type="button" className="backlink" data-a="go" data-v={to} onClick={() => nav('/' + ({ signup: 'inscription', login: 'connexion', welcome: 'bienvenue' }[to]))}>{children}</button>;

function Field({ label, id, type = 'text', value, onChange, ac, ...rest }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input className="in" id={id} type={type} autoComplete={ac} value={value} onChange={e => onChange(e.target.value)} {...rest} />
    </div>
  );
}
function PwField({ label, id, value, onChange, ac }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pwwrap">
        <input className="in" id={id} type={show ? 'text' : 'password'} autoComplete={ac} value={value} onChange={e => onChange(e.target.value)} />
        <button type="button" data-a="pwtoggle" onClick={() => setShow(!show)}>{show ? 'Masquer' : 'Afficher'}</button>
      </div>
    </div>
  );
}

export function Welcome() {
  const nav = useNavigate();
  return (
    <div className="welcome">
      <div className="hero"><img src={mark} alt="Logo eRepeat AI" /><b>eRepeat <i>AI</i></b><small>Apprendre • Répéter • Réussir</small></div>
      <div>
        <h1>Apprenons à ton rythme.</h1>
        <p className="sub">Un espace pour l’élève, un pour le parent, un pour le répétiteur. Chacun crée son compte et le valide avec un code reçu par e-mail.</p>
      </div>
      <button className="btn big block" data-a="go" data-v="signup" onClick={() => nav('/inscription')}>Créer un compte</button>
      <button className="btn ghost big block" data-a="go" data-v="login" onClick={() => nav('/connexion')}>Se connecter</button>
      <p className="note">Niveau 3e : mathématiques et français.</p>
    </div>
  );
}

export function Signup() {
  const nav = useNavigate();
  const [f, setF] = useState({ role: 'student', name: '', email: '', pw: '', ok: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => v => setF(x => ({ ...x, [k]: v }));
  async function submit() {
    if (busy) return; setErr(''); setBusy(true);
    try {
      const r = await api('POST', '/signup', { role: f.role, name: f.name, email: f.email, password: f.pw, consent: f.ok });
      setPending({ email: f.email.trim().toLowerCase(), masked: r.email, end: Date.now() + (r.wait || 30) * 1000, info: '' });
      nav('/verification');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
      <Back to="welcome" nav={nav}>Retour</Back>
      <h1>Créer mon compte</h1>
      <p className="sub">Choisis ton type de compte, puis valide ton adresse e-mail avec le code que tu recevras.</p>
      <div className="rolecards" role="group" aria-label="Type de compte">
        {ROLES.map(r => (
          <button type="button" key={r[0]} className="rolecard" data-a="role" data-r={r[0]} aria-pressed={f.role === r[0]} onClick={() => set('role')(r[0])}>
            <span className="ic">{r[3]}</span><span><b>{r[1]}</b><small>{r[2]}</small></span>
          </button>
        ))}
      </div>
      <Field label="Prénom" id="su-name" value={f.name} onChange={set('name')} ac="given-name" maxLength={40} />
      <Field label="Adresse e-mail" id="su-email" type="email" value={f.email} onChange={set('email')} ac="email" inputMode="email" maxLength={120} autoCapitalize="none" />
      <PwField label="Mot de passe (8 caractères minimum)" id="su-pw" value={f.pw} onChange={set('pw')} ac="new-password" />
      <label className="check"><input type="checkbox" id="su-ok" checked={f.ok} onChange={e => set('ok')(e.target.checked)} /><span id="consent-txt">{consentText(f.role)}</span></label>
      <Err msg={err} />
      <button type="submit" className="btn big block" data-a="signup" disabled={busy} aria-busy={busy}>Recevoir mon code par e-mail</button>
      <p className="note" style={{ textAlign: 'center', marginTop: 12 }}>Déjà un compte ? <Link to="login" nav={nav}>Se connecter</Link></p>
    </form>
  );
}

export function Login() {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [em, setEm] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    const email = em.trim().toLowerCase();
    if (!email || !pw) { setErr('Entre ton e-mail et ton mot de passe.'); return; }
    setBusy(true); setErr('');
    try { const r = await api('POST', '/login', { email, password: pw }); signIn(r.token, r.user); return; }
    catch (e) {
      if (e.code === 'unverified') {
        setPending({ email, masked: maskEmail(email), end: 0, info: 'Ton compte n’est pas encore validé : un nouveau code vient d’être envoyé.' });
        api('POST', '/resend', { email }).catch(() => {});
        nav('/verification'); return;
      }
      setErr(e.message);
    }
    setBusy(false);
  }
  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
      <Back to="welcome" nav={nav}>Retour</Back>
      <h1>Se connecter</h1>
      <p className="sub">Retrouve ton espace avec ton e-mail et ton mot de passe.</p>
      <Field label="Adresse e-mail" id="li-email" type="email" value={em} onChange={setEm} ac="email" inputMode="email" autoCapitalize="none" />
      <PwField label="Mot de passe" id="li-pw" value={pw} onChange={setPw} ac="current-password" />
      <Err msg={err} />
      <button type="submit" className="btn big block" data-a="login" disabled={busy} aria-busy={busy}>Se connecter</button>
      <p className="note" style={{ textAlign: 'center', marginTop: 12 }}><Link to="forgot" nav={nav}>Mot de passe oublié ?</Link></p>
      <p className="note" style={{ textAlign: 'center' }}>Pas encore de compte ? <Link to="signup" nav={nav}>Créer un compte</Link></p>
    </form>
  );
}

/* Compte à rebours avant de pouvoir redemander un code */
function useCountdown(end) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [end]);
  return left;
}

export function Verify() {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const toast = useToast();
  const [pend, setPend] = useState(getPending());
  const [code, setCode] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const left = useCountdown(pend ? pend.end : 0);
  const input = useRef(null);
  useEffect(() => { if (!pend) nav('/inscription', { replace: true }); else if (input.current) input.current.focus(); }, []); // eslint-disable-line
  if (!pend) return null;
  async function submit(c) {
    if (busy) return;
    if (c.length !== 6) { setErr('Entre les 6 chiffres du code.'); return; }
    setBusy(true); setErr('');
    try { const r = await api('POST', '/verify', { email: pend.email, code: c }); setPending(null); signIn(r.token, r.user); return; }
    catch (e) { setErr(e.message); setCode(''); if (input.current) input.current.focus(); }
    setBusy(false);
  }
  async function resend() {
    try {
      const r = await api('POST', '/resend', { email: pend.email });
      const p = { ...pend, end: Date.now() + (r.wait || 30) * 1000 }; setPending(p); setPend(p); toast('Nouveau code envoyé.');
    } catch (e) { setErr(e.message); }
  }
  return (
    <form onSubmit={e => { e.preventDefault(); submit(code); }} noValidate>
      <Back to="signup" nav={nav}>Modifier mon adresse</Back>
      <h1>Vérifie ton e-mail</h1>
      <p className="sub">Un code à 6 chiffres a été envoyé à <b>{pend.masked}</b>. Il est valable 10 minutes. Pense à regarder dans les courriers indésirables.</p>
      {pend.info ? <p className="fb ok" role="status">{pend.info}</p> : null}
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="vc">Code de validation</label>
        <input ref={input} className="in code-in" id="vc" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code" placeholder="······" value={code}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) submit(v); }} />
      </div>
      <Err msg={err} />
      <button type="submit" className="btn big block" data-a="verify" disabled={busy} aria-busy={busy}>Valider mon compte</button>
      <button type="button" className="btn ghost block" id="rs" style={{ marginTop: 10 }} data-a="resend" disabled={left > 0} onClick={resend}>{left > 0 ? 'Renvoyer le code (' + left + ' s)' : 'Renvoyer le code'}</button>
    </form>
  );
}

export function Forgot() {
  const nav = useNavigate();
  const [em, setEm] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function submit() {
    const email = em.trim().toLowerCase();
    if (!email) { setErr('Entre ton adresse e-mail.'); return; }
    if (busy) return; setBusy(true); setErr('');
    try { const r = await api('POST', '/forgot', { email }); setPending({ email, masked: r.email || maskEmail(email), end: Date.now() + (r.wait || 30) * 1000, info: '' }); nav('/nouveau-mot-de-passe'); return; }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
      <Back to="login" nav={nav}>Retour</Back>
      <h1>Mot de passe oublié</h1>
      <p className="sub">Entre l’adresse e-mail de ton compte. Nous t’envoyons un code pour choisir un nouveau mot de passe.</p>
      <Field label="Adresse e-mail" id="fg-email" type="email" value={em} onChange={setEm} ac="email" inputMode="email" autoCapitalize="none" />
      <Err msg={err} />
      <button type="submit" className="btn big block" data-a="forgot" disabled={busy} aria-busy={busy}>Recevoir un code</button>
    </form>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [pend] = useState(getPending());
  const [code, setCode] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { if (!pend) nav('/mot-de-passe-oublie', { replace: true }); }, []); // eslint-disable-line
  if (!pend) return null;
  async function submit() {
    if (busy) return;
    if (code.length !== 6) { setErr('Entre les 6 chiffres du code.'); return; }
    setBusy(true); setErr('');
    try { const r = await api('POST', '/reset', { email: pend.email, code, password: pw }); setPending(null); signIn(r.token, r.user); return; }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
      <Back to="login" nav={nav}>Retour</Back>
      <h1>Nouveau mot de passe</h1>
      <p className="sub">Si un compte existe pour <b>{pend.masked}</b>, un code à 6 chiffres vient d’être envoyé. Il est valable 10 minutes.</p>
      <div className="field">
        <label htmlFor="rc">Code reçu par e-mail</label>
        <input className="in code-in" id="rc" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code" placeholder="······" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      </div>
      <PwField label="Nouveau mot de passe (8 caractères minimum)" id="rp-pw" value={pw} onChange={setPw} ac="new-password" />
      <Err msg={err} />
      <button type="submit" className="btn big block" data-a="reset" disabled={busy} aria-busy={busy}>Changer mon mot de passe</button>
    </form>
  );
}
