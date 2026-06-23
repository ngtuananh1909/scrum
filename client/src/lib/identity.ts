// Client-side persistent player identity + optimistic room cache.
// Player UUID lives in localStorage (survives sessions).
// Room snapshot lives in sessionStorage (per-tab, instant reload hydration).

import type { Room } from './types';

const ID_KEY = 'agile.playerId';
const NAME_KEY = 'agile.playerName';
const ROOM_CACHE_PREFIX = 'agile.roomCache.';
const ROOM_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

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

// ===== Room snapshot cache (reload-instant hydration) =====

export interface CachedRoomSnapshot {
  room: Room;
  myRole: string | null;
  isGood: boolean;
  saboteurIds: string[];
  smId: string | null;
  baId: string | null;
  savedAt: number;
}

export function getCachedRoom(roomId: string): CachedRoomSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ROOM_CACHE_PREFIX + roomId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRoomSnapshot;
    if (Date.now() - (parsed.savedAt || 0) > ROOM_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(ROOM_CACHE_PREFIX + roomId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedRoom(roomId: string, snap: Omit<CachedRoomSnapshot, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedRoomSnapshot = { ...snap, savedAt: Date.now() };
    window.sessionStorage.setItem(ROOM_CACHE_PREFIX + roomId, JSON.stringify(payload));
  } catch {
    // sessionStorage quota / serialization — non-fatal
  }
}

export function clearCachedRoom(roomId: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ROOM_CACHE_PREFIX + roomId);
}
