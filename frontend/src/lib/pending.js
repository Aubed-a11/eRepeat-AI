/* Adresse en cours de validation (conservée si on recharge la page). */
const K = 'erepeat_pending';
export const getPending = () => { try { return JSON.parse(sessionStorage.getItem(K)) || null; } catch (e) { return null; } };
export const setPending = p => { try { if (p) sessionStorage.setItem(K, JSON.stringify(p)); else sessionStorage.removeItem(K); } catch (e) { /* rien */ } };
