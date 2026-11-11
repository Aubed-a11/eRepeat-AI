import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CHN, SUBJECTS as CAT_SUBJECTS, gradeName, topicsOfGrade } from '../lib/catalog.js';
import { kidsStore, useKids, useWorks, worksStore } from '../lib/data.js';
import { fdate } from '../lib/format.js';
import { useToast } from '../context/App.jsx';
import { ConfirmButton, FileField, IcCheck } from '../components/ui.jsx';
import { FileLine } from './Works.jsx';

const L = 'ABCD';
const SUBJECTS = ['Mathématiques', 'Français', 'Sciences physiques et SVT', 'Anglais', 'Histoire-Géographie', 'Autre'];
const kindLabel = k => (k === 'cours' ? 'Cours' : 'Exercice');
const newBld = () => ({ kind: 'cours', title: '', subject: 'Mathématiques', body: '', due: '', ids: null, qs: [], file: null });

function Builder({ kids, onClose, onDone }) {
  const toast = useToast();
  const [b, setB] = useState(newBld);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setB(x => ({ ...x, [k]: v }));
  const ids = b.ids || kids.map(k => k.studentId);
  const setQ = (i, patch) => setB(x => ({ ...x, qs: x.qs.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const setOpt = (i, o, v) => setB(x => ({ ...x, qs: x.qs.map((q, j) => (j === i ? { ...q, opts: q.opts.map((t, k) => (k === o ? v : t)) } : q)) }));
  const toggle = id => set('ids', ids.includes(id) ? ids.filter(x => x !== id) : ids.concat(id));

  async function publish() {
    if (busy) return;
    setErr('');
    if (!ids.length) { setErr('Choisis au moins un élève.'); return; }
    const p = { kind: b.kind, title: b.title, subject: b.subject, body: b.body, due: b.due || undefined, studentIds: ids };
    if (b.kind === 'exercice') p.questions = b.qs.map(q => ({ q: q.q, opts: q.opts, ans: q.ans, expl: q.expl }));
    if (b.file) p.file = { name: b.file.name, data: b.file.data };
    setBusy(true);
    try { await api('POST', '/works', p); await worksStore.load(true); toast('Publié : vos élèves peuvent travailler en ligne.'); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 14 }}><h2>Nouveau contenu</h2>
      <div className="chips" role="group" aria-label="Type de contenu">
        {['cours', 'exercice'].map(k => <button key={k} type="button" className={'chip' + (b.kind === k ? ' on' : '')} data-a="bkind" data-k={k} aria-pressed={b.kind === k} onClick={() => set('kind', k)}>{kindLabel(k)}</button>)}
      </div>
      <div className="field"><label htmlFor="b-title">Titre</label><input className="in" id="b-title" maxLength={120} value={b.title} onChange={e => set('title', e.target.value)} placeholder="Ex. Théorème de Pythagore" /></div>
      <div className="field"><label htmlFor="b-sub">Matière</label><select className="in" id="b-sub" value={b.subject} onChange={e => set('subject', e.target.value)}>{SUBJECTS.map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="field"><label htmlFor="b-body">{b.kind === 'cours' ? 'Contenu du cours' : 'Consigne de l’exercice'}</label><textarea className="in" id="b-body" rows={6} maxLength={8000} value={b.body} onChange={e => set('body', e.target.value)} placeholder={b.kind === 'cours' ? 'Écrivez ici votre leçon, avec des exemples.' : 'Écrivez ici l’énoncé.'} /></div>
      <FileField id="bfile" label="Document à joindre (facultatif)" file={b.file} onFile={f => set('file', f)} onError={m => toast(m)} />
      <div className="field"><label htmlFor="b-due">Pour le (facultatif)</label><input className="in" type="date" id="b-due" value={b.due} onChange={e => set('due', e.target.value)} /></div>
      <div className="field"><label>Destinataires</label>
        {kids.map(k => <label className="check" key={k.studentId}><input type="checkbox" data-a="btarget" checked={ids.includes(k.studentId)} onChange={() => toggle(k.studentId)} /><span>{k.name} <small>{k.matricule || ''}</small></span></label>)}
      </div>
      {b.kind === 'exercice' ? (
        <>
          <h2 style={{ marginTop: 6 }}>Questions à choix (correction automatique)</h2>
          <p className="sub">Touchez la lettre de la bonne réponse. Sans question, l’élève répond par écrit ou dépose une photo de son travail.</p>
          {b.qs.map((q, i) => (
            <div className="qb" key={i}>
              <div className="field"><label htmlFor={'bq' + i + 'q'}>Question {i + 1}</label><textarea className="in" id={'bq' + i + 'q'} rows={2} maxLength={300} value={q.q} onChange={e => setQ(i, { q: e.target.value })} /></div>
              {[0, 1, 2, 3].map(o => (
                <div className="optrow" key={o}>
                  <button type="button" className={'radio' + (q.ans === o ? ' on' : '')} data-a="bans" data-q={i} data-o={o} aria-pressed={q.ans === o} aria-label={'Bonne réponse : ' + L[o]} onClick={() => setQ(i, { ans: o })}>{q.ans === o ? <IcCheck /> : L[o]}</button>
                  <input className="in" id={'bq' + i + 'o' + o} maxLength={120} placeholder={'Réponse ' + L[o] + (o > 1 ? ' (facultative)' : '')} value={q.opts[o] || ''} onChange={e => setOpt(i, o, e.target.value)} />
                </div>
              ))}
              <div className="field"><label htmlFor={'bq' + i + 'e'}>Explication (facultative)</label><input className="in" id={'bq' + i + 'e'} maxLength={300} value={q.expl || ''} onChange={e => setQ(i, { expl: e.target.value })} /></div>
              <button type="button" className="btn ghost sm" data-a="bqdel" data-q={i} onClick={() => setB(x => ({ ...x, qs: x.qs.filter((_, j) => j !== i) }))}>Supprimer cette question</button>
            </div>
          ))}
          <button type="button" className="btn ghost block" data-a="bqadd" onClick={() => { if (b.qs.length >= 20) { toast('20 questions au maximum.'); return; } setB(x => ({ ...x, qs: x.qs.concat({ q: '', opts: ['', '', '', ''], ans: 0, expl: '' }) })); }}>+ Ajouter une question</button>
        </>
      ) : null}
      <div id="bld-err" className={"err" + (err ? " on" : "")} role="alert">{err}</div>
      <div className="actions"><button className="btn ghost" data-a="bcancel" onClick={onClose}>Annuler</button><button className="btn" data-a="bpub" disabled={busy} onClick={publish}>Publier</button></div>
    </div>
  );
}

function Assign({ kids, reload }) {
  const toast = useToast();
  const [si, setSi] = useState(0);
  const [chap, setChap] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const k = kids[si] || kids[0];
  const list = topicsOfGrade((k && k.grade) || '3e');
  const chapOk = list.some(t => t.id === chap) ? chap : (list[0] && list[0].id) || '';
  async function assign() {
    if (!k || busy) return;
    setBusy(true);
    try { await api('POST', '/assign', { studentId: k.studentId, chap: chapOk, note }); setNote(''); await reload(); toast('Devoir envoyé à ' + k.name + '.'); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  return (
    <>
      <div className="card" style={{ marginTop: 0 }}><h2>Donner un sujet à réviser</h2><p className="sub" style={{ margin: 0 }}>Donnez un sujet de la classe de l’élève : il apparaît sur l’accueil de l’élève, avec la séance guidée de l’IA.</p></div>
      <div className="card"><h2>Choisir le sujet</h2>
        <div className="field"><label htmlFor="tk-st">Élève</label><select className="in" id="tk-st" value={si} onChange={e => setSi(+e.target.value)}>{kids.map((x, i) => <option key={x.studentId} value={i}>{x.name}{x.grade ? ' (' + gradeName(x.grade) + ')' : ''}</option>)}</select></div>
        <div className="field"><label htmlFor="tk-ch">Sujet</label><select className="in" id="tk-ch" value={chapOk} onChange={e => setChap(e.target.value)}>{CAT_SUBJECTS.map(sj => { const l = list.filter(t => t.subj === sj.id); return l.length ? <optgroup key={sj.id} label={sj.name}>{l.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup> : null; })}</select></div>
        <div className="field"><label htmlFor="tk-nt">Consigne (facultatif)</label><input className="in" id="tk-nt" maxLength={200} value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') assign(); }} placeholder="Ex. À finir avant jeudi" /></div>
        <button className="btn block" data-a="assign" disabled={busy} onClick={assign}>Donner le devoir</button>
      </div>
      {kids.map(x => {
        const l = (x.assignments || []).slice().reverse();
        if (!l.length) return null;
        return (
          <div className="card" key={x.studentId}><h2>{x.name}</h2>
            {l.map(a => (
              <div className="row2" key={a.id}>
                <div className="grow"><b>{CHN(a.chap).name}</b><small>{a.note ? a.note + ' · ' : ''}{new Date(a.at).toLocaleDateString('fr-FR')}</small></div>
                <span className={'st ' + (a.doneAt ? 'ok' : 'todo')}>{a.doneAt ? 'Fait' : 'À faire'}</span>
                <ConfirmButton label="×" confirmLabel="Sûr ?" aria-label="Supprimer le devoir" data-a="delasg" onConfirm={async () => { try { await api('DELETE', '/assignments/' + a.id); } catch (e) { toast(e.message); } reload(); }} />
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

export function TutorWorks() {
  const nav = useNavigate();
  const [kids, reloadKids] = useKids();
  const [works] = useWorks();
  const [open, setOpen] = useState(false);
  const h = <><h1>Contenus</h1><p className="sub">Publiez des cours et des exercices : vos élèves y travaillent en ligne.</p></>;
  if (kids === null) return <>{h}<div className="card"><p className="sub">Chargement…</p></div></>;
  if (!kids.length) return <>{h}<div className="card" style={{ marginTop: 14 }}><p>Ajoutez d’abord un élève avec son matricule, dans l’onglet « Mes élèves ».</p></div></>;
  return (
    <>
      {h}
      {open ? <Builder kids={kids} onClose={() => setOpen(false)} onDone={() => setOpen(false)} /> : <button className="btn big block" style={{ margin: '14px 0' }} data-a="bopen" onClick={() => setOpen(true)}>+ Nouveau cours ou exercice</button>}
      <div className="card"><h2>Mes contenus</h2>
        {works === null ? <p className="sub">Chargement…</p> : works.length ? works.map(w => (
          <button key={w.id} className="chrow" data-a="openwork" onClick={() => nav('/contenus/' + w.id)}>
            <span className="ic">{w.kind === 'cours' ? 'C' : 'E'}</span>
            <span className="tx"><b>{w.title}</b><small>{w.subject} · {w.targets.map(t => t.name).join(', ')}{w.kind === 'exercice' ? ' · rendus : ' + w.done : ''}</small></span>
            <span className={'kindtag' + (w.kind === 'exercice' ? ' ex' : '')}>{kindLabel(w.kind)}</span>
          </button>
        )) : <p className="sub">Aucun contenu publié pour le moment.</p>}
      </div>
      <Assign kids={kids} reload={reloadKids} />
    </>
  );
}

function Feedback({ s, onSent }) {
  const toast = useToast();
  const [v, setV] = useState(s.feedback ? s.feedback.text : '');
  return (
    <>
      <div className="field" style={{ marginTop: 8 }}><label htmlFor={'fb-' + s.id}>Votre commentaire</label><textarea className="in" id={'fb-' + s.id} rows={2} maxLength={600} value={v} onChange={e => setV(e.target.value)} /></div>
      <button className="btn sm" data-a="fbsend" onClick={async () => { try { await api('POST', '/submissions/' + s.id + '/feedback', { text: v }); toast('Commentaire envoyé.'); onSent(); } catch (e) { toast(e.message); } }}>Envoyer le commentaire</button>
    </>
  );
}

export function TutorWorkDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [WK, setWK] = useState(null);
  const [gone, setGone] = useState(false);
  const load = React.useCallback(() => api('GET', '/works/' + id).then(setWK, e => { toast(e.message); setGone(true); }), [id, toast]);
  React.useEffect(() => { load(); }, [load]);
  if (gone) return <Navigate to="/contenus" replace />;
  const back = <button className="backlink" data-a="closework" onClick={() => nav('/contenus')}>Contenus</button>;
  if (!WK) return <>{back}<div className="card"><p className="sub">Chargement…</p></div></>;
  const w = WK.work;
  return (
    <>
      {back}
      <span className={'kindtag' + (w.kind === 'exercice' ? ' ex' : '')}>{kindLabel(w.kind)}</span>
      <h1 style={{ marginTop: 8 }}>{w.title}</h1>
      <p className="sub">{w.subject}{w.due ? ' · pour le ' + fdate(w.due + 'T12:00:00') : ''} · {w.targets.map(t => t.name).join(', ')}</p>
      {w.body || w.hasFile ? <div className="card">{w.body ? <div className="pre">{w.body}</div> : null}{w.hasFile ? <FileLine id={w.fileId} name={w.fileName} /> : null}</div> : null}
      {w.questions.length ? (
        <div className="card"><h2>Questions</h2>
          {w.questions.map((q, i) => (
            <div className="resq" key={i}><div className="q2">{i + 1}. {q.q}</div>
              <div className="opts">{q.opts.map((o, j) => <div key={j} className={'opt' + (j === q.ans ? ' good' : '')}><b>{L[j]}</b><span>{o}</span></div>)}</div>
            </div>
          ))}
        </div>
      ) : null}
      {w.kind === 'exercice' ? (
        <div className="card"><h2>Travaux rendus ({w.submissions.length} / {w.targets.length})</h2>
          {w.targets.map(t => {
            const s = w.submissions.find(x => x.student && x.student.id === t.id);
            if (!s) return <div className="row2" key={t.id}><div className="grow"><b>{t.name}</b><small>{t.matricule || ''}</small></div><span className="st todo">Pas rendu</span></div>;
            return (
              <div key={t.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div><b>{t.name}</b><div className="sm2">{t.matricule || ''} · rendu le {fdate(s.at)} · essai {s.attempts}</div></div>
                  <span className="st ok">{s.total ? s.score + ' / ' + s.total : 'Rendu'}</span>
                </div>
                {s.text ? <div className="pre" style={{ margin: '8px 0' }}>{s.text}</div> : null}
                {s.hasFile ? <FileLine id={s.fileId} name={s.fileName} label="Fichier" fallback="travail" /> : null}
                <Feedback s={s} onSent={load} />
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="card">
        <ConfirmButton label="Supprimer ce contenu" confirmLabel="Confirmer la suppression" data-a="delwork" onConfirm={async () => { try { await api('DELETE', '/works/' + w.id); toast('Contenu supprimé.'); } catch (e) { toast(e.message); } worksStore.load(true); nav('/contenus'); }} />
      </div>
    </>
  );
}
