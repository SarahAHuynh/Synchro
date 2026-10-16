export type PendingInvitation = { id: string; token: string; expires: number };
const storageKey = 'synchro-pending-invitation';
export function readInvitation(): PendingInvitation | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (value && typeof value.id === 'string' && /^[a-f0-9-]{36}$/i.test(value.id) && typeof value.token === 'string' && (value.token === '' || /^[a-f0-9]{64}$/.test(value.token)) && value.expires > Date.now()) return value;
  } catch { /* Storage can be disabled; the current URL still works. */ }
  return null;
}
export function saveInvitation(id: string, token = '') {
  const value = { id, token, expires: Date.now() + 7 * 86400000 };
  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Retain in component state instead. */ }
  return value;
}
export function clearInvitation(id: string) {
  try { if (readInvitation()?.id === id) localStorage.removeItem(storageKey); } catch { /* No storage available. */ }
}
