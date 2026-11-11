import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { TAGS } from '../lib/content.js';
import { CHN, gradeName } from '../lib/catalog.js';
import { kidsStore, useKids } from '../lib/data.js';
import { ago, fdate } from '../lib/format.js';
import { gpOf } from '../lib/student.js';
import { useAuth, useToast } from '../context/App.jsx';
import { ConfirmButton, IcBars, IcCal, IcPeople, IcTarget, Ring, Tile } from '../components/ui.jsx';

const weakest = m => { let b = null; Object.keys(m || {}).forEach(id => { const v = m[id]; if (typeof v === 'number' && (b === null || v < b.v)) b = { c: CHN(id), v }; }); return b; };
const masteryList = m => Object.keys(m || {}).filter(id => typeof m[id] === 'number').map(id => ({ c: CHN(id), v: m[id] })).sort((a, b) => a.v - b.v);
function advice(k) {
  const s = k.summary, w = weakest(s.mastery), tg = Object.keys(s.errors).sort((a, b) => s.errors[b] - s.errors[a])[0];
  if (s.empty || !w) return k.name + ' n’a pas encore fait de diagnostic. Invitez-le à commencer par un diagnostic dans la matière de son choix.';
  return 'Priorité pour ' + k.name + ' : « ' + w.c.name + ' » (' + Math.round(w.v * 100) + ' % maîtrisé).' + (tg ? ' Les erreurs les plus fréquentes sont de type « ' + TAGS[tg].toLowerCase() + ' ».' : '') + ' Trois séances de 15 minutes par semaine suffisent pour progresser.';
}
const VBar = ({ v }) => <div className={'bar ' + (typeof v !== 'number' ? '' : v < .45 ? 'bad' : v < .7 ? 'warn' : '')}><i style={{ width: Math.round((v || 0) * 100) + '%' }} /></div>;

function KidCard({ k, detail, onDetail }) {
  const s = k.summary, g = gpOf(s.mastery);
  return (
    <div className="card">
      <div className="kidhead"><span className="ic">{k.name.charAt(0).toUpperCase()}</span><div><b>{k.name}</b><small className="mat">{k.matricule || ''}{k.grade ? ' · ' + gradeName(k.grade) : ''}</small><small>Dernière activité : {ago(s.last)}</small></div><Ring p={g} size={64} sub="" /></div>
      <div className="stats" style={{ marginBottom: 10 }}>
        <Tile icon={<IcTarget />} value={s.rate === null ? '0%' : s.rate + '%'} label="Taux de réussite" />
        <Tile icon={<IcCal />} value={s.week} label="Séances (7 j)" />
        <Tile icon={<IcBars />} value={s.exercises} label="Exercices" />
      </div>
      {detail ? null : <><p className="sub">{advice(k)}</p><button className="btn ghost block" data-a="kid" data-go="kids" onClick={onDetail}>Voir le détail</button></>}
    </div>
  );
}

function LinkCard({ onLinked }) {
  const { user } = useAuth();
  const toast = useToast();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const par = user.role === 'parent';
  async function link() {
    const m = v.trim();
    if (!m) { toast('Entre le code de liaison.'); return; }
    if (busy) return;
    setBusy(true);
    try { const r = await api('POST', '/link', { matricule: m }); setV(''); await kidsStore.load(true); onLinked(); toast(r.student + ' a été ajouté.'); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  return (
    <div className="card"><h2>Ajouter {par ? 'un enfant' : 'un élève'}</h2>
      <p className="sub">Demandez à {par ? 'votre enfant' : 'l’élève'} son matricule : il se trouve dans son profil, sur son application.</p>
      <div className="field"><label htmlFor="lk">Matricule de {par ? 'l’enfant' : 'l’élève'}</label>
        <input className="in" id="lk" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') link(); }} placeholder="EL-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" maxLength={12} />
      </div>
      <button className="btn block" data-a="link" disabled={busy} onClick={link}>Lier {par ? 'cet enfant' : 'cet élève'}</button>
    </div>
  );
}

export function AdultHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [kids] = useKids();
  const par = user.role === 'parent';
  const h = <><h1>Bonjour, {user.name} !</h1><p className="sub">{par ? 'Suivez les progrès de vos enfants, étape par étape.' : 'Suivez vos élèves et donnez-leur des devoirs ciblés.'}</p></>;
  if (kids === null) return <>{h}<div className="card"><p className="sub">Chargement…</p></div></>;
  if (!kids.length) return <>{h}<div className="card" style={{ marginTop: 14 }}><p>Vous n’avez encore lié aucun {par ? 'enfant' : 'élève'}.</p></div><LinkCard onLinked={() => {}} /></>;
  let wk = 0, pd = 0; const rs = [];
  kids.forEach(k => { wk += k.summary.week; if (k.summary.rate !== null) rs.push(k.summary.rate); (k.assignments || []).forEach(a => { if (!a.doneAt) pd++; }); });
  const ar = rs.length ? Math.round(rs.reduce((a, b) => a + b, 0) / rs.length) + '%' : '0%';
  return (
    <>
      {h}
      <div className="stats" style={{ marginTop: 14 }}>
        <Tile icon={<IcPeople />} value={kids.length} label={par ? 'Enfants suivis' : 'Élèves suivis'} />
        {par ? <Tile icon={<IcCal />} value={wk} label="Séances (7 j)" /> : <Tile icon={<IcCal />} value={pd} label="Devoirs en attente" />}
        <Tile icon={<IcTarget />} value={ar} label="Réussite moyenne" />
      </div>
      {kids.map((k, i) => <KidCard key={k.studentId} k={k} detail={false} onDetail={() => nav('/enfants', { state: { sel: i } })} />)}
    </>
  );
}

export function Kids() {
  const { user } = useAuth();
  const loc = useLocation();
  const toast = useToast();
  const [kids, reload] = useKids();
  const [sel, setSel] = useState((loc.state && loc.state.sel) || 0);
  const par = user.role === 'parent', word = par ? 'enfant' : 'élève';
  const h = <h1>{par ? 'Mes enfants' : 'Mes élèves'}</h1>;
  if (kids === null) return <>{h}<div className="card"><p className="sub">Chargement…</p></div></>;
  const idx = Math.max(0, Math.min(sel, kids.length - 1));
  const k = kids[idx];
  let body = null;
  if (k) {
    const s = k.summary;
    const ek = Object.keys(s.errors).sort((a, b) => s.errors[b] - s.errors[a]), mx = ek.length ? s.errors[ek[0]] : 1;
    body = (
      <>
        {kids.length > 1 ? <div className="chips">{kids.map((x, i) => <button key={x.studentId} className={'chip' + (i === idx ? ' on' : '')} data-a="kid" aria-pressed={i === idx} onClick={() => setSel(i)}>{x.name}</button>)}</div> : null}
        <KidCard k={k} detail />
        <div className="card"><h2>Maîtrise par sujet</h2>
          {masteryList(s.mastery).length ? masteryList(s.mastery).map(({ c, v }) => (
            <div key={c.id} style={{ margin: '10px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}><b>{c.name}</b><span>{Math.round(v * 100) + '%'}</span></div><small style={{ color: 'var(--muted)', fontSize: 11.5 }}>{c.subjName}</small><VBar v={v} /></div>
          )) : <p className="sub">Aucun sujet évalué pour le moment.</p>}
        </div>
        <div className="card"><h2>Cours et exercices du répétiteur</h2>
          {(k.works || []).length ? k.works.map(w => (
            <div className="row2" key={w.id}>
              <div className="grow"><b>{w.title}</b><small>{w.kind === 'cours' ? 'Cours' : 'Exercice'} · {w.tutor}{w.due ? ' · pour le ' + fdate(w.due + 'T12:00:00') : ''}</small></div>
              {w.kind === 'cours' ? <span className="kindtag">Cours</span> : w.done ? <span className="st ok">{w.total ? w.score + ' / ' + w.total : 'Rendu'}</span> : <span className="st todo">À faire</span>}
            </div>
          )) : <p className="sub">Aucun cours ni exercice publié pour le moment.</p>}
        </div>
        <div className="card"><h2>Types d’erreurs repérés</h2>
          {ek.length ? ek.map(t => <div className="errrow" key={t}><span>{TAGS[t]}</span><div className="bar"><i style={{ width: Math.round(s.errors[t] / mx * 100) + '%' }} /></div><b>{s.errors[t]}</b></div>) : <p className="sub">Aucune erreur enregistrée pour le moment.</p>}
        </div>
        <div className="card point"><h2>Conseil</h2><p>{advice(k)}</p><span className="tag">Conseil automatique selon les résultats</span></div>
        <div className="card">
          <ConfirmButton label={'Retirer cet ' + word} confirmLabel="Confirmer le retrait" data-a="unlink" onConfirm={async () => { try { await api('DELETE', '/link/' + k.linkId); toast('Liaison retirée.'); } catch (e) { toast(e.message); } setSel(0); reload(); }} />
        </div>
      </>
    );
  }
  return <>{h}{body}<LinkCard onLinked={() => setSel(9999)} /></>;
}
