'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player, Phase, ChatMessage, Room } from '@/lib/types';
import { getOrCreatePlayerId } from '@/lib/identity';
import { getSupabase } from '@/lib/supabaseBrowser';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface RoomState {
  roomId: string | null;
  playerId: string | null;
  playerName: string | null;
  players: Player[];
  phase: Phase | null;
  currentSprint: number;
  proposedTeam: string[];
  currentPO: Player | null;
  myRole: string | null;
  isGood: boolean;
  saboteurIds: string[];
  smId: string | null;
  goodWins: number;
  badWins: number;
  consecutiveDelays: number;
  techLeadPresent: boolean;
  qcBugged: boolean;
  messages: ChatMessage[];
  error: string | null;
  realtimeChannel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null;
  pollingInterval: ReturnType<typeof setInterval> | null;
  showRoleReveal: boolean;
  gameStarted: boolean; // set once when game starts, persists across reconnections
}

interface GameStore extends RoomState {
  ensurePlayerId: () => string;
  createRoom: (roomId: string, playerName: string) => Promise<void>;
  joinRoom: (roomId: string, playerName: string) => Promise<void>;
  rejoinRoom: (roomId: string) => Promise<void>;
  startGame: (roles?: string[]) => Promise<void>;
  proposeTeam: (playerIds: string[]) => Promise<void>;
  voteTeam: (vote: 'agree' | 'reject') => Promise<void>;
  voteExecution: (vote: 'success' | 'fail') => Promise<void>;
  saboteurGuess: (guessedSmId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  subscribeToRoom: () => void;
  unsubscribeFromRoom: () => void;
  startPollingFallback: () => void;
  stopPollingFallback: () => void;
  clearError: () => void;
  closeRoleReveal: () => void;
  resetRoleReveal: () => Promise<void>;
  setRoomFromResponse: (data: {
    room: Room;
    playerId?: string;
    role?: string;
    isGood?: boolean;
    saboteurIds?: string[];
    smId?: string | null;
  }) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      roomId: null,
      playerId: null,
      playerName: null,
      players: [],
      phase: null,
      currentSprint: 0,
      proposedTeam: [],
      currentPO: null,
      myRole: null,
      isGood: true,
      saboteurIds: [],
      smId: null,
      goodWins: 0,
      badWins: 0,
      consecutiveDelays: 0,
      techLeadPresent: false,
      qcBugged: false,
      messages: [],
      error: null,
      realtimeChannel: null,
      pollingInterval: null,
      showRoleReveal: false,
      gameStarted: false,

  ensurePlayerId: () => {
    let id = get().playerId;
    if (!id) {
      id = getOrCreatePlayerId();
      set({ playerId: id });
    }
    return id;
  },

  setRoomFromResponse: (data) => {
    const { room, playerId, role, isGood, saboteurIds, smId } = data;
    // Look up own role from room.players if not provided in response (non-host players)
    const myPlayerId = playerId || get().playerId;
    const ownPlayer = myPlayerId ? (room.players || []).find(p => p.id === myPlayerId) : null;
    const resolvedRole = role || ownPlayer?.role || null;
    const resolvedIsGood = isGood !== undefined ? isGood : (resolvedRole ? !['Người trễ task', 'QC cẩu thả'].includes(resolvedRole) : undefined);
    const wasNotStarted = !get().gameStarted;
    const isPlanning = room.phase === 'planning';
    const hasRole = !!resolvedRole;
    set({
      players: room.players || [],
      phase: room.phase || null,
      currentSprint: room.currentSprint ?? 0,
      proposedTeam: room.proposedTeam || [],
      currentPO:
        typeof room.currentPO === 'number'
          ? (room.players || [])[room.currentPO] || null
          : null,
      goodWins: room.goodWins ?? 0,
      badWins: room.badWins ?? 0,
      consecutiveDelays: room.consecutiveDelays ?? 0,
      techLeadPresent: room.techLeadPresent ?? false,
      qcBugged: room.qcBugged ?? false,
      ...(playerId ? { playerId } : {}),
      ...(resolvedRole ? { myRole: resolvedRole } : {}),
      ...(resolvedIsGood !== undefined ? { isGood: resolvedIsGood } : {}),
      ...(saboteurIds ? { saboteurIds } : {}),
      ...(smId ? { smId } : {}),
      ...(wasNotStarted && isPlanning && hasRole && !get().showRoleReveal ? { showRoleReveal: true, gameStarted: true } : {}),
    });
  },

  createRoom: async (roomId, playerName) => {
    const playerId = get().ensurePlayerId();
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerName, playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to create room' });
        return;
      }
      const data = await res.json();
      set({ roomId: data.roomId, playerId: data.playerId, playerName, gameStarted: false, showRoleReveal: false });
	      get().setRoomFromResponse(data);
      get().subscribeToRoom();
    } catch (error) {
      console.error('[createRoom]', error);
      set({ error: 'Network error' });
    }
  },

  joinRoom: async (roomId, playerName) => {
    const playerId = get().ensurePlayerId();
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to join room' });
        return;
      }
      const data = await res.json();
      set({ roomId, playerId: data.player.id, playerName, gameStarted: false, showRoleReveal: false });
      get().setRoomFromResponse(data);
      get().subscribeToRoom();
    } catch (error) {
      console.error('[joinRoom]', error);
      set({ error: 'Network error' });
    }
  },

  // Called when URL has a roomId but store doesn't — refresh / shared link.
  // POSTs /join with the persisted playerId; server matches on UUID and returns the existing player.
  rejoinRoom: async (roomId) => {
    const playerId = get().ensurePlayerId();
    const playerName = get().playerName || 'Player';
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Cannot rejoin room' });
        return;
      }
      const data = await res.json();
      set({ roomId, playerId: data.player.id, playerName, gameStarted: false, showRoleReveal: false });
      get().setRoomFromResponse(data);
      get().subscribeToRoom();
    } catch (error) {
      console.error('[rejoinRoom]', error);
      set({ error: 'Network error' });
    }
  },

  startGame: async (roles?: string[]) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, roles }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to start game' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[startGame]', error);
      set({ error: 'Network error' });
    }
  },

  proposeTeam: async (playerIds) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to propose team' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[proposeTeam]', error);
      set({ error: 'Network error' });
    }
  },

  voteTeam: async (vote) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/vote-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, vote }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to vote' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[voteTeam]', error);
      set({ error: 'Network error' });
    }
  },

  voteExecution: async (vote) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/vote-execution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, vote }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to vote' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[voteExecution]', error);
      set({ error: 'Network error' });
    }
  },

  saboteurGuess: async (guessedSmId) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/saboteur-guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, guessedSmId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to guess' });
        return;
      }
      const data = await res.json();
      set({ phase: 'ended' });
      // winner info returned but UI infers from score; could be surfaced later
      console.log('[saboteurGuess]', data);
    } catch (error) {
      console.error('[saboteurGuess]', error);
      set({ error: 'Network error' });
    }
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { roomId, playerId, playerName } = get();
    if (!roomId || !playerId || !playerName) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerName, text: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to send message' });
      }
    } catch (error) {
      console.error('[sendMessage]', error);
      set({ error: 'Network error' });
    }
  },

  // Realtime subscription. Listens for rooms UPDATE and messages INSERT filtered by roomId.
  // On CHANNEL_ERROR / TIMED_OUT / CLOSED, falls back to 2s polling.
  subscribeToRoom: () => {
    const { roomId, realtimeChannel, pollingInterval } = get();
    if (!roomId) return;

    get().unsubscribeFromRoom();

    const supabase = getSupabase();

    // Backfill messages first so Realtime just appends new ones.
    fetch(`${API_URL}/api/rooms/${roomId}/chat`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => set({ messages: data.messages || [] }))
      .catch(() => {});

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const room = (payload.new as { state: Room }).state;
          get().setRoomFromResponse({ room });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          set((s) => (s.messages.find((m) => m.id === msg.id) ? s : { messages: [...s.messages, msg] }));
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[realtime] falling back to polling:', status);
          get().startPollingFallback();
        }
      });

    set({ realtimeChannel: channel });
    // Keep pollingInterval typed value to satisfy linter; real fallback starts on error above.
    void pollingInterval;
  },

  startPollingFallback: () => {
    get().stopPollingFallback();
    const interval = setInterval(async () => {
      const { roomId } = get();
      if (!roomId) return;
      try {
        const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
        if (res.ok) {
          const data = await res.json();
          get().setRoomFromResponse(data);
        }
      } catch {}
    }, 2000);
    set({ pollingInterval: interval });
  },

  stopPollingFallback: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },

  unsubscribeFromRoom: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      getSupabase().removeChannel(realtimeChannel);
      set({ realtimeChannel: null });
    }
    get().stopPollingFallback();
  },

  clearError: () => set({ error: null }),

  closeRoleReveal: () => {
    set({ showRoleReveal: false });
    get().resetRoleReveal();
  },

  resetRoleReveal: async () => {
    const { roomId } = get();
    if (!roomId) return;
    try {
      await fetch(`${API_URL}/api/rooms/${roomId}/reset-role-reveal`, { method: 'POST' });
    } catch (_e) {
      // non-critical, ignore
    }
  },
  {
    name: 'agile-werewolf-store',
    partialize: (state) => ({
      playerId: state.playerId,
      playerName: state.playerName,
    }),
  }
);
