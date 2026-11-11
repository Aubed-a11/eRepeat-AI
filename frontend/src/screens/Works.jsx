import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile } from '../lib/api.js';
import { useWorks, worksStore } from '../lib/data.js';
import { fdate, ftime } from '../lib/format.js';
import { useAuth, useToast } from '../context/App.jsx';
import { Banner, FileField, IcCheck, Ring } from '../components/ui.jsx';

const L = 'ABCD';
const due = w => (w.due ? ' · pour le ' + fdate(w.due + 'T12:00:00') : '');

export function SubStatus({ w }) {
  if (w.kind === 'cours') return <span className="kindtag">Cours</span>;
  const s = w.sub;
  return s ? <span className="st ok">{s.total ? s.score + ' / ' + s.total : 'Rendu'}</span> : <span className="st todo">À faire</span>;
}

export function FileLine({ id, name, label = 'Document', fallback = 'document' }) {
  const toast = useToast();
  return (
    <div className="fileline">
      <span className="sm2">{label} : {name || ''}</span>
      <button className="btn ghost sm" data-a="dlfile" onClick={() => downloadFile(id, name || fallback).catch(e => toast((e && e.message) || 'Téléchargement impossible.'))}>Télécharger</button>
    </div>
  );
}

export function ContentsCard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [works] = useWorks();
  if (works === null) return <div className="card" style={{ marginTop: 14 }}><h2>Cours et exercices de mon répétiteur</h2><p className="sub">Chargement…</p></div>;
  if (!works.length) return <div className="card" style={{ marginTop: 14 }}><h2>Cours et exercices de mon répétiteur</h2><p className="sub">Rien pour le moment. Donne ton matricule <b>{user.matricule || ''}</b> à ton répétiteur : ses cours et exercices apparaîtront ici.</p></div>;
  return (
    <div className="card" style={{ marginTop: 14 }}><h2>Cours et exercices de mon répétiteur</h2>
      {works.map(w => (
        <button key={w.id} className="chrow" data-a="openwork" onClick={() => nav('/cours/' + w.id)}>
          <span className="ic">{w.kind === 'cours' ? 'C' : 'E'}</span>
          <span className="tx"><b>{w.title}</b><small>{w.subject} · {w.tutor ? w.tutor.name : ''}{due(w)}</small></span>
          <SubStatus w={w} />
        </button>
      ))}
    </div>
  );
}

export function TodoCard() {
  const nav = useNavigate();
  const [works] = useWorks();
  const p = (works || []).filter(w => w.kind === 'exercice' && !w.sub);
  if (!p.length) return null;
  return (
    <div className="card"><h2>Exercices à faire</h2>
      {p.slice(0, 3).map(w => (
        <div className="row2" key={w.id}>
          <div className="grow"><b>{w.title}</b><small>{w.subject} · {w.tutor ? w.tutor.name : ''}{due(w)}</small></div>
          <button className="btn sm" data-a="openwork" onClick={() => nav('/cours/' + w.id)}>Ouvrir</button>
        </div>
      ))}
    </div>
  );
}

/* Cours ou exercice ouvert par l'élève : lecture, travail en ligne, résultat et commentaire du répétiteur. */
export function StudentWork() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [WK, setWK] = useState(null);
  const [gone, setGone] = useState(false);
  const [ans, setAns] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [retry, setRetry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let off = false;
    api('GET', '/works/' + id).then(r => { if (off) return; setWK(r); if (r.sub && r.sub.text) setText(r.sub.text); }, e => { if (!off) { toast(e.message); setGone(true); } });
    return () => { off = true; };
  }, [id, toast]);

  if (gone) return <Navigate to="/exercices" replace />;
  const back = <button className="backlink" data-a="closework" onClick={() => nav('/exercices')}>Exercices</button>;
  if (!WK) return <>{back}<div className="card"><p className="sub">Chargement…</p></div></>;

  const w = WK.work, s = WK.sub, q = w.questions || [], showRes = s && !retry;
  async function submit() {
    if (busy) return;
    const body = { text };
    if (q.length) {
      for (let i = 0; i < q.length; i++) if (ans[i] === undefined) { toast('Réponds à toutes les questions.'); return; }
      body.answers = ans.slice(0, q.length);
    }
    if (file) body.file = { name: file.name, data: file.data };
    setBusy(true); setErr('');
    try {
      const r = await api('POST', '/submit/' + w.id, body);
      setWK({ ...WK, sub: r.sub }); setRetry(false); setFile(null);
      worksStore.load(true);
      toast(r.sub.total ? 'Score : ' + r.sub.score + ' / ' + r.sub.total : 'Travail envoyé à ton répétiteur.');
    } catch (e) { toast(e.message); setErr(e.message); }
    setBusy(false);
  }

  return (
    <>
      {back}
      <span className={'kindtag' + (w.kind === 'exercice' ? ' ex' : '')}>{w.kind === 'cours' ? 'Cours' : 'Exercice'}</span>
      <h1 style={{ marginTop: 8 }}>{w.title}</h1>
      <p className="sub">{w.subject} · {w.tutor ? w.tutor.name : ''}{w.tutor && w.tutor.matricule ? ' (' + w.tutor.matricule + ')' : ''}{due(w)}</p>
      {w.body || w.hasFile ? <div className="card">{w.body ? <div className="pre">{w.body}</div> : null}{w.hasFile ? <FileLine id={w.fileId} name={w.fileName} /> : null}</div> : null}
      {w.kind === 'cours' ? null : q.length ? (
        showRes ? (
          <>
            <div className="card res"><h2>Ton résultat</h2><Ring p={s.total ? Math.round(100 * s.score / s.total) : 0} size={130} sub={s.score + ' / ' + s.total} /><Banner p={s.total ? Math.round(100 * s.score / s.total) : 0} /></div>
            {q.map((qq, i) => {
              const r = s.results[i];
              return (
                <div className="card resq" key={i}>
                  <div className="q2">{i + 1}. {qq.q}</div>
                  <div className="opts">
                    {qq.opts.map((o, j) => <div key={j} className={'opt' + (j === r.ans ? ' good' : j === r.mine && !r.ok ? ' bad' : '')}><b>{L[j]}</b><span>{o}</span><i className="ck"><IcCheck /></i></div>)}
                  </div>
                  {r.expl ? <div className={'fb ' + (r.ok ? 'ok' : 'hint')}><b>{r.ok ? 'Exact !' : 'Explication'}</b>{r.expl}</div> : null}
                </div>
              );
            })}
            <button className="btn ghost block" data-a="wretry" onClick={() => { setRetry(true); setAns([]); }}>Refaire l’exercice</button>
          </>
        ) : (
          <>
            {q.map((qq, i) => (
              <div className="card resq" key={i}>
                <div className="q2">{i + 1}. {qq.q}</div>
                <div className="opts">
                  {qq.opts.map((o, j) => (
                    <button key={j} className={'opt' + (ans[i] === j ? ' sel' : '')} data-a="wans" data-q={i} data-o={j} aria-pressed={ans[i] === j} onClick={() => setAns(a => { const n = a.slice(); n[i] = j; return n; })}>
                      <b>{L[j]}</b><span>{o}</span><i className="ck"><IcCheck /></i>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn big block" data-a="wsubmit" disabled={busy} onClick={submit}>Envoyer mes réponses</button>
          </>
        )
      ) : showRes ? (
        <>
          <div className="card"><h2>Ton travail a été rendu</h2><p className="sub">Le {fdate(s.at)} à {ftime(s.at)}.</p>
            {s.text ? <div className="pre">{s.text}</div> : null}
            {s.hasFile ? <FileLine id={s.fileId} name={s.fileName} label="Fichier" fallback="travail" /> : null}
          </div>
          <button className="btn ghost block" data-a="wretry" onClick={() => setRetry(true)}>Modifier mon travail</button>
        </>
      ) : (
        <div className="card"><h2>Ma réponse</h2>
          <div className="field"><label htmlFor="wtext">Écris ta réponse</label><textarea className="in" id="wtext" maxLength={3000} rows={6} value={text} onChange={e => setText(e.target.value)} /></div>
          <FileField id="wfile" label="Ou dépose une photo ou un PDF de ton travail" file={file} onFile={setFile} onError={m => toast(m)} />
          <div id="w-err" className={"err" + (err ? " on" : "")} role="alert">{err}</div>
          <button className="btn big block" data-a="wsubmit" disabled={busy} onClick={submit}>Envoyer mon travail</button>
        </div>
      )}
      {s && s.feedback ? <div className="fb ok" role="status"><b>Commentaire de {w.tutor ? w.tutor.name : 'ton répétiteur'}</b>{s.feedback.text}</div> : null}
      {s && showRes ? <p className="note">Essai n° {s.attempts}.</p> : null}
    </>
  );
}
