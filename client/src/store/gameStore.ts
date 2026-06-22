'use client';

import { create } from 'zustand';
import type { Player, Phase } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface RoomState {
  roomId: string | null;
  playerId: string | null;
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
  error: string | null;
  eventSource: EventSource | null;
  pollingInterval: ReturnType<typeof setInterval> | null;
}

interface GameStore extends RoomState {
  createRoom: (roomId: string, playerName: string) => Promise<void>;
  joinRoom: (roomId: string, playerName: string) => Promise<void>;
  startGame: () => Promise<void>;
  proposeTeam: (playerIds: string[]) => Promise<void>;
  voteTeam: (vote: 'agree' | 'reject') => Promise<void>;
  voteExecution: (vote: 'success' | 'fail') => Promise<void>;
  saboteurGuess: (guessedSmId: string) => Promise<void>;
  subscribeToRoom: () => void;
  unsubscribeFromRoom: () => void;
  clearError: () => void;
  setRoomFromResponse: (data: { room: any; playerId?: string; role?: string; isGood?: boolean; saboteurIds?: string[]; smId?: string }) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  roomId: null,
  playerId: null,
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
  error: null,
  eventSource: null,
  pollingInterval: null,

  setRoomFromResponse: (data) => {
    const { room, playerId, role, isGood, saboteurIds, smId } = data;

    set({
      players: room.players || [],
      phase: room.phase || null,
      currentSprint: room.currentSprint || 0,
      proposedTeam: room.proposedTeam || [],
      currentPO: room.currentPO !== undefined ? (room.players || [])[room.currentPO] : null,
      goodWins: room.goodWins || 0,
      badWins: room.badWins || 0,
      consecutiveDelays: room.consecutiveDelays || 0,
      techLeadPresent: room.techLeadPresent || false,
      ...(playerId && { playerId }),
      ...(role && { myRole: role }),
      ...(isGood !== undefined && { isGood }),
      ...(saboteurIds && { saboteurIds }),
      ...(smId && { smId }),
    });
  },

  createRoom: async (roomId: string, playerName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerName }),
      });

      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to create room' });
        return;
      }

      const data = await res.json();
      set({
        roomId: data.roomId,
        playerId: data.playerId,
      });
      get().setRoomFromResponse(data);
      get().subscribeToRoom();
    } catch (error) {
      set({ error: 'Network error' });
    }
  },

  joinRoom: async (roomId: string, playerName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      });

      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to join room' });
        return;
      }

      const data = await res.json();
      set({
        roomId,
        playerId: data.player.id,
      });
      get().setRoomFromResponse(data);
      get().subscribeToRoom();
    } catch (error) {
      set({ error: 'Network error' });
    }
  },

  startGame: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;

    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Failed to start game' });
        return;
      }

      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      set({ error: 'Network error' });
    }
  },

  proposeTeam: async (playerIds: string[]) => {
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
      set({ error: 'Network error' });
    }
  },

  voteTeam: async (vote: 'agree' | 'reject') => {
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
      set({ error: 'Network error' });
    }
  },

  voteExecution: async (vote: 'success' | 'fail') => {
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
      set({ error: 'Network error' });
    }
  },

  saboteurGuess: async (guessedSmId: string) => {
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
    } catch (error) {
      set({ error: 'Network error' });
    }
  },

  subscribeToRoom: () => {
    const { roomId, eventSource, pollingInterval } = get();
    if (!roomId) return;

    // Clean up existing connections
    get().unsubscribeFromRoom();

    // Try SSE first
    try {
      const es = new EventSource(`${API_URL}/api/rooms/${roomId}/stream`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.room) {
            get().setRoomFromResponse({ room: data.room });
          }
        } catch {}
      };
      es.onerror = () => {
        // SSE failed, fall back to polling
        es.close();
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
      };
      set({ eventSource: es });
    } catch {
      // Fall back to polling immediately
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
    }
  },

  unsubscribeFromRoom: () => {
    const { eventSource, pollingInterval } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null });
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },

  clearError: () => set({ error: null }),
}));
