// Client-side persistent player identity.
// Generates a UUID v4 on first call, persists in localStorage under 'agile.playerId'.
// Survives page refresh — server matches on this ID for rejoin.

const KEY = 'agile.playerId';

export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
