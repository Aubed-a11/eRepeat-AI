export const fdate = t => new Date(t).toLocaleDateString('fr-FR');
export const ftime = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const ago = t => {
  if (!t) return 'aucune activité';
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? 'aujourd’hui' : d === 1 ? 'hier' : 'il y a ' + d + ' jours';
};
export const ROLE_LABEL = { student: 'Élève', parent: 'Parent', tutor: 'Répétiteur' };
export const maskEmail = e => { const [u, d] = String(e).split('@'); return (u || '').slice(0, 2) + '***@' + (d || ''); };
