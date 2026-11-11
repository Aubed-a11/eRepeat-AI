import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { TAGS } from '../lib/content.js';
import { CHN, freeId, gradeName, subjById, subjectsFor, topicsFor } from '../lib/catalog.js';
import { evaluated, globalPct, rate, ranked, P, reco, streak, weekDone } from '../lib/student.js';
import { askAI, localCoach } from '../lib/coach.js';
import { hasLocal, useAiOn } from '../lib/exo.js';
import { useAuth } from '../context/App.jsx';
import { useStudent } from '../context/Student.jsx';
import { Banner, IcBars, IcCal, IcTarget, MastBar, Ring, Tile, TopicRows } from '../components/ui.jsx';
import { CourseBox, SubjectChips, useFocus } from '../components/Focus.jsx';
import { ContentsCard, TodoCard } from './Works.jsx';

const useStart = () => { const nav = useNavigate(); return (mode, chap, extra) => nav('/exercices/seance', { state: { mode, chap, ...(extra || {}) } }); };

function useAssignments() {
  const [asg, setAsg] = useState([]);
  const load = useCallback(async () => { try { const r = await api('GET', '/assignments'); setAsg(r.assignments); } catch (e) { /* hors connexion */ } }, []);
  useEffect(() => { load(); }, [load]);
  return asg;
}

export function Home() {
  const { S, name } = useStudent();
  const { user } = useAuth();
  const grade = user.grade;
  const nav = useNavigate();
  const start = useStart();
  const aiOn = useAiOn();
  const asg = useAssignments().filter(a => !a.doneAt);
  const r = reco(S, name, grade), rt = rate(S), wd = weekDone(S), c = r.chap ? CHN(r.chap) : null;
  const mine = ranked(S, grade).slice(0, 6);
  return (
    <>
      <h1>Bonjour, {name} !</h1>
      <p className="sub"><span className="gradetag">{gradeName(grade)}</span>Continue sur ta lancée vers l’excellence.</p>
      <div className="stats" style={{ marginTop: 14 }}>
        <Tile icon={<IcTarget />} value={rt === null ? '0%' : rt + '%'} label="Taux de réussite" />
        <Tile icon={<IcCal />} value={S.done.length} label="Séances suivies" />
        <Tile icon={<IcBars />} value={streak(S) + ' j'} label="Régularité" />
      </div>
      <div className="card reco">
        <h2>Recommandations pour toi</h2>
        <div className="recorow"><span className="ic">{c ? c.ic : 'D'}</span><div><b>{c ? c.name : 'Diagnostic du niveau'}</b><small>{c ? c.subjName : 'Quelques questions pour démarrer'}</small></div></div>
        <p>{r.text}</p>
        <button className="btn block" data-a={r.chap ? 'guided' : 'diag'} data-c={r.chap || ''} onClick={() => (r.chap ? start('guided', r.chap) : nav('/exercices'))}>{r.chap ? 'Commencer' : 'Choisir une matière'}</button>
        <div className="why"><b>Pourquoi cet exercice ?</b> {r.reason}</div>
      </div>
      {asg.length ? (
        <div className="card"><h2>Devoirs de ton répétiteur</h2>
          {asg.map(a => (
            <div className="row2" key={a.id}>
              <div className="grow"><b>{CHN(a.chap).name}</b><small>{a.tutor}{a.note ? ' : ' + a.note : ''}</small></div>
              <button className="btn sm" data-a="guided" data-c={a.chap} onClick={() => start('guided', a.chap)}>Commencer</button>
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
      <div className="card"><h2>Mes sujets</h2>
        {mine.length ? <TopicRows list={mine} s={S} onPick={t => start('guided', t.id)} aiOn={aiOn} hasLocal={hasLocal} /> : <p className="sub">Tu n’as pas encore travaillé de sujet. Va dans « Exercices » pour choisir une matière et un sujet de ta classe.</p>}
      </div>
    </>
  );
}

export function Train() {
  const { S } = useStudent();
  const { user } = useAuth();
  const grade = user.grade;
  const start = useStart();
  const aiOn = useAiOn();
  const { F, setSubj, pickTopic, setFree, setCourse } = useFocus();
  const [msg, setMsg] = useState('');
  const subs = subjectsFor(grade);
  const subj = subs.some(x => x.id === F.subj) ? F.subj : subs[0].id;
  const list = topicsFor(grade, subj);
  const cur = F.tid ? CHN(F.tid) : null;
  const selOk = !!cur && (F.tid === freeId(subj) || (cur.grade === grade && cur.subj === subj));
  const tid = selOk ? F.tid : '', course = F.course.trim();
  const typed = F.tid === freeId(subj) ? F.topic : '';
  const subjName = subjById(subj).name;

  /* Un sujet peut se travailler s'il a un générateur local, ou si l'IA est activée. */
  function can(id) {
    if (hasLocal(id) || aiOn !== false) return true;
    setMsg('Les exercices de ce sujet sont préparés par l’IA, qui n’est pas encore activée. Choisis un sujet marqué sans mention « IA bientôt », ou reviens plus tard.');
    return false;
  }
  function go(mode) {
    setMsg('');
    if (mode === 'diag') {
      const ids = (aiOn !== false ? list : list.filter(t => hasLocal(t.id))).slice(0, 4).map(t => t.id);
      if (!ids.length) { setMsg('Le diagnostic de cette matière a besoin de l’IA, qui n’est pas encore activée. Essaie une autre matière ou un sujet précis.'); return; }
      start('diag', ids[0], { diag: ids, subj });
      return;
    }
    if (!tid) { setMsg('Choisis d’abord un sujet dans la liste, ou écris le tien.'); return; }
    if (!can(tid)) return;
    start(mode, tid, { topicName: F.topic, course: aiOn ? course : '', subj });
  }
  return (
    <>
      <div className="eyebrow">Exercices · {gradeName(grade)}</div>
      <h1>Que veux-tu travailler ?</h1>
      <p className="sub">Les sujets suivent ta classe. Choisis une matière, puis un sujet, et ajoute ton cours si tu veux que l’IA s’appuie dessus.</p>
      <ContentsCard />
      <div className="card" style={{ marginTop: 14 }}>
        <h2>1. Ta matière</h2>
        <SubjectChips list={subs} value={subj} onPick={id => { setMsg(''); setSubj(id); }} />
      </div>
      <div className="card">
        <h2>2. Ton sujet</h2>
        <TopicRows list={list} s={S} sel={tid} aiOn={aiOn} hasLocal={hasLocal} onPick={t => { setMsg(''); pickTopic(t); }} />
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="free-topic">Ou écris ton propre sujet</label>
          <input className="in" id="free-topic" placeholder="Par exemple : les fractions, l’accord du participe passé…" maxLength={100} value={typed} onChange={e => { setMsg(''); setFree(e.target.value); }} />
        </div>
      </div>
      <CourseBox value={F.course} onChange={setCourse} aiOn={aiOn} />
      <div className="card">
        <h2>3. C’est parti</h2>
        <p className="sub">{tid ? 'Sujet choisi : ' + (cur ? (tid === freeId(subj) ? F.topic : cur.name) : '') : 'Aucun sujet choisi pour le moment.'}</p>
        {msg ? <div className="fb hint" role="status">{msg}</div> : null}
        <div className="actions col">
          <button className="btn big" data-a="guided" data-c={tid} onClick={() => go('guided')}>Séance guidée</button>
          <button className="btn ghost" data-a="free" data-c={tid} onClick={() => go('free')}>Entraînement libre (5 exercices)</button>
          <button className="btn ghost" data-a="diag" onClick={() => go('diag')}>Diagnostic en {subjName}</button>
        </div>
        <p className="note">Séance guidée : leçon, essais avec indices, vérification, exercice personnalisé. Diagnostic : quelques questions sans indice pour mesurer ton niveau.</p>
      </div>
    </>
  );
}

export function Coach() {
  const { S, update, name } = useStudent();
  const { user } = useAuth();
  const grade = user.grade;
  const aiOn = useAiOn();
  const { F, setSubj, setFree, setCourse } = useFocus();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null);
  const [edit, setEdit] = useState(!F.topic);
  const box = useRef(null);
  const subs = subjectsFor(grade);
  const subj = subs.some(x => x.id === F.subj) ? F.subj : subs[0].id;
  const subjName = subjById(subj).name;
  const hello = { role: 'assistant', content: 'Bonjour ' + name + ' ! Je suis ton assistant pédagogique eRepeat AI. Dis-moi la matière et le sujet que tu travailles, et colle ton cours si tu veux que je m’appuie dessus.' };
  const chat = S.chat.length ? S.chat : [hello];
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [chat.length, live]);
  const ctx = { subjName, topic: F.topic, course: F.course.trim() };
  async function send(t) {
    t = (t || '').trim();
    if (!t || busy) return;
    setText(''); setBusy(true); setLive('…');
    const history = [...chat, { role: 'user', content: t }];
    update(s => { s.chat = (s.chat.length ? s.chat : [hello]).concat({ role: 'user', content: t }); return s; });
    let out = '';
    try {
      const h = history.slice(-8); while (h.length && h[0].role !== 'user') h.shift();
      out = await askAI(h, ctx);
    } catch (e) {
      out = e && (e.code === 'ai_off' || e.code === 'network') ? localCoach(t, ctx) : (e && e.message) || localCoach(t, ctx);
    }
    out = out || localCoach(t, ctx);
    update(s => { s.chat = s.chat.concat({ role: 'assistant', content: out }).slice(-30); return s; });
    setLive(null); setBusy(false);
  }
  const suggestions = F.topic
    ? ['Explique-moi « ' + F.topic + ' » simplement', 'Donne-moi un indice'].concat(F.course.trim() ? ['Pose-moi une question sur mon cours'] : [])
    : ['Je ne comprends pas mon cours', 'Donne-moi un indice'];
  return (
    <div className="chat">
      <div>
        <div className="eyebrow">Assistant IA · {gradeName(grade)}</div>
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Mon coach</h1>
        {!edit ? (
          <div className="focusbar"><span>{subjName}{F.topic ? ' · ' + F.topic : ''}{F.course.trim() ? ' · cours collé' : ''}</span><button className="btn ghost sm" data-a="focus-edit" onClick={() => setEdit(true)}>Modifier</button></div>
        ) : null}
      </div>
      {edit ? (
        <div className="card" style={{ margin: '0 0 8px' }}>
          <SubjectChips list={subs} value={subj} onPick={setSubj} />
          <div className="field" style={{ marginBottom: 8 }}>
            <label htmlFor="co-topic">Sujet</label>
            <input className="in" id="co-topic" list="co-topics" placeholder="Choisis un sujet ou écris le tien" maxLength={100} value={F.topic} onChange={e => setFree(e.target.value)} />
            <datalist id="co-topics">{topicsFor(grade, subj).map(t => <option key={t.id} value={t.name} />)}</datalist>
          </div>
          <CourseBox value={F.course} onChange={setCourse} aiOn={aiOn} />
          <button className="btn sm" data-a="focus-ok" onClick={() => setEdit(false)}>Valider</button>
        </div>
      ) : null}
      <div className="msgs" id="msgs" ref={box}>
        {chat.map((m, i) => <div key={i} className={'m ' + (m.role === 'user' ? 'me' : 'bot')}>{m.content}</div>)}
        {live ? <div className="m bot">{live}</div> : null}
      </div>
      <div className="chips">
        {suggestions.map(t => <button key={t} className="chip" onClick={() => send(t)}>{t}</button>)}
      </div>
      <form className="composer" onSubmit={e => { e.preventDefault(); send(text); }}>
        <input id="ci" placeholder="Écris ta question ici…" autoComplete="off" aria-label="Ta question" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn" type="submit" data-a="send">Envoyer</button>
      </form>
      <p className="note">{aiOn ? 'L’IA peut se tromper : vérifie les notions importantes avec ton répétiteur.' : aiOn === false ? 'L’IA n’est pas encore activée : je donne des conseils de méthode, sans lire ton cours. Elle s’en servira dès son activation.' : ' '}</p>
    </div>
  );
}

export function Progress() {
  const { S } = useStudent();
  const { user } = useAuth();
  const grade = user.grade;
  const errs = {}; S.hist.forEach(h => { if (h.tag) errs[h.tag] = (errs[h.tag] || 0) + 1; });
  const ek = Object.keys(errs).sort((a, b) => errs[b] - errs[a]), mx = ek.length ? errs[ek[0]] : 1;
  const rk = ranked(S, grade), days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  const plan = rk.length ? [rk[0], rk[1] || rk[0], rk[0], rk[2] || rk[1] || rk[0], null] : [];
  const g = globalPct(S, grade), rt = rate(S);
  const ev = evaluated(S, grade);
  return (
    <>
      <h1>Résultats</h1>
      <p className="sub">Visualise tes efforts et les notions à renforcer, pour ta classe de {gradeName(grade)}.</p>
      <div className="card res" style={{ marginTop: 14 }}><h2>Progression globale</h2><Ring p={g} size={150} sub="maîtrise moyenne" /><Banner p={g} /></div>
      <div className="stats">
        <Tile icon={<IcTarget />} value={rt === null ? '0%' : rt + '%'} label="Taux de réussite" />
        <Tile icon={<IcCal />} value={S.done.length} label="Séances suivies" />
        <Tile icon={<IcBars />} value={streak(S) + ' j'} label="Régularité" />
      </div>
      <div className="card"><h2>Maîtrise par sujet</h2>
        {ev.length ? ev.map(c => { const p = P(S, c.id); return (
          <div key={c.id} style={{ margin: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}><b>{c.name}</b><span>{Math.round(p * 100) + '%'}</span></div>
            <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>{c.subjName}</small>
            <MastBar value={p} />
          </div>
        ); }) : <p className="sub">Aucun sujet évalué pour le moment. Fais un diagnostic ou une séance dans « Exercices ».</p>}
      </div>
      <div className="card"><h2>Types d’erreurs repérés</h2>
        {ek.length ? ek.map(k => <div className="errrow" key={k}><span>{TAGS[k]}</span><div className="bar"><i style={{ width: Math.round(errs[k] / mx * 100) + '%' }} /></div><b>{errs[k]}</b></div>)
          : <p className="sub">Aucune erreur enregistrée pour le moment. Fais une séance pour analyser tes réponses.</p>}
      </div>
      <div className="card point"><h2>Ton plan de la semaine</h2>
        {plan.length ? <div className="plan">{plan.map((c, i) => <div key={i}><b>{days[i]}</b><span>{c ? c.name + ' · ' + Math.round(P(S, c.id) * 100) + ' % maîtrisé' : 'Mini-bilan : refais un diagnostic'}</span></div>)}</div> : <p className="sub">Ton plan apparaîtra après ton premier diagnostic ou ta première séance.</p>}
        <span className="tag">Plan proposé selon ton niveau</span>
      </div>
    </>
  );
}
