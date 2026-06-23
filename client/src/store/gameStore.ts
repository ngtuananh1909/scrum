'use client';

import { create } from 'zustand';
import type {
  Player,
  Phase,
  ChatMessage,
  Room,
  RoleConfig,
  PlayerRole,
  SprintHistoryEntry,
} from '@/lib/types';
import {
  getOrCreatePlayerId,
  getPersistedPlayerName,
  setPersistedPlayerName,
  getCachedRoom,
  setCachedRoom,
  clearCachedRoom,
} from '@/lib/identity';
import { getSupabase } from '@/lib/supabaseBrowser';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface PrivateSkillResults {
  baCheck: 'Yes' | 'No' | null;
  daCheck: { result: 'success' | 'fail'; targetId: string } | null;
}

export interface VoteAck {
  phase: 'teamVoting' | 'execution';
  vote: 'agree' | 'reject' | 'success' | 'fail';
  at: number;
}

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
  baId: string | null;
  clientId: string | null;
  goodWins: number;
  badWins: number;
  consecutiveDelays: number;
  techLeadPresent: boolean;

  // Skill / silencing state
  pmOverrideUsed: boolean;
  dataAnalystCheckUsed: boolean;
  businessAnalystCheckUsed: boolean;
  qcRedoUsed: boolean;
  sepSilencedPlayerId: string | null;
  deadlineSilenced: boolean;
  ttsFollowTargetId: string | null;
  techDebtActive: boolean;
  pmDeferredThisSprint: boolean;
  prevSprintTeam: string[];
  prevExecutionVotes: Record<string, 'success' | 'fail' | 'agree' | 'reject'>;
  prevSprintIndex: number;

  // New phase-flow state
  sprintHistory: SprintHistoryEntry[];
  phaseStartedAt: number | null;
  phaseDeadlineAt: number | null;
  poSelectDeadlineAt: number | null;
  phaseRemainingMs: number;

  // Derived
  isSilenced: boolean;

  // Lobby
  roleConfig: RoleConfig;

  // Ephemeral private skill results (never sync'd)
  privateSkillResults: PrivateSkillResults;

  // Vote feedback (ephemeral)
  voteAck: VoteAck | null;

  messages: ChatMessage[];
  error: string | null;
  realtimeChannel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null;
  pollingInterval: ReturnType<typeof setInterval> | null;
  tickInterval: ReturnType<typeof setInterval> | null;
  showRoleReveal: boolean;
  gameStarted: boolean;
  nightZeroSeen: boolean;
}

interface GameStore extends RoomState {
  ensurePlayerId: () => string;
  hydrateFromCache: (roomId: string) => void;
  createRoom: (roomId: string, playerName: string) => Promise<void>;
  joinRoom: (roomId: string, playerName: string) => Promise<void>;
  rejoinRoom: (roomId: string) => Promise<void>;
  startGame: (roles?: string[]) => Promise<void>;
  proposeTeam: (playerIds: string[]) => Promise<void>;
  voteTeam: (vote: 'agree' | 'reject') => Promise<void>;
  voteExecution: (vote: 'success' | 'fail') => Promise<void>;
  advanceToPlanning: () => Promise<void>;
  saboteurGuess: (guessedSmId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;

  // Skill actions
  nightZeroComplete: (ttsTargetId: string | null) => Promise<void>;
  nightAdvance: () => Promise<void>;
  pmOverride: (playerIds: string[]) => Promise<void>;
  pmDefer: () => Promise<void>;
  businessAnalystCheck: (targetIds: [string, string]) => Promise<'Yes' | 'No' | null>;
  qcRedo: () => Promise<void>;
  dataAnalystCheck: (targetId: string) => Promise<'success' | 'fail' | null>;
  sepSilence: (targetId: string) => Promise<void>;
  deadlineSilence: () => Promise<void>;

  // Auto-advance (called by tick interval)
  autoAdvance: () => Promise<void>;
  startTickInterval: () => void;
  stopTickInterval: () => void;

  // UI / cache
  setRoleConfig: (cfg: RoleConfig) => void;
  setNightZeroSeen: (v: boolean) => void;
  setVoteAck: (ack: VoteAck | null) => void;
  clearPrivateBaResult: () => void;
  clearPrivateDaResult: () => void;

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
    baId?: string | null;
    clientId?: string | null;
  }) => void;
}

const initialRoleConfig: RoleConfig = { counts: {} };

const initialPrivate: PrivateSkillResults = { baCheck: null, daCheck: null };

export const useGameStore = create<GameStore>((set, get) => ({
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
  baId: null,
  clientId: null,
  goodWins: 0,
  badWins: 0,
  consecutiveDelays: 0,
  techLeadPresent: false,

  pmOverrideUsed: false,
  dataAnalystCheckUsed: false,
  businessAnalystCheckUsed: false,
  qcRedoUsed: false,
  sepSilencedPlayerId: null,
  deadlineSilenced: false,
  ttsFollowTargetId: null,
  techDebtActive: false,
  pmDeferredThisSprint: false,
  prevSprintTeam: [],
  prevExecutionVotes: {},
  prevSprintIndex: -1,

  sprintHistory: [],
  phaseStartedAt: null,
  phaseDeadlineAt: null,
  poSelectDeadlineAt: null,
  phaseRemainingMs: 0,

  isSilenced: false,
  roleConfig: initialRoleConfig,
  privateSkillResults: { ...initialPrivate },
  voteAck: null,

  messages: [],
  error: null,
  realtimeChannel: null,
  pollingInterval: null,
  tickInterval: null,
  showRoleReveal: false,
  gameStarted: false,
  nightZeroSeen: false,

  ensurePlayerId: () => {
    let id = get().playerId;
    if (!id) {
      id = getOrCreatePlayerId();
      set({ playerId: id });
    }
    return id;
  },

  // Optimistic hydration from sessionStorage. Called on page mount before /join fires
  // so the user sees their last-known state instantly instead of a permanent spinner.
  hydrateFromCache: (roomId) => {
    const cached = getCachedRoom(roomId);
    if (!cached) return;
    set({
      roomId,
      myRole: cached.myRole,
      isGood: cached.isGood,
      saboteurIds: cached.saboteurIds,
      smId: cached.smId,
      baId: cached.baId,
      gameStarted: cached.room.phase !== 'lobby' && cached.room.phase !== 'night',
      nightZeroSeen: cached.room.phase !== 'night',
    });
    get().setRoomFromResponse({ room: cached.room });
  },

  setRoomFromResponse: (data) => {
    const { room, playerId, role, isGood, saboteurIds, smId, baId, clientId } = data;
    const myPlayerId = playerId || get().playerId;
    const ownPlayer = myPlayerId ? (room.players || []).find((p) => p.id === myPlayerId) : null;
    const resolvedRole = role || ownPlayer?.role || get().myRole || null;
    const resolvedIsGood =
      isGood !== undefined
        ? isGood
        : resolvedRole
        ? !['Người trễ task', 'Client', 'Ông sếp khó ưa', 'Kẻ fake CV', 'QC cẩu thả', 'Deadline', 'Technical Debt'].includes(resolvedRole)
        : undefined;

    const wasNotStarted = !get().gameStarted;
    const isPostLobby = room.phase !== 'lobby';
    const hasRole = !!resolvedRole;
    const currentPlayerId = playerId || get().playerId;
    const derivedSilenced =
      Boolean(room.deadlineSilenced) ||
      (currentPlayerId !== null && room.sepSilencedPlayerId === currentPlayerId);

    // Clear vote ack when phase changes away from voting.
    const previousPhase = get().phase;
    const newPhase = room.phase || null;
    let voteAck = get().voteAck;
    if (
      voteAck &&
      ((voteAck.phase === 'teamVoting' && newPhase !== 'teamVoting') ||
        (voteAck.phase === 'execution' && newPhase !== 'execution'))
    ) {
      voteAck = null;
    }

    // Clear nightZeroSeen when entering a new night (so overlay shows again).
    let nightZeroSeen = get().nightZeroSeen;
    if (newPhase !== 'night') nightZeroSeen = true;

    set({
      players: room.players || [],
      phase: newPhase,
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

      pmOverrideUsed: room.pmOverrideUsed ?? false,
      dataAnalystCheckUsed: room.dataAnalystCheckUsed ?? false,
      businessAnalystCheckUsed: room.businessAnalystCheckUsed ?? false,
      qcRedoUsed: room.qcRedoUsed ?? false,
      sepSilencedPlayerId: room.sepSilencedPlayerId ?? null,
      deadlineSilenced: room.deadlineSilenced ?? false,
      ttsFollowTargetId: room.ttsFollowTargetId ?? null,
      techDebtActive: room.techDebtActive ?? false,
      pmDeferredThisSprint: room.pmDeferredThisSprint ?? false,
      prevSprintTeam: room.prevSprintTeam ?? [],
      prevExecutionVotes: (room.prevExecutionVotes ?? {}) as Record<string, 'success' | 'fail'>,
      prevSprintIndex: room.prevSprintIndex ?? -1,

      sprintHistory: room.sprintHistory ?? [],
      phaseStartedAt: room.phaseStartedAt ?? null,
      phaseDeadlineAt: room.phaseDeadlineAt ?? null,
      poSelectDeadlineAt: room.poSelectDeadlineAt ?? null,

      isSilenced: derivedSilenced,
      voteAck,
      nightZeroSeen,

      ...(playerId ? { playerId } : {}),
      ...(resolvedRole ? { myRole: resolvedRole } : {}),
      ...(resolvedIsGood !== undefined ? { isGood: resolvedIsGood } : {}),
      ...(saboteurIds ? { saboteurIds } : {}),
      ...(smId !== undefined ? { smId } : {}),
      ...(baId !== undefined ? { baId } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
      ...(wasNotStarted && isPostLobby && hasRole && !get().showRoleReveal && previousPhase === null
        ? { showRoleReveal: true, gameStarted: true }
        : {}),
    });

    // Write-through cache for instant reload hydration.
    const after = get();
    if (room.id) {
      setCachedRoom(room.id, {
        room,
        myRole: after.myRole,
        isGood: after.isGood,
        saboteurIds: after.saboteurIds,
        smId: after.smId,
        baId: after.baId,
      });
    }
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
      set({
        roomId: data.roomId,
        playerId: data.playerId,
        playerName,
        gameStarted: false,
        showRoleReveal: false,
        nightZeroSeen: false,
      });
      setPersistedPlayerName(playerName);
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
      set({
        roomId,
        playerId: data.player.id,
        playerName,
        gameStarted: false,
        showRoleReveal: false,
        nightZeroSeen: false,
      });
      setPersistedPlayerName(playerName);
      get().setRoomFromResponse(data);
      get().subscribeToRoom();
    } catch (error) {
      console.error('[joinRoom]', error);
      set({ error: 'Network error' });
    }
  },

  // Called when URL has a roomId but store doesn't — refresh / shared link.
  // POSTs /join with the persisted playerId; server matches on UUID. Does NOT block
  // initial render; cache hydration runs in parallel via hydrateFromCache.
  rejoinRoom: async (roomId) => {
    const playerId = get().ensurePlayerId();
    const playerName = getPersistedPlayerName() || get().playerName || 'Player';
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        // If no cache and rejoin fails, surface error.
        const haveCache = !!get().phase;
        if (!haveCache) {
          set({ error: data.error || 'Cannot rejoin room' });
        }
        return;
      }
      const data = await res.json();
      set({
        roomId,
        playerId: data.player.id,
        playerName,
        // Don't reset gameStarted/nightZeroSeen here — preserve from cache.
      });
      setPersistedPlayerName(playerName);
      get().setRoomFromResponse(data);
      get().subscribeToRoom();
    } catch (error) {
      console.error('[rejoinRoom]', error);
      const haveCache = !!get().phase;
      if (!haveCache) {
        set({ error: 'Network error' });
      }
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
    // Optimistic vote feedback so the UI shows "Đã chọn" immediately.
    set({ voteAck: { phase: 'teamVoting', vote, at: Date.now() } });
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
    set({ voteAck: { phase: 'execution', vote, at: Date.now() } });
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

  advanceToPlanning: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[advanceToPlanning]', error);
    }
  },

  nightAdvance: async () => {
    const { roomId, playerId } = get();
    if (!roomId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/night-advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerId ?? '' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[nightAdvance]', error);
    }
  },

  pmDefer: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-pm-defer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[pmDefer]', error);
    }
  },

  autoAdvance: async () => {
    const { roomId } = get();
    if (!roomId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/auto-advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return;
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[autoAdvance]', error);
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
      if (data.room) get().setRoomFromResponse({ room: data.room });
      else set({ phase: 'ended' });
    } catch (error) {
      console.error('[saboteurGuess]', error);
      set({ error: 'Network error' });
    }
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { roomId, playerId, playerName, isSilenced } = get();
    if (!roomId || !playerId || !playerName) return;
    if (isSilenced) return;
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

  // ===== Skill actions =====

  nightZeroComplete: async (ttsTargetId) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-night-zero`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, ttsTargetId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Cannot complete night zero' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
      set({ nightZeroSeen: true });
    } catch (error) {
      console.error('[nightZeroComplete]', error);
      set({ error: 'Network error' });
    }
  },

  pmOverride: async (playerIds) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-pm-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'PM override failed' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[pmOverride]', error);
      set({ error: 'Network error' });
    }
  },

  businessAnalystCheck: async (targetIds) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return null;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-ba-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, targetIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'BA check failed' });
        return null;
      }
      const data = await res.json();
      get().setRoomFromResponse({ room: data.room });
      set({ privateSkillResults: { ...get().privateSkillResults, baCheck: data.result } });
      return data.result as 'Yes' | 'No';
    } catch (error) {
      console.error('[businessAnalystCheck]', error);
      set({ error: 'Network error' });
      return null;
    }
  },

  qcRedo: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-qc-redo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'QC redo failed' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[qcRedo]', error);
      set({ error: 'Network error' });
    }
  },

  dataAnalystCheck: async (targetId) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return null;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-da-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, targetId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'DA check failed' });
        return null;
      }
      const data = await res.json();
      get().setRoomFromResponse({ room: data.room });
      set({
        privateSkillResults: {
          ...get().privateSkillResults,
          daCheck: { result: data.result, targetId: data.targetId },
        },
      });
      return data.result as 'success' | 'fail';
    } catch (error) {
      console.error('[dataAnalystCheck]', error);
      set({ error: 'Network error' });
      return null;
    }
  },

  sepSilence: async (targetId) => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-sep-silence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, targetId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Silence failed' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[sepSilence]', error);
      set({ error: 'Network error' });
    }
  },

  deadlineSilence: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/skill-deadline-silence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || 'Deadline silence failed' });
        return;
      }
      const data = await res.json();
      get().setRoomFromResponse(data);
    } catch (error) {
      console.error('[deadlineSilence]', error);
      set({ error: 'Network error' });
    }
  },

  setRoleConfig: (cfg) => set({ roleConfig: cfg }),
  setNightZeroSeen: (v) => set({ nightZeroSeen: v }),
  setVoteAck: (ack) => set({ voteAck: ack }),
  clearPrivateBaResult: () =>
    set({ privateSkillResults: { ...get().privateSkillResults, baCheck: null } }),
  clearPrivateDaResult: () =>
    set({ privateSkillResults: { ...get().privateSkillResults, daCheck: null } }),

  // ===== Tick interval: countdown + auto-advance when phase deadline expires =====
  startTickInterval: () => {
    get().stopTickInterval();
    const interval = setInterval(() => {
      const { phaseDeadlineAt, phase, voteAck, autoAdvance } = get();
      const now = Date.now();
      const remaining = phaseDeadlineAt ? Math.max(0, phaseDeadlineAt - now) : 0;
      // Only update if changed enough to avoid render churn (250ms granularity).
      const prevRemaining = get().phaseRemainingMs;
      if (Math.abs(prevRemaining - remaining) > 200 || (remaining === 0 && prevRemaining !== 0)) {
        set({ phaseRemainingMs: remaining });
      }
      // Clear vote ack after 1500ms.
      if (voteAck && now - voteAck.at > 1500) {
        set({ voteAck: null });
      }
      // Auto-advance when timer hits 0 (and we haven't already advanced).
      if (phaseDeadlineAt && now >= phaseDeadlineAt) {
        if (['night', 'teamVoting', 'execution', 'sprintResult', 'discussion'].includes(phase ?? '')) {
          // Fire and forget — server will push new state via realtime.
          autoAdvance();
        } else if (phase === 'planning' && get().poSelectDeadlineAt && now >= get().poSelectDeadlineAt!) {
          autoAdvance();
        }
      }
    }, 500);
    set({ tickInterval: interval });
  },

  stopTickInterval: () => {
    const { tickInterval } = get();
    if (tickInterval) {
      clearInterval(tickInterval);
      set({ tickInterval: null });
    }
  },

  // Realtime subscription. Listens for rooms UPDATE and messages INSERT filtered by roomId.
  subscribeToRoom: () => {
    const { roomId } = get();
    if (!roomId) return;

    get().unsubscribeFromRoom();

    const supabase = getSupabase();

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
          set((s) =>
            s.messages.find((m) => m.id === msg.id) ? s : { messages: [...s.messages, msg] }
          );
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[realtime] falling back to polling:', status);
          get().startPollingFallback();
        }
      });

    set({ realtimeChannel: channel });
    get().startTickInterval();
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
    get().stopTickInterval();
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
    } catch {
      // no-op
    }
  },
}));

// Re-export for components that want to clear cache after game end.
export { clearCachedRoom };
export type { PlayerRole };
