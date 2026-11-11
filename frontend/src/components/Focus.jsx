import React, { useState } from 'react';
import { GRADES, SUBJECTS, freeId } from '../lib/catalog.js';
import { useStudent } from '../context/Student.jsx';

export const COURSE_MAX = 6000;

/* Liste déroulante des classes, du CP à la Terminale. */
export function GradeSelect({ id, value, onChange, label }) {
  const cycles = ['Primaire', 'Collège', 'Lycée'];
  return (
    <div className="field">
      <label htmlFor={id}>{label || 'Ta classe'}</label>
      <select className="in" id={id} value={value} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Choisis ta classe</option>
        {cycles.map(c => <optgroup key={c} label={c}>{GRADES.filter(g => g.cycle === c).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</optgroup>)}
      </select>
    </div>
  );
}

/* Ce que l'élève travaille : matière, sujet, cours collé. Gardé sur l'appareil, partagé par les exercices et le coach. */
export function useFocus() {
  const { S, update } = useStudent();
  const F = S.focus;
  const set = patch => update(s => { s.focus = { ...s.focus, ...patch }; return s; });
  return {
    F,
    setSubj: id => set({ subj: id, tid: '', topic: '' }),
    pickTopic: t => set({ tid: t.id, topic: t.name }),
    setFree: text => set({ tid: text.trim() ? freeId(F.subj) : '', topic: text.slice(0, 100) }),
    setCourse: c => set({ course: c.slice(0, COURSE_MAX) })
  };
}

export function SubjectChips({ list, value, onPick }) {
  return (
    <div className="chips" role="group" aria-label="Matière">
      {list.map(s => <button key={s.id} type="button" className={'chip' + (value === s.id ? ' on' : '')} data-a="subj" data-s={s.id} aria-pressed={value === s.id} onClick={() => onPick(s.id)}>{s.name}</button>)}
    </div>
  );
}

/* Zone facultative pour coller son cours. */
export function CourseBox({ value, onChange, aiOn, startOpen }) {
  const [open, setOpen] = useState(!!startOpen || !!value);
  return (
    <div className="card coursebox">
      <button type="button" className="coursehead" data-a="course-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span><b>Mon cours</b><small>{value ? value.length + ' caractères collés' : 'facultatif : l’IA s’appuie dessus'}</small></span>
        <span className="chev" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <>
          <textarea className="in" id="course" rows={7} maxLength={COURSE_MAX} placeholder="Colle ici ton cours ou tes notes. L’IA s’en servira pour te poser des exercices et t’expliquer." value={value} onChange={e => onChange(e.target.value)} aria-label="Mon cours" />
          <p className="note">{value.length} / {COURSE_MAX} caractères. Ton cours reste sur ton appareil. Il est envoyé au service d’IA seulement quand tu lances un exercice ou que tu écris au coach, et eRepeat AI ne le conserve pas.</p>
          {aiOn === false ? <p className="note warn">L’IA n’est pas encore activée : ton cours sera utilisé dès qu’elle le sera.</p> : null}
          {value ? <button type="button" className="btn ghost sm" data-a="course-clear" onClick={() => onChange('')}>Effacer mon cours</button> : null}
        </>
      ) : null}
    </div>
  );
}
