// Client-side persistent player identity.
// Generates a UUID v4 on first call, persists in localStorage under 'agile.playerId'.
// Survives page refresh — server matches on this ID for rejoin.

const ID_KEY = 'agile.playerId';
const NAME_KEY = 'agile.playerName';

export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getPersistedPlayerName(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(NAME_KEY);
}

export function setPersistedPlayerName(name: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NAME_KEY, name);
}
