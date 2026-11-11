import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CH, CHN, LESSONS, TAGS, gen } from '../lib/content.js';
import { P, levelFor, ranked, reco } from '../lib/student.js';
import { askAI, localCoach } from '../lib/coach.js';
import { useStudent } from '../context/Student.jsx';
import { Banner, IcCheck, IcClock, MastBar, Ring } from '../components/ui.jsx';

const LETTERS = 'ABCD';

function buildItems(mode, chap) {
  const items = [];
  if (mode === 'diag') {
    CH.forEach(c => { for (let k = 0; k < 2; k++) items.push({ t: 'q', chap: c.id, ph: 'Diagnostic', nohint: true, diag: true, noretry: true }); });
  } else if (mode === 'guided') {
    items.push({ t: 'lesson', chap, ph: 'Comprendre la notion' });
    for (let i = 0; i < 3; i++) items.push({ t: 'q', chap, ph: 'Essayer avec un indice' });
    for (let i = 0; i < 3; i++) items.push({ t: 'q', chap, ph: 'Vérifier ta réponse', nohint: true, noretry: true });
    for (let i = 0; i < 2; i++) items.push({ t: 'q', chap, ph: 'Exercice personnalisé', boost: true });
  } else {
    for (let i = 0; i < 5; i++) items.push({ t: 'q', chap, ph: 'Entraînement libre' });
  }
  return items;
}

function makeCur(sess, S) {
  const it = sess.items[sess.i];
  if (!it) return null;
  if (it.t === 'lesson') return { lesson: true };
  let lv = levelFor(S, it.chap);
  if (it.diag) { const r = sess.diagRes[it.chap] || (sess.diagRes[it.chap] = { sc: 0, n: 0, last: null }); lv = r.last === null ? 2 : (r.last ? 3 : 1); }
  else if (it.boost) lv += 1;
  return { q: gen(it.chap, lv), it, pick: null, tries: 0, hints: 0, wrong: {}, done: false, msg: null, ai: null };
}

export default function Session() {
  const loc = useLocation();
  const nav = useNavigate();
  const { S, update, name } = useStudent();
  const st = loc.state;
  const [, tick] = useState(0);
  const rerender = () => tick(x => x + 1);
  const holder = useRef(null);
  const fbEnd = useRef(null);
  const [toastMsg, setToastMsg] = useState('');

  if (!holder.current && st) {
    const sess = { mode: st.mode, chap: st.chap, items: buildItems(st.mode, st.chap), i: 0, ok: 0, n: 0, hints: 0, tags: {}, diagRes: {}, finished: false };
    holder.current = { sess, cur: makeCur(sess, S) };
  }
  const fbKey = holder.current && holder.current.cur && !holder.current.cur.lesson ? holder.current.cur.hints + '|' + (holder.current.cur.msg ? holder.current.cur.msg.t : '') + '|' + (holder.current.cur.ai || '') : '';
  const lastKey = useRef('');
  useEffect(() => {
    const changed = fbKey !== lastKey.current; lastKey.current = fbKey;
    if (changed && /[^0|]/.test(fbKey.replace(/^0\|\|$/, '')) && fbEnd.current && fbEnd.current.scrollIntoView) fbEnd.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  if (!holder.current) return <Navigate to="/exercices" replace />;
  const h = holder.current, sess = h.sess;
  const quit = () => nav(sess.finished ? '/accueil' : '/exercices');

  function record(ok) {
    const cur = h.cur, it = cur.it, q = cur.q, first = ok && cur.tries === 0 && cur.hints === 0;
    let tag = null; for (const w in cur.wrong) { tag = q.tags[w]; break; }
    sess.n++; if (ok) sess.ok++; sess.hints += cur.hints; if (tag) sess.tags[tag] = (sess.tags[tag] || 0) + 1;
    let diagMastery = null;
    if (it.diag) { const r = sess.diagRes[it.chap]; r.n++; if (ok) r.sc++; r.last = ok; if (r.n >= 2) diagMastery = r.sc === 2 ? .8 : r.sc === 1 ? .5 : .2; }
    update(s => {
      s.hist.push({ t: Date.now(), chap: q.chap, ok, first: it.diag ? undefined : first, tag });
      if (s.hist.length > 400) s.hist = s.hist.slice(-400);
      if (it.diag) { if (diagMastery !== null) s.mastery[it.chap] = diagMastery; }
      else { let p = typeof s.mastery[q.chap] === 'number' ? s.mastery[q.chap] : .5; s.mastery[q.chap] = ok ? p + (1 - p) * (first ? .25 : .12) : p - p * .25; }
      return s;
    });
  }
  function check() {
    const cur = h.cur, q = cur.q, it = cur.it;
    if (cur.pick === null) { setToastMsg('Choisis une réponse avant de vérifier.'); return; }
    setToastMsg('');
    if (cur.pick === q.ans) { cur.done = true; cur.msg = { k: 'ok', t: cur.tries === 0 && cur.hints === 0 ? 'Exact, bravo !' : 'Exact !', b: q.expl }; record(true); }
    else {
      cur.tries++; cur.wrong[cur.pick] = true; const tg = q.tags[cur.pick];
      if (it.noretry || cur.tries >= 2) { cur.done = true; cur.msg = { k: 'no', t: TAGS[tg] + (it.diag ? '' : ' · voici la solution'), b: (it.diag ? '' : q.whys[cur.pick] + ' ') + q.expl }; record(false); }
      else { cur.msg = { k: 'no', t: TAGS[tg], b: q.whys[cur.pick] + ' Reprends l’indice et essaie encore.' }; if (cur.hints < 1) cur.hints = 1; }
      cur.pick = null;
    }
    rerender();
  }
  async function finish() {
    sess.finished = true;
    update(s => { s.done.push(Date.now()); s.done = s.done.slice(-60); if (sess.mode === 'diag') s.diag = true; return s; });
    if (sess.mode === 'guided') {
      try {
        const r = await api('GET', '/assignments');
        await Promise.all(r.assignments.filter(a => !a.doneAt && a.chap === sess.chap).map(a => api('POST', '/assignments/' + a.id + '/done').catch(() => {})));
      } catch (e) { /* hors connexion */ }
    }
    rerender();
  }
  function next() {
    sess.i++;
    if (sess.i >= sess.items.length) { finish(); return; }
    h.cur = makeCur(sess, S); rerender();
  }
  async function explain() {
    const c = h.cur, q = c.q; c.ai = '…'; rerender();
    const prompt = 'Exercice : ' + q.q + ' ' + q.sub + '\nChoix proposés : ' + q.opts.join(' | ') + '\nL’élève a eu du mal. Explique autrement la méthode, avec un exemple de la vie courante au Bénin, en 5 lignes maximum. ' + (c.done ? 'La solution est déjà affichée : tu peux la rappeler.' : 'Ne donne pas la réponse finale.');
    try { c.ai = await askAI([{ role: 'user', content: prompt }], S, name); }
    catch (e) { c.ai = q.hints[Math.min(c.hints, 2)] + ' Pour t’entraîner, refais le calcul pas à pas sur un exemple plus simple.'; }
    rerender();
  }

  const n = sess.items.length, i = Math.min(sess.i, n);
  const it = sess.items[Math.min(sess.i, n - 1)], ch = CHN(it.chap), left = Math.max(1, Math.round((n - i) * 1.5));
  const header = (
    <>
      <div className="exhead">
        <button className="back" data-a="quit" aria-label="Quitter la séance" onClick={quit}>Quitter</button>
        <h2>{sess.mode === 'diag' ? 'Diagnostic' : 'Exercice de Révision'}</h2>
        <span className="timechip"><IcClock />{left} min</span>
      </div>
      <div className="sesstop"><span className="schip">{ch.subj}</span><span className="phase">{it.ph}</span><span className="sub">{Math.min(sess.i + 1, n)} / {n}</span></div>
      <div className="bar" style={{ marginBottom: 6 }}><i style={{ width: Math.round(i / n * 100) + '%' }} /></div>
    </>
  );

  if (sess.finished) return <Bilan sess={sess} S={S} onQuit={quit} onStart={(m, c) => { holder.current = null; nav('/exercices/seance', { state: { mode: m, chap: c }, replace: true }); rerender(); }} />;

  const cur = h.cur;
  if (cur.lesson) {
    const L = LESSONS[it.chap];
    return (
      <>
        {header}
        <div className="qbox lesson">
          <div className="eyebrow">Comprendre avant de répondre</div>
          <h2 style={{ fontSize: 20, marginTop: 8 }}>{L.title}</h2>
          {L.p.map((t, k) => <p key={k}>{t}</p>)}
          <div className="worked">{L.ex.map((t, k) => <React.Fragment key={k}>{k ? <br /> : null}{t}</React.Fragment>)}</div>
          <b style={{ fontSize: 13 }}>La méthode</b>
          <ol>{L.steps.map((t, k) => <li key={k}>{t}</li>)}</ol>
        </div>
        <button className="btn big block" data-a="lessonok" onClick={() => { sess.i++; h.cur = makeCur(sess, S); rerender(); }}>J’essaie un exercice</button>
      </>
    );
  }
  const q = cur.q;
  return (
    <>
      {header}
      <div className="qbox">
        <div className="eyebrow">{ch.name} · niveau {q.level}</div>
        <p className="qn" style={{ marginTop: 10 }}><b>{sess.i + 1}.</b> {q.sub}</p>
        <div className={'q' + (q.q.length > 30 ? ' long' : '')}>{q.q}</div>
        <div className="opts">
          {q.opts.map((o, k) => {
            let cl = 'opt';
            if (cur.done && k === q.ans) cl += ' good'; else if (cur.wrong[k]) cl += ' bad'; else if (cur.pick === k) cl += ' sel';
            return (
              <button key={k} className={cl} data-a="pick" data-i={k} aria-pressed={cur.pick === k} disabled={cur.done || !!cur.wrong[k]} onClick={() => { cur.pick = k; rerender(); }}>
                <b>{LETTERS[k]}</b><span>{o}</span><i className="ck"><IcCheck /></i>
              </button>
            );
          })}
        </div>
        {Array.from({ length: cur.hints }, (_, k) => <div key={k} className="fb hint"><b>Indice {k + 1}</b>{q.hints[k]}</div>)}
        {cur.msg ? <div className={'fb ' + cur.msg.k} role="status"><b>{cur.msg.t}</b>{cur.msg.b}</div> : null}
        {cur.ai ? <div className="fb ai"><b>Explication</b>{cur.ai === '…' ? <span className="dots"><span /><span /><span /></span> : cur.ai}</div> : null}
        {toastMsg ? <div className="fb hint" role="status">{toastMsg}</div> : null}
        <div ref={fbEnd} />
        <div className="actions col">
          {!cur.done ? (
            <>
              {!it.nohint ? <button className="btn ghost" data-a="hint" disabled={cur.hints >= 3} onClick={() => { if (cur.hints < 3) { cur.hints++; rerender(); } }}>Obtenir un indice</button> : null}
              <button className="btn big" data-a="check" onClick={check}>Valider ma réponse</button>
            </>
          ) : (
            <>
              <button className="btn ghost" data-a="explain" onClick={explain}>Explique autrement</button>
              <button className="btn big" data-a="next" onClick={next}>{sess.i >= sess.items.length - 1 ? 'Voir mon bilan' : 'Suivant'}</button>
            </>
          )}
        </div>
        <p className="note">{it.diag ? 'Diagnostic : pas d’indice, pour mesurer ton niveau réel.' : 'Vérifie les notions importantes avec ton répétiteur.'}</p>
      </div>
    </>
  );
}

function Bilan({ sess, S, onQuit, onStart }) {
  const { name } = useStudent();
  const s = sess, pc = s.n ? Math.round(100 * s.ok / s.n) : 0;
  const tk = Object.keys(s.tags).sort((a, b) => s.tags[b] - s.tags[a])[0];
  const r = reco(S, name);
  return (
    <>
      <div className="qbox res">
        <div className="eyebrow" style={{ marginBottom: 12 }}>{s.mode === 'diag' ? 'Diagnostic terminé' : 'Séance terminée'}</div>
        <Ring p={pc} size={150} sub={s.ok + ' / ' + s.n} />
        <p className="sub" style={{ marginTop: 10 }}>{s.mode === 'diag' ? 'Ton premier bilan est prêt.' : 'bonnes réponses' + (s.hints ? ', ' + s.hints + ' indice' + (s.hints > 1 ? 's' : '') + ' utilisé' + (s.hints > 1 ? 's' : '') : '')}</p>
        <Banner p={pc} />
      </div>
      {s.mode === 'diag' ? (
        <div className="card"><h2>Ton niveau par chapitre</h2>
          {CH.map(c => { const p = P(S, c.id) || 0; const l = p >= .7 ? 'Solide' : p >= .45 ? 'À consolider' : 'À renforcer'; return (
            <div className="chrow" key={c.id}><span className="ic">{c.ic}</span><span className="tx"><b>{c.name}</b><small>{l}</small><MastBar value={p} /></span><span className="pct">{Math.round(p * 100)}%</span></div>
          ); })}
        </div>
      ) : null}
      <div className="card point"><h2>Ce que j’ai remarqué</h2>
        <p>{tk ? 'Tes erreurs étaient surtout de type « ' + TAGS[tk].toLowerCase() + ' ». Je te proposerai des exercices pour ce point.' : 'Aucune erreur marquante sur cette séance.'}</p>
        <span className="tag">Analyse faite par l’IA</span>
      </div>
      <div className="actions">
        <button className="btn" data-a={r.chap ? 'guided' : 'diag'} data-c={r.chap || ''} onClick={() => onStart(r.chap ? 'guided' : 'diag', r.chap)}>{r.chap ? 'Séance suivante : ' + CHN(r.chap).name : 'Refaire un diagnostic'}</button>
        <button className="btn ghost" data-a="quit" onClick={onQuit}>Terminer</button>
      </div>
    </>
  );
}
