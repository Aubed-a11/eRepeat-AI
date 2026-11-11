import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { emptyState, loadState, storeState } from '../lib/student.js';
import { useAuth } from './App.jsx';

const Ctx = createContext(null);
export const useStudent = () => useContext(Ctx);

/* État de l'élève : enregistré sur l'appareil, envoyé au serveur (suivi du parent et du répétiteur) et repris à la connexion. */
export function StudentProvider({ children }) {
  const { user } = useAuth();
  const uid = user.id;
  const [S, setS] = useState(() => loadState(uid));
  const ref = useRef(S);
  const dirty = useRef(false);
  const timer = useRef(null);
  ref.current = S;

  const push = useCallback(async () => {
    if (!dirty.current) return;
    const s = ref.current;
    try { await api('PUT', '/progress', { mastery: s.mastery, hist: s.hist.slice(-200), done: s.done.slice(-60) }); dirty.current = false; } catch (e) { /* on réessaiera */ }
  }, []);
  const update = useCallback(fn => {
    const next = fn(JSON.parse(JSON.stringify(ref.current)));
    ref.current = next; setS(next); storeState(uid, next);
    dirty.current = true; clearTimeout(timer.current); timer.current = setTimeout(push, 1500);
  }, [uid, push]);
  const reset = useCallback(() => update(() => emptyState()), [update]);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const p = await api('GET', '/progress'); if (off) return;
        const s = ref.current;
        if (p && !s.hist.length && !Object.keys(s.mastery).length && ((p.hist || []).length || Object.keys(p.mastery || {}).length)) {
          const next = { ...s, mastery: p.mastery || {}, hist: p.hist || [], done: p.done || [], diag: Object.keys(p.mastery || {}).length > 0 };
          ref.current = next; setS(next); storeState(uid, next);
        } else if (!p || s.hist.length > (p.hist || []).length || s.done.length > (p.done || []).length) { dirty.current = true; push(); }
      } catch (e) { /* hors connexion */ }
    })();
    const flush = () => { if (dirty.current) push(); };
    window.addEventListener('pagehide', flush);
    return () => { off = true; window.removeEventListener('pagehide', flush); flush(); };
  }, [uid, push]);

  return <Ctx.Provider value={{ S, update, reset, name: user.name }}>{children}</Ctx.Provider>;
}
