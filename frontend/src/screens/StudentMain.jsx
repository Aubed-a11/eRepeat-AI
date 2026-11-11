import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CH, CHN, TAGS } from '../lib/content.js';
import { globalPct, rate, ranked, P, reco, streak, weekDone } from '../lib/student.js';
import { askAI, localCoach } from '../lib/coach.js';
import { useStudent } from '../context/Student.jsx';
import { Banner, ChapterRows, IcBars, IcCal, IcTarget, MastBar, Ring, Tile } from '../components/ui.jsx';
import { ContentsCard, TodoCard } from './Works.jsx';

const useStart = () => { const nav = useNavigate(); return (mode, chap) => nav('/exercices/seance', { state: { mode, chap } }); };

function useAssignments() {
  const [asg, setAsg] = useState([]);
  const load = useCallback(async () => { try { const r = await api('GET', '/assignments'); setAsg(r.assignments); } catch (e) { /* hors connexion */ } }, []);
  useEffect(() => { load(); }, [load]);
  return asg;
}

export function Home() {
  const { S, name } = useStudent();
  const nav = useNavigate();
  const start = useStart();
  const asg = useAssignments().filter(a => !a.doneAt);
  const r = reco(S, name), rt = rate(S), wd = weekDone(S), c = r.chap ? CHN(r.chap) : null;
  return (
    <>
      <h1>Bonjour, {name} !</h1>
      <p className="sub">Continue sur ta lancée vers l’excellence.</p>
      <div className="stats" style={{ marginTop: 14 }}>
        <Tile icon={<IcTarget />} value={rt === null ? '0%' : rt + '%'} label="Taux de réussite" />
        <Tile icon={<IcCal />} value={S.done.length} label="Séances suivies" />
        <Tile icon={<IcBars />} value={streak(S) + ' j'} label="Régularité" />
      </div>
      <div className="card reco">
        <h2>Recommandations pour toi</h2>
        <div className="recorow"><span className="ic">{c ? c.ic : 'D'}</span><div><b>{c ? c.name : 'Diagnostic du niveau'}</b><small>{c ? c.subj : '10 questions pour démarrer'}</small></div></div>
        <p>{r.text}</p>
        <button className="btn block" data-a={r.chap ? 'guided' : 'diag'} data-c={r.chap || ''} onClick={() => (r.chap ? start('guided', r.chap) : start('diag'))}>{r.chap ? 'Commencer' : 'Faire mon diagnostic'}</button>
        <div className="why"><b>Pourquoi cet exercice ?</b> {r.reason}</div>
      </div>
      {asg.length ? (
        <div className="card"><h2>Devoirs de ton répétiteur</h2>
          {asg.map(a => (
            <div className="row2" key={a.id}>
              <div className="grow"><b>{CHN(a.chap).name}</b><small>{a.tutor}{a.note ? ' : ' + a.note : ''}</small></div>
              <button className="btn sm" data-a="guided" data-c={a.chap} onClick={() => start('guided', a.chap, a.id)}>Commencer</button>
            </div>
          ))}
        </div>
      ) : null}
      <TodoCard />
      <div className="coach">
        <h2>Mon coach</h2>
        <p style={{ fontSize: 13, margin: 0, color: 'var(--muted)' }}>Ton assistant pédagogique est disponible.</p>
        <div className="bubble-q">« On travaille ensemble ? Je te guide avec des indices, étape par étape. »</div>
        <div className="row">
          <button className="btn gold" onClick={() => nav('/coach')}>Discuter avec mon coach</button>
          <button className="btn" onClick={() => nav('/exercices')}>Faire un exercice</button>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><h2>Mon objectif de la semaine</h2><span className="sub">{Math.min(wd, 5)} / 5 séances</span></div>
        <div className="bar"><i style={{ width: Math.min(wd, 5) * 20 + '%' }} /></div>
        <p className="sub" style={{ margin: '8px 0 0' }}>{wd >= 5 ? 'Objectif atteint, bravo !' : 'Encore ' + (5 - wd) + ' séance' + (5 - wd > 1 ? 's' : '') + ' pour y arriver.'}</p>
      </div>
      <div className="card"><h2>Mes chapitres</h2><ChapterRows s={S} onPick={id => start('guided', id)} /></div>
    </>
  );
}

export function Train() {
  const { S } = useStudent();
  const start = useStart();
  return (
    <>
      <div className="eyebrow">Exercices</div>
      <h1>Que veux-tu travailler ?</h1>
      <p className="sub">Une séance guidée suit cinq étapes : diagnostic, compréhension, essai avec indices, vérification, exercice personnalisé.</p>
      <ContentsCard />
      <div className="card" style={{ marginTop: 14 }}>
        <h2>{S.diag ? 'Refaire mon diagnostic' : 'Diagnostic du niveau'}</h2>
        <p className="sub">10 questions dont la difficulté s’ajuste à tes réponses.</p>
        <button className="btn ghost block" data-a="diag" onClick={() => start('diag')}>{S.diag ? 'Refaire le diagnostic' : 'Commencer le diagnostic'}</button>
      </div>
      <div className="card"><h2>Séance guidée</h2><ChapterRows s={S} onPick={id => start('guided', id)} /></div>
      <div className="card">
        <h2>Entraînement libre</h2>
        <p className="sub">Cinq exercices au niveau qui te convient, avec indices.</p>
        {CH.map(c => <button key={c.id} className="chip" style={{ margin: '0 6px 8px 0' }} data-a="free" data-c={c.id} onClick={() => start('free', c.id)}>{c.name}</button>)}
      </div>
    </>
  );
}

export function Coach() {
  const { S, update, name } = useStudent();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null);
  const box = useRef(null);
  const hello = { role: 'assistant', content: 'Bonjour ' + name + ' ! Je suis ton assistant pédagogique eRepeat AI. Quelle notion veux-tu travailler aujourd’hui ?' };
  const chat = S.chat.length ? S.chat : [hello];
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [chat.length, live]);
  async function send(t) {
    t = (t || '').trim();
    if (!t || busy) return;
    setText(''); setBusy(true); setLive('…');
    const history = [...chat, { role: 'user', content: t }];
    update(s => { s.chat = (s.chat.length ? s.chat : [hello]).concat({ role: 'user', content: t }); return s; });
    let out = '';
    try {
      const h = history.slice(-8); while (h.length && h[0].role !== 'user') h.shift();
      out = await askAI(h, S, name);
    } catch (e) { out = localCoach(t); }
    out = out || localCoach(t);
    update(s => { s.chat = s.chat.concat({ role: 'assistant', content: out }).slice(-30); return s; });
    setLive(null); setBusy(false);
  }
  return (
    <div className="chat">
      <div>
        <div className="eyebrow">Assistant IA</div>
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Mon coach</h1>
        <p className="sub" style={{ marginBottom: 8 }}>Pose une question scolaire et avance à ton rythme.</p>
      </div>
      <div className="msgs" id="msgs" ref={box}>
        {chat.map((m, i) => <div key={i} className={'m ' + (m.role === 'user' ? 'me' : 'bot')}>{m.content}</div>)}
        {live ? <div className="m bot">{live}</div> : null}
      </div>
      <div className="chips">
        <button className="chip" onClick={() => send('Je ne comprends pas les équations')}>Les équations</button>
        <button className="chip" onClick={() => send('Donne-moi un indice')}>Un indice</button>
        <button className="chip" onClick={() => send('Explique-moi Pythagore autrement')}>Pythagore</button>
      </div>
      <form className="composer" onSubmit={e => { e.preventDefault(); send(text); }}>
        <input id="ci" placeholder="Écris ta question ici…" autoComplete="off" aria-label="Ta question" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn" type="submit" data-a="send">Envoyer</button>
      </form>
      <p className="note">Réponses de base hors connexion : l’IA peut se tromper, vérifie les notions importantes avec ton répétiteur.</p>
    </div>
  );
}

export function Progress() {
  const { S } = useStudent();
  const errs = {}; S.hist.forEach(h => { if (h.tag) errs[h.tag] = (errs[h.tag] || 0) + 1; });
  const ek = Object.keys(errs).sort((a, b) => errs[b] - errs[a]), mx = ek.length ? errs[ek[0]] : 1;
  const rk = ranked(S), days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  const plan = [rk[0], rk[1], rk[0], rk[2], null];
  const g = globalPct(S), rt = rate(S);
  return (
    <>
      <h1>Résultats</h1>
      <p className="sub">Visualise tes efforts et les notions à renforcer.</p>
      <div className="card res" style={{ marginTop: 14 }}><h2>Progression globale</h2><Ring p={g} size={150} sub="maîtrise moyenne" /><Banner p={g} /></div>
      <div className="stats">
        <Tile icon={<IcTarget />} value={rt === null ? '0%' : rt + '%'} label="Taux de réussite" />
        <Tile icon={<IcCal />} value={S.done.length} label="Séances suivies" />
        <Tile icon={<IcBars />} value={streak(S) + ' j'} label="Régularité" />
      </div>
      <div className="card"><h2>Maîtrise par chapitre</h2>
        {CH.map(c => { const p = P(S, c.id); return (
          <div key={c.id} style={{ margin: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><b>{c.name}</b><span>{p === null ? 'pas évalué' : Math.round(p * 100) + '%'}</span></div>
            <MastBar value={p === null ? undefined : p} />
          </div>
        ); })}
      </div>
      <div className="card"><h2>Types d’erreurs repérés</h2>
        {ek.length ? ek.map(k => <div className="errrow" key={k}><span>{TAGS[k]}</span><div className="bar"><i style={{ width: Math.round(errs[k] / mx * 100) + '%' }} /></div><b>{errs[k]}</b></div>)
          : <p className="sub">Aucune erreur enregistrée pour le moment. Fais une séance pour analyser tes réponses.</p>}
      </div>
      <div className="card point"><h2>Ton plan de la semaine</h2>
        <div className="plan">{plan.map((c, i) => <div key={i}><b>{days[i]}</b><span>{c ? c.name + ' · ' + (P(S, c.id) === null ? 'à évaluer' : Math.round(P(S, c.id) * 100) + ' % maîtrisé') : 'Mini-bilan sur tous les chapitres'}</span></div>)}</div>
        <span className="tag">Plan proposé selon ton niveau</span>
      </div>
    </>
  );
}
