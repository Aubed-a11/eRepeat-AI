import React from 'react';
import { CH } from '../lib/content.js';
import { P } from '../lib/student.js';

const Svg = ({ children }) => <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
export const IcTarget = () => <Svg><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></Svg>;
export const IcCal = () => <Svg><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4" /></Svg>;
export const IcBars = () => <Svg><path d="M5 20V10M12 20V4M19 20v-7" /></Svg>;
export const IcCheck = () => <Svg><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IcClock = () => <Svg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9.5 3h5" /></Svg>;
export const IcPeople = () => <Svg><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.7-3.5 3.2-5.5 6.5-5.5s5.8 2 6.5 5.5" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14.5c2.2.2 3.9 1.8 4.5 4.5" /></Svg>;
export const IcMail = () => <Svg><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" /></Svg>;
export const TAB_ICONS = {
  home: <Svg><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Svg>,
  train: <Svg><path d="M5 4h11l3 3v13H5z" /><path d="M9 12h6M9 16h4" /></Svg>,
  coach: <Svg><path d="M4 5h16v11H9l-5 4z" /></Svg>,
  prog: <Svg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>,
  me: <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></Svg>,
  works: <Svg><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></Svg>,
  kids: <Svg><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.7-3.5 3.2-5.5 6.5-5.5s5.8 2 6.5 5.5" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14.5c2.2.2 3.9 1.8 4.5 4.5" /></Svg>
};

export const Tile = ({ icon, value, label }) => (
  <div className="stat">{icon}<strong>{value}</strong><span>{label}</span></div>
);

export function Ring({ p, size, sub }) {
  const c = 2 * Math.PI * 42, v = p === null || p === undefined ? 0 : p;
  return (
    <div className={'ring' + (size < 90 ? ' sm' : '')} role="img" aria-label={p === null || p === undefined ? 'Pas encore de résultat' : p + ' pour cent'} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#dbe5fb" strokeWidth="10" />
        {v > 0 && <circle cx="50" cy="50" r="42" fill="none" stroke="#22a55a" strokeWidth="10" strokeLinecap="round" strokeDasharray={(c * v / 100).toFixed(1) + ' ' + c.toFixed(1)} transform="rotate(-90 50 50)" />}
      </svg>
      <div className="rv"><b>{p === null || p === undefined ? '0%' : p + '%'}</b>{sub ? <small>{sub}</small> : null}</div>
    </div>
  );
}

export function Banner({ p }) {
  const k = p === null || p === undefined ? ['info', 'Fais ton diagnostic pour démarrer.'] : p >= 70 ? ['ok', 'Excellent travail !'] : p >= 45 ? ['mid', 'Bonne progression, continue !'] : ['mid', 'Chaque exercice te fait avancer.'];
  return <div className={'banner ' + k[0]}><IcCheck /><span>{k[1]}</span></div>;
}

export function MastBar({ value }) {
  const v = typeof value === 'number' ? Math.round(value * 100) : 0;
  return <div className={'bar ' + (typeof value !== 'number' ? '' : value < .45 ? 'bad' : value < .7 ? 'warn' : '')}><i style={{ width: v + '%' }} /></div>;
}

export function ChapterRows({ s, onPick }) {
  return CH.map(c => {
    const p = P(s, c.id);
    return (
      <button key={c.id} className="chrow" data-a="guided" data-c={c.id} onClick={() => onPick(c.id)}>
        <span className="ic">{c.ic}</span>
        <span className="tx"><b>{c.name}</b><small>{c.subj}{p === null ? ' · pas encore évalué' : ''}</small><MastBar value={p === null ? undefined : p} /></span>
        <span className="pct">{p === null ? '0%' : Math.round(p * 100) + '%'}</span>
      </button>
    );
  });
}

export const Eyebrow = ({ children }) => <div className="eyebrow">{children}</div>;

/* Bouton à double validation (suppression, retrait) : un premier appui arme, le second confirme. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn ghost sm', ...rest }) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <button className={className + (armed ? ' danger' : '')} {...rest} onClick={() => { if (!armed) { setArmed(true); return; } setArmed(false); onConfirm(); }}>
      {armed ? confirmLabel : label}
    </button>
  );
}

export function FileField({ id, label, file, onFile, onError }) {
  const [name, setName] = React.useState(file ? file.name : '');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <label className="filebtn">
        <input className="vh" type="file" id={id} accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={async e => {
            const f = e.target.files && e.target.files[0];
            if (!f) { onFile(null); setName(''); return; }
            try { const x = await (await import('../lib/api.js')).readFile(f); onFile(x); setName(x.name + ' (' + Math.max(1, Math.round(x.size / 1024)) + ' Ko)'); }
            catch (er) { onError(er.message); e.target.value = ''; }
          }} />
        <span className="btn ghost sm">Choisir un fichier</span>
      </label>
      <span className="sm2" id={id + '-n'}>{name || 'Aucun fichier choisi'} · PDF, PNG, JPEG ou WEBP, 3 Mo maximum</span>
    </div>
  );
}
