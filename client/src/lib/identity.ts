// Display name is a convenience only; Supabase Anonymous Auth owns identity.
const NAME_KEY = 'agile.playerName';

export function getPersistedPlayerName(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(NAME_KEY);
}

export function setPersistedPlayerName(name: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NAME_KEY, name);
}
