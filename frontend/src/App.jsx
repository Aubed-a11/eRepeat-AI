import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, ToastProvider, useAuth } from './context/App.jsx';
import { StudentProvider } from './context/Student.jsx';
import { IcMail, TAB_ICONS } from './components/ui.jsx';
import mark from './assets/mark.png';
import { Forgot, Login, ResetPassword, Signup, Verify, Welcome } from './screens/Auth.jsx';
import { Coach, Home, Progress, Train } from './screens/StudentMain.jsx';
import Session from './screens/Session.jsx';
import { StudentWork } from './screens/Works.jsx';
import { TutorWorkDetail, TutorWorks } from './screens/TutorWorks.jsx';
import { AdultHome, Kids } from './screens/Adult.jsx';
import { Chat, Threads } from './screens/Messages.jsx';
import Profile from './screens/Profile.jsx';

const TABS = {
  student: [['home', 'Accueil', '/accueil'], ['train', 'Exercices', '/exercices'], ['coach', 'Coach', '/coach'], ['prog', 'Résultats', '/resultats'], ['me', 'Profil', '/profil']],
  parent: [['home', 'Accueil', '/accueil'], ['kids', 'Mes enfants', '/enfants'], ['me', 'Profil', '/profil']],
  tutor: [['home', 'Accueil', '/accueil'], ['kids', 'Mes élèves', '/enfants'], ['works', 'Contenus', '/contenus'], ['me', 'Profil', '/profil']]
};

function useOnline() {
  const [on, setOn] = useState(navigator.onLine !== false);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

function Layout({ children }) {
  const { user, unread } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const online = useOnline();
  const main = useRef(null);
  const path = loc.pathname;
  const flex = path === '/coach' || /^\/messages\/.+/.test(path);
  useEffect(() => { if (main.current) main.current.scrollTop = 0; }, [path]);
  const tabs = user ? TABS[user.role] : null;
  const active = t => {
    if (t === 'train') return path.startsWith('/exercices') || path.startsWith('/cours');
    if (t === 'works') return path.startsWith('/contenus');
    return TABS[user.role].find(x => x[0] === t)[2] === path;
  };
  return (
    <div id="shell">
      <header id="top">
        <div className="brand"><img className="mark" src={mark} alt="" /><div><b>eRepeat <i>AI</i></b><small>Apprendre • Répéter • Réussir</small></div></div>
        <div className="hright">
          {user ? (
            <button className="mailbtn" data-a="msgs" onClick={() => nav('/messages')} aria-label={'Messages' + (unread ? ' (' + unread + ' non lu' + (unread > 1 ? 's' : '') + ')' : '')}>
              <IcMail />{unread ? <span className="badge">{unread > 9 ? '9+' : unread}</span> : null}
            </button>
          ) : null}
          <span className={'pill' + (online ? '' : ' off')} title={online ? 'En ligne' : 'Hors connexion'}>●<span className="pt"> {online ? 'En ligne' : 'Hors connexion'}</span></span>
        </div>
      </header>
      <main id="main" ref={main} className={flex ? 'flexmain' : ''}>{children}</main>
      {tabs ? (
        <nav id="tabs" aria-label="Navigation" style={{ gridTemplateColumns: 'repeat(' + tabs.length + ',1fr)' }}>
          {tabs.map(t => (
            <button key={t[0]} data-a="tab" data-v={t[0]} className={active(t[0]) ? 'on' : ''} aria-label={t[1]} onClick={() => nav(t[2])}>{TAB_ICONS[t[0]]}{t[1]}</button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Layout>
        <Routes>
          <Route path="/bienvenue" element={<Welcome />} />
          <Route path="/inscription" element={<Signup />} />
          <Route path="/connexion" element={<Login />} />
          <Route path="/verification" element={<Verify />} />
          <Route path="/mot-de-passe-oublie" element={<Forgot />} />
          <Route path="/nouveau-mot-de-passe" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/bienvenue" replace />} />
        </Routes>
      </Layout>
    );
  }
  const student = user.role === 'student';
  const body = (
    <Layout>
      <Routes>
        <Route path="/accueil" element={student ? <Home /> : <AdultHome />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/messages" element={<Threads />} />
        <Route path="/messages/:uid" element={<Chat />} />
        {student ? <Route path="/exercices" element={<Train />} /> : null}
        {student ? <Route path="/exercices/seance" element={<Session />} /> : null}
        {student ? <Route path="/coach" element={<Coach />} /> : null}
        {student ? <Route path="/resultats" element={<Progress />} /> : null}
        {student ? <Route path="/cours/:id" element={<StudentWork />} /> : null}
        {!student ? <Route path="/enfants" element={<Kids />} /> : null}
        {user.role === 'tutor' ? <Route path="/contenus" element={<TutorWorks />} /> : null}
        {user.role === 'tutor' ? <Route path="/contenus/:id" element={<TutorWorkDetail />} /> : null}
        <Route path="*" element={<Navigate to="/accueil" replace />} />
      </Routes>
    </Layout>
  );
  return student ? <StudentProvider key={user.id}>{body}</StudentProvider> : body;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}
