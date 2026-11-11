import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fdate, ftime, ROLE_LABEL } from '../lib/format.js';
import { useAuth, useToast } from '../context/App.jsx';

function useBack(fallback) {
  const nav = useNavigate();
  return () => { if (window.history.state && window.history.state.idx > 0) nav(-1); else nav(fallback, { replace: true }); };
}

export function Threads() {
  const { user, refreshUnread } = useAuth();
  const nav = useNavigate();
  const back = useBack('/accueil');
  const [threads, setThreads] = useState(null);
  useEffect(() => {
    let off = false;
    api('GET', '/threads').then(r => { if (!off) setThreads(r.threads); }, () => { if (!off) setThreads(t => t || []); });
    refreshUnread();
    return () => { off = true; };
  }, [refreshUnread]);
  const r = user.role;
  const h = <><button className="backlink" data-a="msgsback" onClick={back}>Retour</button><h1>Messages</h1><p className="sub">{r === 'student' ? 'Écris à ton répétiteur.' : r === 'tutor' ? 'Écrivez à vos élèves et à leurs parents.' : 'Écrivez au répétiteur de votre enfant.'}</p></>;
  if (threads === null) return <>{h}<div className="card"><p className="sub">Chargement…</p></div></>;
  if (!threads.length) {
    return (
      <>{h}<div className="card"><p>
        {r === 'student' ? <>Aucun répétiteur n’est encore lié à ton compte. Donne-lui ton matricule <b>{user.matricule || ''}</b>.</> : r === 'tutor' ? 'Ajoutez d’abord un élève avec son matricule.' : 'Le répétiteur de votre enfant apparaîtra ici dès qu’il aura lié l’élève à son compte.'}
      </p></div></>
    );
  }
  return (
    <>{h}
      <div className="card">
        {threads.map(t => {
          const u = t.user;
          return (
            <button key={u.id} className="thread" data-a="openchat" onClick={() => nav('/messages/' + u.id)}>
              <span className="ic">{u.name.charAt(0).toUpperCase()}</span>
              <span className="tx"><b>{u.name}</b><small>{ROLE_LABEL[u.role]} · {u.matricule || ''}{t.last ? ' · ' + (t.last.mine ? 'Vous : ' : '') + t.last.text : ''}</small></span>
              {t.unread ? <span className="badge">{t.unread}</span> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function Chat() {
  const { uid } = useParams();
  const { refreshUnread } = useAuth();
  const toast = useToast();
  const back = useBack('/messages');
  const [who, setWho] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [gone, setGone] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const count = useRef(-1);

  const refresh = useCallback(async quiet => {
    try {
      const r = await api('GET', '/messages/' + uid);
      setWho(r.with); setMsgs(m => (m && m.length === r.messages.length ? m : r.messages));
      refreshUnread();
    } catch (e) { if (!quiet) { toast(e.message); setGone(true); } }
  }, [uid, refreshUnread, toast]);

  useEffect(() => {
    refresh(false);
    const t = setInterval(() => { if (!document.hidden && navigator.onLine !== false) refresh(true); }, 15000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => { if (msgs && msgs.length !== count.current && box.current) { count.current = msgs.length; box.current.scrollTop = box.current.scrollHeight; } }, [msgs]);

  async function send() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try { await api('POST', '/messages', { to: uid, text: v }); setText(''); await refresh(false); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  if (gone) return <Navigate to="/messages" replace />;
  return (
    <div className="chat">
      <div>
        <button className="backlink" data-a="chatback" onClick={back}>Messages</button>
        <h1 style={{ fontSize: 20, margin: 0 }}>{who ? who.name : '…'}</h1>
        <p className="sub" style={{ marginBottom: 8 }}>{who ? ROLE_LABEL[who.role] + ' · ' + (who.matricule || '') : ''}</p>
      </div>
      <div className="msgs" id="msgs" ref={box}>
        {msgs ? (msgs.length ? msgs.map(m => <div key={m.id || m.at} className={'m ' + (m.mine ? 'me' : 'bot')}>{m.text}<span className="mt">{fdate(m.at)} {ftime(m.at)}</span></div>) : <p className="sub">Aucun message pour le moment. Écrivez le premier.</p>) : <p className="sub">Chargement…</p>}
      </div>
      <div className="composer">
        <input id="mi" placeholder="Écris ton message…" maxLength={1000} autoComplete="off" aria-label="Ton message" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} />
        <button className="btn" data-a="msend" disabled={busy} onClick={send}>Envoyer</button>
      </div>
    </div>
  );
}
