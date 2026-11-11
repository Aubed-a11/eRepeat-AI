import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, getAuth, setOnExpired, storeAuth } from '../lib/api.js';
import { dropState } from '../lib/student.js';
import { resetData } from '../lib/data.js';

/* ---------- Message court en bas de l'écran ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [on, setOn] = useState(false);
  const timer = useRef(null);
  const toast = useCallback(m => {
    setMsg(m); setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toast" className={on ? 'on' : ''} role="status" aria-live="polite">{msg}</div>
    </ToastCtx.Provider>
  );
}

/* ---------- Compte connecté ---------- */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
export function AuthProvider({ children }) {
  const toast = useToast();
  const [auth, setAuth] = useState(getAuth());
  const [linked, setLinked] = useState([]);
  const [unread, setUnread] = useState(0);

  const signIn = useCallback((token, user) => {
    const a = { token, user };
    resetData(); storeAuth(a); setAuth(a); setLinked([]); setUnread(0);
    toast('Bienvenue, ' + user.name + ' !');
  }, [toast]);
  const signOutLocal = useCallback(() => { resetData(); storeAuth(null); setAuth(null); setLinked([]); setUnread(0); }, []);
  const logout = useCallback(async () => { try { await api('POST', '/logout'); } catch (e) { /* déjà déconnecté */ } signOutLocal(); }, [signOutLocal]);

  useEffect(() => { setOnExpired(() => { signOutLocal(); toast('Session expirée. Reconnecte-toi.'); }); }, [signOutLocal, toast]);

  const refreshMe = useCallback(async () => {
    try {
      const r = await api('GET', '/me');
      setLinked(r.linked || []);
      const cur = getAuth();
      if (cur && r.user) { const a = { token: cur.token, user: r.user }; storeAuth(a); setAuth(a); }
    } catch (e) { /* hors connexion */ }
  }, []);
  const refreshUnread = useCallback(async () => {
    if (!getAuth()) return;
    try { const r = await api('GET', '/unread'); setUnread(r.n); } catch (e) { /* hors connexion */ }
  }, []);

  const uid = auth && auth.user.id;
  useEffect(() => {
    if (!uid) return undefined;
    refreshMe(); refreshUnread();
    const t = setInterval(() => { if (!document.hidden && navigator.onLine !== false) refreshUnread(); }, 15000);
    return () => clearInterval(t);
  }, [uid, refreshMe, refreshUnread]);

  const deleteAccount = useCallback(async password => {
    const id = getAuth().user.id;
    await api('DELETE', '/me', { password });
    dropState(id); signOutLocal();
  }, [signOutLocal]);

  return (
    <AuthCtx.Provider value={{ auth, user: auth && auth.user, linked, unread, setUnread, refreshUnread, refreshMe, signIn, logout, deleteAccount }}>
      {children}
    </AuthCtx.Provider>
  );
}
