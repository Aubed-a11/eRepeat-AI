/* Accès au serveur. L'adresse vient de VITE_API_BASE (vide = même adresse que le site). */
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || '';
const AUTH_KEY = 'erepeat_auth_v2';

let auth = null;
try { auth = JSON.parse(localStorage.getItem(AUTH_KEY)); } catch (e) { /* aucune session */ }
if (!auth || !auth.token || !auth.user) auth = null;

let onExpired = () => {};
export const setOnExpired = fn => { onExpired = fn; };
export const getAuth = () => auth;
export function storeAuth(a) {
  auth = a;
  try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* stockage indisponible */ }
}

export class ApiError extends Error {
  constructor(code, status, message) { super(message); this.code = code; this.status = status; }
}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API_BASE + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth.token } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new ApiError('network', 0, 'Pas de connexion Internet. Réessaie.');
  }
  let j = null;
  try { j = await res.json(); } catch (e) { /* pas de corps JSON */ }
  if (!res.ok) {
    if (res.status === 401 && j && j.error === 'auth' && auth) onExpired();
    throw new ApiError((j && j.error) || 'http', res.status, (j && j.message) || 'Une erreur est survenue. Réessaie.');
  }
  return j;
}

export async function apiBlob(id) {
  const res = await fetch(API_BASE + '/api/files/' + id, { headers: { Authorization: 'Bearer ' + (auth && auth.token) } });
  if (!res.ok) throw new ApiError('file', res.status, 'Document introuvable.');
  return res.blob();
}

export async function downloadFile(id, name) {
  const b = await apiBlob(id);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name || 'document';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const FILE_LIMIT = 3 * 1024 * 1024;
export const FILE_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
export function readFile(file) {
  return new Promise((res, rej) => {
    if (file.size > FILE_LIMIT) { rej(new Error('Fichier trop lourd (3 Mo maximum).')); return; }
    const r = new FileReader();
    r.onload = () => res({ name: file.name, size: file.size, data: String(r.result).split(',')[1] || '' });
    r.onerror = () => rej(new Error('Lecture du fichier impossible.'));
    r.readAsDataURL(file);
  });
}
