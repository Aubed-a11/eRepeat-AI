import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAiOn } from '../lib/exo.js';
import { gradeName } from '../lib/catalog.js';
import { GradeSelect } from '../components/Focus.jsx';
import { ROLE_LABEL } from '../lib/format.js';
import { useAuth, useToast } from '../context/App.jsx';
import { useStudent } from '../context/Student.jsx';
import { ConfirmButton } from '../components/ui.jsx';

let deferred = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event('erepeat-install')); });
  window.addEventListener('appinstalled', () => { deferred = null; window.dispatchEvent(new Event('erepeat-install')); });
}
function useInstall() {
  const [can, setCan] = useState(!!deferred);
  useEffect(() => { const f = () => setCan(!!deferred); window.addEventListener('erepeat-install', f); f(); return () => window.removeEventListener('erepeat-install', f); }, []);
  return [can, async () => { if (!deferred) return; const d = deferred; deferred = null; setCan(false); d.prompt(); try { await d.userChoice; } catch (e) { /* ignoré */ } }];
}

function ResetResults() {
  const { reset } = useStudent();
  const toast = useToast();
  return <ConfirmButton className="btn ghost" label="Effacer mes résultats" confirmLabel="Confirmer l’effacement" data-a="reset" onConfirm={() => { reset(); toast('Résultats effacés.'); }} />;
}

export default function Profile() {
  const { user, linked, refreshMe, logout, deleteAccount, setGrade } = useAuth();
  const aiOn = useAiOn();
  const [chg, setChg] = useState(false);
  const toast = useToast();
  const [canInstall, install] = useInstall();
  const [del, setDel] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { refreshMe(); }, [refreshMe]);
  const r = user.role, stu = r === 'student';

  const copy = () => {
    const c = user.matricule; if (!c) return;
    try { navigator.clipboard.writeText(c).then(() => toast('Matricule copié.'), () => toast('Matricule : ' + c)); } catch (e) { toast('Matricule : ' + c); }
  };
  async function remove() {
    if (busy) return;
    setBusy(true); setErr('');
    try { await deleteAccount(pw); toast('Compte supprimé.'); return; }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <>
      <div className="eyebrow">Compte</div><h1>Mon profil</h1>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row2"><div className="grow"><b>{user.name}</b><small>{user.email}</small></div><span className="pill">{ROLE_LABEL[r]}</span></div>
        {stu ? (
          <>
            <div className="row2"><div className="grow"><b>Classe</b><small>{gradeName(user.grade) || 'Non choisie'}</small></div><button className="btn ghost sm" data-a="grade-edit" onClick={() => setChg(v => !v)}>{chg ? 'Fermer' : 'Changer'}</button></div>
            {chg ? <GradeSelect id="pf-grade" label="Ma classe" value={user.grade || ''} onChange={async g => { try { await setGrade(g); toast('Classe mise à jour : ' + gradeName(g) + '.'); setChg(false); } catch (e) { toast(e.message); } }} /> : null}
            <div className="row2"><div><b>Sans Internet</b><small>Les exercices préparés sans IA restent disponibles hors connexion.</small></div></div>
            <div className="row2"><div><b>Tuteur IA</b><small>{aiOn === null ? 'Vérification…' : aiOn ? 'IA activée : exercices vérifiés et coach' : 'Pas encore activée : réponses de base seulement'}</small></div></div>
          </>
        ) : null}
        {canInstall ? <div className="row2"><div><b>Installer l’application</b><small>Ajoute eRepeat AI à l’écran d’accueil ou au bureau.</small></div><button className="btn sm" data-a="install" onClick={install}>Installer</button></div> : null}
      </div>
      <div className="card"><h2>Mon matricule</h2>
        <p className="sub">{stu ? 'Ton matricule t’identifie sur la plateforme. Donne-le à ton parent et à ton répétiteur : avec lui, ils peuvent suivre tes progrès. Tu peux retirer un accès à tout moment.' : 'Votre matricule vous identifie sur la plateforme.'}</p>
        <div className="linkcode" aria-label="Matricule">{user.matricule || '…'}</div>
        <button className="btn ghost sm" data-a="copy" onClick={copy}>Copier le matricule</button>
        {stu ? (linked.length ? linked.map(l => (
          <div className="row2" key={l.linkId}>
            <div className="grow"><b>{l.name}</b><small>{l.role === 'parent' ? 'Parent' : 'Répétiteur'} · {l.matricule || ''}</small></div>
            <button className="btn ghost sm" data-a="unlink" onClick={async () => { try { await api('DELETE', '/link/' + l.linkId); toast('Liaison retirée.'); } catch (e) { toast(e.message); } refreshMe(); }}>Retirer</button>
          </div>
        )) : <p className="note">Aucun accès pour le moment.</p>) : null}
      </div>
      <div className="card"><h2>Confidentialité</h2>
        <p className="sub">{stu ? 'Tes résultats ne sont visibles que par toi et par les personnes que tu as liées à ton compte. Les échanges avec le coach sont gardés sur cet appareil. Quand l’IA est activée, ta question (et ton cours si tu l’as collé) est envoyée au service d’IA pour te répondre ; eRepeat AI ne les conserve pas.' : 'Vous ne voyez que les élèves qui vous ont donné leur code de liaison. Chacun peut retirer cet accès à tout moment.'}</p>
        <div className="actions col">
          <button className="btn ghost" data-a="logout" onClick={logout}>Se déconnecter</button>
          {stu ? <ResetResults /> : null}
          <button className="btn ghost" data-a="delacc" onClick={() => setDel(true)}>Supprimer mon compte</button>
        </div>
      </div>
      {del ? (
        <div className="card"><h2>Supprimer mon compte</h2>
          <p className="sub">Cette action est définitive : le compte, les résultats et les liaisons sont effacés.</p>
          <div className="field"><label htmlFor="dp">Mot de passe</label><input className="in" id="dp" type="password" autoFocus autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') remove(); }} /></div>
          <div id="au-err" className={"err" + (err ? " on" : "")} role="alert">{err}</div>
          <button className="btn danger block" data-a="delacc2" disabled={busy} onClick={remove}>Supprimer définitivement</button>
          <button className="btn ghost block" style={{ marginTop: 8 }} data-a="delcancel" onClick={() => { setDel(false); setPw(''); setErr(''); }}>Annuler</button>
        </div>
      ) : null}
    </>
  );
}
