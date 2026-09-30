'use client';

import { create } from 'zustand';
import type {
  EndGameProjection,
  ExecutionVote,
  Faction,
  GameEvent,
  GamePhase,
  GameRole,
  PrivateEffect,
  PublicGameState,
  SprintRecord,
  TeamVote,
  ViewerPrivateState,
} from '@/game';
import type { PlayerRole, RoleConfig } from '@/lib/types';
import { getPersistedPlayerName, setPersistedPlayerName } from '@/lib/identity';
import {
  authenticatedFetch,
  ensureBrowserSession,
  subscribeToBrowserAuth,
} from '@/lib/browserAuth';
import {
  getSupabase,
  registerRoomRealtimeHandlers,
  type RoomRealtimePayload,
} from '@/lib/supabaseBrowser';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type LobbyPreset = 'beginner' | 'classic' | 'advanced' | 'chaos' | 'custom';
export type CommunicationMode = 'remote' | 'inPerson';
export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';
export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  presence: 'online' | 'away';
  isSpectator: boolean;
}

export interface LobbyPublicState {
  id: string;
  phase: 'lobby';
  phaseVersion: number;
  revision: number;
  locked: boolean;
  hostPlayerId: string;
  players: LobbyPlayer[];
  settings: { communicationMode: CommunicationMode; spectatorsEnabled?: boolean };
  rolePreview: { preset: LobbyPreset; roles: GameRole[]; seed: string } | null;
  rematch: { proposedBy: string; readyPlayerIds: string[] } | null;
}

export type PublicRoomState = LobbyPublicState | (PublicGameState & {
  hostPlayerId: string;
  settings?: { communicationMode: CommunicationMode };
  rematch?: { proposedBy: string; readyPlayerIds: string[] };
});

export interface ViewerSeat {
  id: string;
  displayName: string;
  ready: boolean;
  isSpectator: boolean;
}

export interface RoomSnapshot {
  room: PublicRoomState;
  private: ViewerPrivateState | null;
  player: ViewerSeat;
  serverNow: number;
}

export interface RoomMessage {
  sequence: number;
  roomId: string;
  audience: 'public' | 'bad';
  senderPlayerId: string;
  text: string;
  createdAt: string;
}

export interface PrivateSkillResults {
  baCheck: 'Yes' | 'No' | null;
  daCheck: { result: ExecutionVote; targetId: string } | null;
}

export interface VoteAck {
  phase: 'teamVoting' | 'execution';
  vote: TeamVote | ExecutionVote | 'agree';
  at: number;
}

export interface StorePlayer {
  id: string;
  name: string;
  ready?: boolean;
  presence?: 'online' | 'away';
  isSpectator?: boolean;
}

export interface CommandRequest {
  commandId: string;
  expectedPhaseVersion: number;
  type: string;
  [key: string]: unknown;
}

/** Build a flat server command. Actor identity is always derived from the bearer token. */
export function createCommandRequest<T extends string, F extends Record<string, unknown>>(
  expectedPhaseVersion: number,
  type: T,
  fields: F
): CommandRequest & Omit<F, 'actorId' | 'playerId' | 'authUserId' | 'commandId' | 'expectedPhaseVersion' | 'type'> {
  const safeFields = { ...fields } as Record<string, unknown>;
  delete safeFields.actorId;
  delete safeFields.playerId;
  delete safeFields.authUserId;
  delete safeFields.commandId;
  delete safeFields.expectedPhaseVersion;
  delete safeFields.type;

  return {
    ...safeFields,
    commandId: globalThis.crypto.randomUUID(),
    expectedPhaseVersion,
    type,
  } as unknown as CommandRequest & Omit<F, 'actorId' | 'playerId' | 'authUserId' | 'commandId' | 'expectedPhaseVersion' | 'type'>;
}

export function mergeRoomMessages(existing: RoomMessage[], incoming: RoomMessage[]): RoomMessage[] {
  const bySequence = new Map(existing.map((message) => [message.sequence, message]));
  for (const message of incoming) bySequence.set(message.sequence, message);
  return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
}

interface GameStore {
  roomId: string | null;
  publicState: PublicRoomState | null;
  privateState: ViewerPrivateState | null;
  endReveal: EndGameProjection | null;
  playerId: string | null;
  playerName: string | null;
  playerReady: boolean;
  isSpectator: boolean;
  isHost: boolean;
  players: StorePlayer[];
  phase: 'lobby' | GamePhase | null;
  phaseVersion: number;
  revision: number;
  currentSprint: number;
  requiredTeamSize: number;
  proposedTeam: string[];
  currentPO: StorePlayer | null;
  myRole: GameRole | null;
  faction: Faction | null;
  isGood: boolean;
  knownRoles: Array<{ playerId: string; role: GameRole }>;
  saboteurIds: string[];
  smId: string | null;
  baId: string | null;
  clientId: string | null;
  allowedActions: string[];
  goodWins: number;
  badWins: number;
  rejectedTeams: number;
  consecutiveDelays: number;
  teamVoteSubmittedPlayerIds: string[];
  teamVotePendingPlayerIds: string[];
  teamVoteRevealVotes: Record<string, TeamVote>;
  votes: Record<string, TeamVote>;
  executionSubmittedCount: number;
  executionReveal: PublicGameState['executionReveal'];
  winner: PublicGameState['winner'];
  endReason: PublicGameState['endReason'];
  chatPolicy: PublicGameState['chatPolicy'];
  isSilenced: boolean;
  deadlineSilenced: boolean;
  sepSilencedPlayerId: string | null;
  ttsFollowTargetId: string | null;
  pmOverrideUsed: boolean;
  dataAnalystCheckUsed: boolean;
  businessAnalystCheckUsed: boolean;
  qcRedoUsed: boolean;
  techDebtActive: boolean;
  pmDeferredThisSprint: boolean;
  techLeadPresent: boolean;
  prevSprintTeam: string[];
  prevExecutionVotes: Record<string, ExecutionVote>;
  prevSprintIndex: number;
  discussionAdvanceVotes: string[];
  sprintHistory: SprintRecord[];
  publicEvents: GameEvent[];
  gameLog: GameEvent[];
  phaseStartedAt: number | null;
  phaseDeadlineAt: number | null;
  poSelectDeadlineAt: number | null;
  phaseRemainingMs: number;
  rolePreset: LobbyPreset | null;
  roleConfig: RoleConfig;
  roomSettings: LobbyPublicState['settings'] | null;
  roomLocked: boolean;
  rematch: LobbyPublicState['rematch'];
  canUseBadFactionChat: boolean;
  privateSkillResults: PrivateSkillResults;
  voteAck: VoteAck | null;
  messages: RoomMessage[];
  badMessages: RoomMessage[];
  authStatus: AuthStatus;
  connectionStatus: ConnectionStatus;
  error: string | null;
  realtimeChannel: RealtimeChannel | null;
  pollingInterval: ReturnType<typeof setInterval> | null;
  presenceHeartbeatInterval: ReturnType<typeof setInterval> | null;
  tickInterval: ReturnType<typeof setInterval> | null;
  showRoleReveal: boolean;
  roleRevealAcknowledgedVersion: number | null;
  gameStarted: boolean;
  nightZeroSeen: boolean;
  authUnsubscribe: (() => void) | null;

  createRoom: (roomId: string, playerName: string) => Promise<void>;
  joinRoom: (roomId: string, playerName: string, options?: { spectator?: boolean }) => Promise<void>;
  rejoinRoom: (roomId: string) => Promise<void>;
  setRoomFromResponse: (data: Partial<RoomSnapshot> & { room: PublicRoomState }) => void;
  refreshRoom: () => Promise<void>;
  fetchEndReveal: () => Promise<void>;

  startGame: (roles?: GameRole[]) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  setRoomLocked: (locked: boolean) => Promise<void>;
  kickPlayer: (targetPlayerId: string) => Promise<void>;
  transferHost: (targetPlayerId: string) => Promise<void>;
  setRoomSettings: (settings: { communicationMode: CommunicationMode; spectatorsEnabled?: boolean }) => Promise<void>;
  setRolePreset: (preset: LobbyPreset, roles?: GameRole[]) => Promise<void>;
  rerollRolePreset: () => Promise<void>;
  proposeRematch: () => Promise<void>;
  startRematch: () => Promise<void>;

  proposeTeam: (playerIds: string[]) => Promise<void>;
  voteTeam: (vote: TeamVote | 'agree') => Promise<void>;
  voteExecution: (vote: ExecutionVote) => Promise<void>;
  advanceToPlanning: () => Promise<void>;
  advanceFromDiscussion: () => Promise<void>;
  saboteurGuess: (guessedSmId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendBadMessage: (text: string) => Promise<void>;
  sendReaction: (emoji: '🤨' | '😂' | '💀' | '🔥' | '👀' | '🤡', targetType: 'player' | 'proposal' | 'sprintResult', targetPlayerId?: string) => Promise<void>;

  nightZeroComplete: (ttsTargetId: string | null) => Promise<void>;
  nightAdvance: () => Promise<void>;
  pmOverride: (playerIds: string[]) => Promise<void>;
  pmDefer: () => Promise<void>;
  businessAnalystCheck: (targetIds: [string, string]) => Promise<'Yes' | 'No' | null>;
  qcRedo: () => Promise<void>;
  dataAnalystCheck: (targetId: string) => Promise<ExecutionVote | null>;
  sepSilence: (targetId: string) => Promise<void>;
  deadlineSilence: () => Promise<void>;

  autoAdvance: () => Promise<void>;
  startTickInterval: () => void;
  stopTickInterval: () => void;
  setRoleConfig: (cfg: RoleConfig) => void;
  setNightZeroSeen: (value: boolean) => void;
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
  resetRoom: () => Promise<void>;
  leaveRoom: () => void;
}

const initialRoleConfig: RoleConfig = { counts: {} };
const initialPrivateResults: PrivateSkillResults = { baCheck: null, daCheck: null };
const PRESENCE_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 2_000;
const TICK_INTERVAL_MS = 250;

let roomEpoch = 0;
let pendingSubscription: Promise<void> | null = null;
let pendingSubscriptionRoom: string | null = null;
let serverClockOffsetMs = 0;
let lastAutoAdvanceKey: string | null = null;
let presenceRequestInFlight = false;
const pendingCommandKeys = new Set<string>();
const seenPrivateEffects = new Set<string>();

function isLobbyState(state: PublicRoomState): state is LobbyPublicState {
  return state.phase === 'lobby';
}

function rolesToConfig(roles: readonly GameRole[]): RoleConfig {
  const counts: Partial<Record<PlayerRole, number>> = {};
  for (const role of roles) counts[role as PlayerRole] = (counts[role as PlayerRole] || 0) + 1;
  return { counts };
}

function playersFromState(room: PublicRoomState): StorePlayer[] {
  return room.players.map((player) => ({
    id: player.id,
    name: player.name,
    ...('ready' in player ? {
      ready: player.ready,
      presence: player.presence,
      isSpectator: player.isSpectator,
    } : {}),
  }));
}

function isBadRole(role: GameRole): boolean {
  return role === 'Người trễ task' || role === 'Client' || role === 'Ông sếp khó ưa'
    || role === 'Kẻ fake CV' || role === 'QC cẩu thả' || role === 'Deadline' || role === 'Technical Debt';
}

function absorbPrivateEffects(
  effects: readonly PrivateEffect[],
  current: PrivateSkillResults
): PrivateSkillResults {
  let results = current;
  for (const effect of effects) {
    if (seenPrivateEffects.has(effect.commandId)) continue;
    seenPrivateEffects.add(effect.commandId);
    if (effect.kind === 'baCheck') {
      results = { ...results, baCheck: effect.result === 'yes' ? 'Yes' : 'No' };
    } else {
      results = {
        ...results,
        daCheck: { result: effect.vote, targetId: effect.targetId },
      };
    }
  }
  return results;
}

function mapMessage(value: unknown, fallbackRoomId: string): RoomMessage | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const sequence = Number(row.sequence);
  const roomId = String(row.roomId ?? row.room_id ?? fallbackRoomId);
  const senderPlayerId = row.senderPlayerId ?? row.sender_player_id;
  const text = row.text;
  const createdAt = row.createdAt ?? row.created_at;
  const audience = row.audience === 'bad' ? 'bad' : row.audience === 'public' ? 'public' : null;
  if (!Number.isFinite(sequence) || !roomId || typeof senderPlayerId !== 'string'
      || typeof text !== 'string' || typeof createdAt !== 'string' || !audience) return null;
  return { sequence, roomId, audience, senderPlayerId, text, createdAt };
}

function messageList(value: unknown, roomId: string): RoomMessage[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => mapMessage(entry, roomId)).filter((entry): entry is RoomMessage => !!entry);
}

function readError(data: unknown, fallback: string): { message: string; code?: string } {
  if (!data || typeof data !== 'object') return { message: fallback };
  const root = data as Record<string, unknown>;
  const error = root.error;
  if (typeof error === 'string') return { message: error };
  if (error && typeof error === 'object') {
    const details = error as Record<string, unknown>;
    return {
      message: typeof details.message === 'string' ? details.message : fallback,
      code: typeof details.code === 'string' ? details.code : undefined,
    };
  }
  return { message: typeof root.message === 'string' ? root.message : fallback };
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authenticatedFetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = readError(data, `Request failed (${response.status})`);
    throw Object.assign(new Error(error.message), { code: error.code, status: response.status });
  }
  return data;
}

function toSnapshot(data: Partial<RoomSnapshot> & { room: PublicRoomState }): RoomSnapshot {
  const state = useGameStore.getState();
  const sameRoom = state.roomId === data.room.id;
  return {
    room: data.room,
    private: data.private === undefined ? (sameRoom ? state.privateState : null) : data.private,
    player: data.player ?? {
      id: sameRoom ? state.playerId ?? '' : '',
      displayName: sameRoom ? state.playerName ?? 'Player' : 'Player',
      ready: sameRoom && state.playerReady,
      isSpectator: sameRoom && state.isSpectator,
    },
    serverNow: data.serverNow ?? Date.now() + serverClockOffsetMs,
  };
}

function applySnapshot(
  input: Partial<RoomSnapshot> & { room: PublicRoomState },
  expectedRoomId?: string,
  expectedEpoch?: number
): void {
  const snapshot = toSnapshot(input);
  const room = snapshot.room;
  const roomId = room.id;
  const current = useGameStore.getState();
  if (expectedRoomId && roomId !== expectedRoomId) return;
  if (expectedEpoch !== undefined && expectedEpoch !== roomEpoch) return;
  if (current.roomId && current.roomId !== roomId && current.realtimeChannel) {
    current.unsubscribeFromRoom();
  }
  const latest = useGameStore.getState();
  if (latest.roomId === roomId && latest.publicState && room.revision < latest.revision) return;

  const viewerPrivate = snapshot.player.isSpectator ? null : snapshot.private;
  const players = playersFromState(room);
  const lobby = isLobbyState(room);
  const phase = room.phase;
  const gameState = lobby ? null : room;
  const knownRoles = viewerPrivate?.knownRoles ?? [];
  const playerId = snapshot.player.id || latest.playerId;
  const privateSkillResults = absorbPrivateEffects(
    viewerPrivate?.effects ?? [],
    latest.roomId === roomId ? latest.privateSkillResults : { ...initialPrivateResults }
  );
  const activeVotes = gameState?.teamVoteRevealVotes ?? {};
  const rolePreview = lobby ? room.rolePreview : null;
  const visibleRoleConfig = rolePreview ? rolesToConfig(rolePreview.roles) : (lobby ? latest.roleConfig : initialRoleConfig);
  const roleRevealAcknowledgedVersion = latest.roomId === roomId && !(latest.phase === 'ended' && phase === 'lobby')
    ? latest.roleRevealAcknowledgedVersion
    : null;
  const showRoleReveal = phase === 'roleReveal'
    && Boolean(viewerPrivate?.ownRole)
    && roleRevealAcknowledgedVersion !== room.phaseVersion;
  const deadline = gameState?.phaseDeadlineAt ?? null;
  const currentTime = snapshot.serverNow;
  serverClockOffsetMs = snapshot.serverNow - Date.now();
  const remaining = deadline === null ? 0 : Math.max(0, deadline - currentTime);
  const chatPolicy = gameState?.chatPolicy ?? { allMuted: false, mutedPlayerId: null };
  const privateCanChatBad = Boolean(viewerPrivate?.canUseBadFactionChat);
  const isSilenced = chatPolicy.allMuted || (!!playerId && chatPolicy.mutedPlayerId === playerId);

  if (latest.roomId !== roomId || (latest.phase === 'ended' && phase === 'lobby')) {
    seenPrivateEffects.clear();
  }

  useGameStore.setState({
    roomId,
    publicState: room,
    privateState: viewerPrivate,
    playerId,
    playerName: snapshot.player.displayName,
    playerReady: snapshot.player.ready,
    isSpectator: snapshot.player.isSpectator,
    isHost: room.hostPlayerId === playerId,
    players,
    phase,
    phaseVersion: room.phaseVersion,
    revision: room.revision,
    currentSprint: gameState?.sprintIndex ?? 0,
    requiredTeamSize: gameState?.requiredTeamSize ?? 0,
    proposedTeam: gameState?.teamIds ?? [],
    currentPO: gameState?.leaderId ? players.find((player) => player.id === gameState.leaderId) ?? null : null,
    myRole: viewerPrivate?.ownRole ?? null,
    faction: viewerPrivate?.faction ?? null,
    isGood: viewerPrivate?.faction !== 'bad',
    knownRoles,
    saboteurIds: knownRoles.filter((known) => isBadRole(known.role)).map((known) => known.playerId),
    smId: knownRoles.find((known) => known.role === 'Người trễ task')?.playerId ?? null,
    baId: knownRoles.find((known) => known.role === 'Business Analyst')?.playerId ?? null,
    clientId: knownRoles.find((known) => known.role === 'Client')?.playerId ?? null,
    allowedActions: viewerPrivate?.allowedActions ?? [],
    goodWins: gameState?.goodWins ?? 0,
    badWins: gameState?.badWins ?? 0,
    rejectedTeams: gameState?.rejectedTeams ?? 0,
    consecutiveDelays: gameState?.rejectedTeams ?? 0,
    teamVoteSubmittedPlayerIds: gameState?.teamVoteSubmittedPlayerIds ?? [],
    teamVotePendingPlayerIds: gameState?.teamVotePendingPlayerIds ?? [],
    teamVoteRevealVotes: activeVotes,
    votes: activeVotes,
    executionSubmittedCount: gameState?.executionSubmittedCount ?? 0,
    executionReveal: gameState?.executionReveal ?? null,
    winner: gameState?.winner ?? null,
    endReason: gameState?.endReason ?? null,
    chatPolicy,
    isSilenced,
    deadlineSilenced: chatPolicy.allMuted,
    sepSilencedPlayerId: chatPolicy.mutedPlayerId,
    ttsFollowTargetId: viewerPrivate?.ttsFollowTargetId ?? null,
    pmOverrideUsed: gameState?.publicEvents.some((event) => event.type === 'skillUsed' && event.data.skill === 'pmOverride') ?? false,
    dataAnalystCheckUsed: gameState?.publicEvents.some((event) => event.type === 'skillUsed' && event.data.skill === 'daCheck') ?? false,
    businessAnalystCheckUsed: gameState?.publicEvents.some((event) => event.type === 'skillUsed' && event.data.skill === 'baCheck') ?? false,
    qcRedoUsed: gameState?.publicEvents.some((event) => event.type === 'skillUsed' && event.data.skill === 'qcRedo') ?? false,
    techDebtActive: false,
    pmDeferredThisSprint: false,
    techLeadPresent: false,
    prevSprintTeam: gameState?.history.at(-1)?.teamIds ?? [],
    prevExecutionVotes: {},
    prevSprintIndex: gameState?.sprintIndex ?? -1,
    discussionAdvanceVotes: [],
    sprintHistory: gameState?.history ?? [],
    publicEvents: gameState?.publicEvents ?? [],
    gameLog: gameState?.publicEvents ?? [],
    phaseStartedAt: gameState?.phaseStartedAt ?? null,
    phaseDeadlineAt: deadline,
    poSelectDeadlineAt: gameState?.phase === 'teamSelection' ? gameState.teamSelectionDeadlineAt : null,
    phaseRemainingMs: remaining,
    rolePreset: rolePreview?.preset ?? null,
    roleConfig: visibleRoleConfig,
    roomSettings: room.settings ?? null,
    roomLocked: isLobbyState(room) ? room.locked : false,
    rematch: 'rematch' in room ? room.rematch ?? null : null,
    canUseBadFactionChat: privateCanChatBad,
    privateSkillResults,
    voteAck: latest.voteAck && (
      (latest.voteAck.phase === 'teamVoting' && phase !== 'teamVoting')
      || (latest.voteAck.phase === 'execution' && phase !== 'execution')
    ) ? null : latest.voteAck,
    gameStarted: !lobby,
    showRoleReveal,
    roleRevealAcknowledgedVersion,
    nightZeroSeen: phase === 'firstNight' ? latest.nightZeroSeen : phase !== 'roleReveal',
    endReveal: lobby ? null : latest.endReveal,
    error: null,
  });

  const store = useGameStore.getState();
  if (store.roomId === roomId && store.messages.length === 0) void loadRoomMessages(roomId, roomEpoch);
  if (phase === 'ended' && !store.endReveal) void store.fetchEndReveal();
}

async function ensureAuthenticated(): Promise<void> {
  useGameStore.setState({ authStatus: 'authenticating' });
  try {
    await ensureBrowserSession();
    useGameStore.setState({ authStatus: 'authenticated' });
  } catch (error) {
    useGameStore.setState({ authStatus: 'error', error: error instanceof Error ? error.message : 'Authentication failed' });
    throw error;
  }
}

async function loadMessageAudience(roomId: string, audience: 'public' | 'bad', epoch: number): Promise<void> {
  if (audience === 'bad' && !useGameStore.getState().canUseBadFactionChat) return;
  const path = `/api/rooms/${encodeURIComponent(roomId)}/chat?audience=${audience}`;
  const data = await fetchJson(path);
  if (roomEpoch !== epoch || useGameStore.getState().roomId !== roomId) return;
  const messages = messageList((data as { messages?: unknown } | null)?.messages, roomId);
  if (audience === 'public') {
    useGameStore.setState((state) => ({ messages: mergeRoomMessages(state.messages, messages) }));
  } else {
    useGameStore.setState((state) => ({ badMessages: mergeRoomMessages(state.badMessages, messages) }));
  }
}

async function loadRoomMessages(roomId: string, epoch: number): Promise<void> {
  const state = useGameStore.getState();
  const tasks: Promise<void>[] = [loadMessageAudience(roomId, 'public', epoch)];
  if (state.canUseBadFactionChat) tasks.push(loadMessageAudience(roomId, 'bad', epoch));
  else useGameStore.setState({ badMessages: [] });
  await Promise.allSettled(tasks);
}

async function sendPresenceHeartbeat(roomId: string, epoch: number): Promise<void> {
  if (presenceRequestInFlight || roomEpoch !== epoch || useGameStore.getState().roomId !== roomId) return;
  presenceRequestInFlight = true;
  try {
    const response = await authenticatedFetch(`/api/rooms/${encodeURIComponent(roomId)}/presence`, { method: 'POST' });
    if (response.ok) useGameStore.setState({ authStatus: 'authenticated' });
  } catch {
    // Presence is advisory; snapshot and Realtime status drive the UI connection indicator.
  } finally {
    presenceRequestInFlight = false;
  }
}

function parseRoomMessage(payload: RoomRealtimePayload, roomId: string): RoomMessage | null {
  return mapMessage(payload.new, roomId);
}

function applyRealtimePublic(payload: RoomRealtimePayload, roomId: string, epoch: number): void {
  if (roomEpoch !== epoch || useGameStore.getState().roomId !== roomId) return;
  const state = payload.new.payload as PublicRoomState | undefined;
  if (!state || typeof state !== 'object' || state.id !== roomId) return;
  applySnapshot({ room: state }, roomId, epoch);
}

function applyRealtimePrivate(payload: RoomRealtimePayload, roomId: string, epoch: number): void {
  if (roomEpoch !== epoch || useGameStore.getState().roomId !== roomId) return;
  const privateState = payload.new.private_state as ViewerPrivateState | undefined;
  if (!privateState || typeof privateState !== 'object') return;
  const current = useGameStore.getState();
  const privateSkillResults = absorbPrivateEffects(privateState.effects ?? [], current.privateSkillResults);
  useGameStore.setState({
    privateState,
    myRole: privateState.ownRole,
    faction: privateState.faction,
    isGood: privateState.faction !== 'bad',
    knownRoles: privateState.knownRoles,
    saboteurIds: privateState.knownRoles.filter((known) => isBadRole(known.role)).map((known) => known.playerId),
    smId: privateState.knownRoles.find((known) => known.role === 'Người trễ task')?.playerId ?? null,
    baId: privateState.knownRoles.find((known) => known.role === 'Business Analyst')?.playerId ?? null,
    clientId: privateState.knownRoles.find((known) => known.role === 'Client')?.playerId ?? null,
    allowedActions: privateState.allowedActions,
    ttsFollowTargetId: privateState.ttsFollowTargetId,
    canUseBadFactionChat: privateState.canUseBadFactionChat,
    privateSkillResults,
    showRoleReveal: current.phase === 'roleReveal' && Boolean(privateState.ownRole)
      && current.roleRevealAcknowledgedVersion !== current.phaseVersion
      ? true
      : current.showRoleReveal,
  });
  if (privateState.canUseBadFactionChat && current.badMessages.length === 0) {
    void loadMessageAudience(roomId, 'bad', epoch);
  }
}

function applyRealtimeMessage(payload: RoomRealtimePayload, roomId: string, epoch: number): void {
  if (roomEpoch !== epoch || useGameStore.getState().roomId !== roomId) return;
  const message = parseRoomMessage(payload, roomId);
  if (!message) return;
  useGameStore.setState((state) => message.audience === 'bad'
    ? { badMessages: mergeRoomMessages(state.badMessages, [message]) }
    : { messages: mergeRoomMessages(state.messages, [message]) });
}

async function submitCommand(
  type: string,
  fields: Record<string, unknown> = {}
): Promise<{ snapshot: RoomSnapshot; commandId: string } | null> {
  const before = useGameStore.getState();
  const roomId = before.roomId;
  if (!roomId || !before.playerId || before.isSpectator) return null;
  const expectedPhaseVersion = before.phaseVersion;
  const epoch = roomEpoch;
  const dedupeKey = `${roomId}:${expectedPhaseVersion}:${type}:${JSON.stringify(fields)}`;
  if (pendingCommandKeys.has(dedupeKey)) return null;
  pendingCommandKeys.add(dedupeKey);
  const request = createCommandRequest(expectedPhaseVersion, type, fields);

  try {
    const data = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }) as RoomSnapshot;
    if (roomEpoch !== epoch || useGameStore.getState().roomId !== roomId) return null;
    applySnapshot(data, roomId, epoch);
    return { snapshot: data, commandId: request.commandId };
  } catch (error) {
    if (roomEpoch !== epoch || useGameStore.getState().roomId !== roomId) return null;
    const details = error as Error & { code?: string };
    if (details.code === 'STALE_PHASE' || details.code === 'INVALID_PHASE') {
      void useGameStore.getState().refreshRoom();
    }
    useGameStore.setState({ error: details.message || 'Command failed' });
    return null;
  } finally {
    pendingCommandKeys.delete(dedupeKey);
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  roomId: null,
  publicState: null,
  privateState: null,
  endReveal: null,
  playerId: null,
  playerName: getPersistedPlayerName(),
  playerReady: false,
  isSpectator: false,
  isHost: false,
  players: [],
  phase: null,
  phaseVersion: 0,
  revision: 0,
  currentSprint: 0,
  requiredTeamSize: 0,
  proposedTeam: [],
  currentPO: null,
  myRole: null,
  faction: null,
  isGood: true,
  knownRoles: [],
  saboteurIds: [],
  smId: null,
  baId: null,
  clientId: null,
  allowedActions: [],
  goodWins: 0,
  badWins: 0,
  rejectedTeams: 0,
  consecutiveDelays: 0,
  teamVoteSubmittedPlayerIds: [],
  teamVotePendingPlayerIds: [],
  teamVoteRevealVotes: {},
  votes: {},
  executionSubmittedCount: 0,
  executionReveal: null,
  winner: null,
  endReason: null,
  chatPolicy: { allMuted: false, mutedPlayerId: null },
  isSilenced: false,
  deadlineSilenced: false,
  sepSilencedPlayerId: null,
  ttsFollowTargetId: null,
  pmOverrideUsed: false,
  dataAnalystCheckUsed: false,
  businessAnalystCheckUsed: false,
  qcRedoUsed: false,
  techDebtActive: false,
  pmDeferredThisSprint: false,
  techLeadPresent: false,
  prevSprintTeam: [],
  prevExecutionVotes: {},
  prevSprintIndex: -1,
  discussionAdvanceVotes: [],
  sprintHistory: [],
  publicEvents: [],
  gameLog: [],
  phaseStartedAt: null,
  phaseDeadlineAt: null,
  poSelectDeadlineAt: null,
  phaseRemainingMs: 0,
  rolePreset: null,
  roleConfig: initialRoleConfig,
  roomSettings: null,
  roomLocked: false,
  rematch: null,
  canUseBadFactionChat: false,
  privateSkillResults: { ...initialPrivateResults },
  voteAck: null,
  messages: [],
  badMessages: [],
  authStatus: 'idle',
  connectionStatus: 'offline',
  error: null,
  realtimeChannel: null,
  pollingInterval: null,
  presenceHeartbeatInterval: null,
  tickInterval: null,
  showRoleReveal: false,
  roleRevealAcknowledgedVersion: null,
  gameStarted: false,
  nightZeroSeen: false,
  authUnsubscribe: null,

  setRoomFromResponse: (data) => applySnapshot(data, data.room.id),

  createRoom: async (roomId, playerName) => {
    set({ error: null, authStatus: 'authenticating', connectionStatus: 'connecting' });
    try {
      await ensureAuthenticated();
      const snapshot = await fetchJson('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerName, commandId: globalThis.crypto.randomUUID() }),
      }) as RoomSnapshot;
      setPersistedPlayerName(playerName);
      applySnapshot(snapshot, roomId);
      set({ authStatus: 'authenticated', connectionStatus: 'connecting' });
      get().subscribeToRoom();
    } catch (error) {
      set({ authStatus: get().authStatus === 'error' ? 'error' : 'authenticated', error: error instanceof Error ? error.message : 'Failed to create room' });
    }
  },

  joinRoom: async (roomId, playerName, options = {}) => {
    set({ error: null, authStatus: 'authenticating', connectionStatus: 'connecting' });
    try {
      await ensureAuthenticated();
      const snapshot = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, spectator: Boolean(options.spectator) }),
      }) as RoomSnapshot;
      setPersistedPlayerName(playerName);
      applySnapshot(snapshot, roomId);
      set({ authStatus: 'authenticated', connectionStatus: 'connecting' });
      get().subscribeToRoom();
    } catch (error) {
      set({ authStatus: get().authStatus === 'error' ? 'error' : 'authenticated', connectionStatus: 'offline', error: error instanceof Error ? error.message : 'Failed to join room' });
    }
  },

  rejoinRoom: async (roomId) => {
    const playerName = getPersistedPlayerName() || get().playerName || 'Player';
    set({ error: null, authStatus: 'authenticating', connectionStatus: 'connecting' });
    try {
      await ensureAuthenticated();
      const snapshot = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      }) as RoomSnapshot;
      applySnapshot(snapshot, roomId);
      setPersistedPlayerName(snapshot.player.displayName || playerName);
      set({ authStatus: 'authenticated', connectionStatus: 'connecting' });
      get().subscribeToRoom();
    } catch (error) {
      set({ authStatus: get().authStatus === 'error' ? 'error' : 'authenticated', connectionStatus: 'offline', error: error instanceof Error ? error.message : 'Cannot rejoin room' });
    }
  },

  refreshRoom: async () => {
    const { roomId } = get();
    if (!roomId) return;
    const epoch = roomEpoch;
    try {
      const snapshot = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}`) as RoomSnapshot;
      applySnapshot(snapshot, roomId, epoch);
      await loadRoomMessages(roomId, epoch);
    } catch {
      if (get().roomId === roomId && roomEpoch === epoch) set({ connectionStatus: 'offline' });
    }
  },

  fetchEndReveal: async () => {
    const { roomId, publicState, phase } = get();
    if (!roomId || phase !== 'ended' || !publicState || isLobbyState(publicState)) return;
    const expectedRevision = publicState.revision;
    try {
      const data = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}/end-reveal`) as {
        endReveal?: EndGameProjection | null;
        roles?: EndGameProjection['revealedRoles'];
      };
      const state = get();
      if (state.roomId !== roomId || state.phase !== 'ended' || state.publicState?.revision !== expectedRevision) return;
      const reveal = data.endReveal ?? (data.roles ? { ...state.publicState as PublicGameState, revealedRoles: data.roles } : null);
      set({ endReveal: reveal });
    } catch {
      // The normal room view intentionally contains no roles; keep reveal unavailable on endpoint failure.
    }
  },

  startGame: async (roles) => {
    if (roles?.length) {
      await get().setRolePreset('custom', roles);
      if (get().error) return;
    }
    await submitCommand('startGame');
  },
  setReady: async (ready) => { await submitCommand('setReady', { ready }); },
  setRoomLocked: async (locked) => { await submitCommand('setLocked', { locked }); },
  kickPlayer: async (targetPlayerId) => { await submitCommand('kickPlayer', { targetPlayerId }); },
  transferHost: async (targetPlayerId) => { await submitCommand('transferHost', { targetPlayerId }); },
  setRoomSettings: async (settings) => { await submitCommand('setSettings', settings); },
  setRolePreset: async (preset, roles) => {
    const fields: Record<string, unknown> = { preset };
    if (preset === 'custom' && roles) fields.roles = roles;
    await submitCommand('setRolePreset', fields);
  },
  rerollRolePreset: async () => { await submitCommand('rerollRolePreset'); },
  proposeRematch: async () => { await submitCommand('proposeRematch'); },
  startRematch: async () => { await submitCommand('startRematch'); },

  proposeTeam: async (playerIds) => { await submitCommand('finalizeTeam', { teamIds: playerIds }); },

  voteTeam: async (vote) => {
    const normalizedVote: TeamVote = vote === 'agree' ? 'approve' : vote;
    set({ voteAck: { phase: 'teamVoting', vote: normalizedVote, at: Date.now() } });
    const result = await submitCommand('castTeamVote', { vote: normalizedVote });
    if (!result) set({ voteAck: null });
  },

  voteExecution: async (vote) => {
    set({ voteAck: { phase: 'execution', vote, at: Date.now() } });
    const result = await submitCommand('castExecutionVote', { vote });
    if (!result) set({ voteAck: null });
  },

  advanceToPlanning: async () => { await get().autoAdvance(); },
  advanceFromDiscussion: async () => { await get().autoAdvance(); },
  nightAdvance: async () => { await get().autoAdvance(); },
  pmDefer: async () => { await get().autoAdvance(); },

  saboteurGuess: async (guessedSmId) => { await submitCommand('guessScrumMaster', { targetId: guessedSmId }); },

  sendMessage: async (text) => sendRoomMessage(text, 'public'),
  sendBadMessage: async (text) => sendRoomMessage(text, 'bad'),
  sendReaction: async (emoji, targetType, targetPlayerId) => {
    await submitCommand('react', { emoji, targetType, ...(targetPlayerId ? { targetPlayerId } : {}) });
  },

  nightZeroComplete: async (ttsTargetId) => {
    if (!ttsTargetId) return;
    await submitCommand('setTtsTarget', { targetId: ttsTargetId });
    set({ nightZeroSeen: true });
  },
  pmOverride: async (playerIds) => { await submitCommand('usePmOverride', { teamIds: playerIds }); },
  businessAnalystCheck: async (targetIds) => {
    const result = await submitCommand('useBaCheck', { targetIds });
    if (!result) return null;
    const effect = result.snapshot.private?.effects.find((entry) => entry.commandId === result.commandId && entry.kind === 'baCheck');
    return effect?.kind === 'baCheck' ? (effect.result === 'yes' ? 'Yes' : 'No') : null;
  },
  qcRedo: async () => { await submitCommand('useQcRedo'); },
  dataAnalystCheck: async (targetId) => {
    const result = await submitCommand('useDaCheck', { targetId });
    if (!result) return null;
    const effect = result.snapshot.private?.effects.find((entry) => entry.commandId === result.commandId && entry.kind === 'daCheck');
    return effect?.kind === 'daCheck' ? effect.vote : null;
  },
  sepSilence: async (targetId) => { await submitCommand('useBossSilence', { targetId }); },
  deadlineSilence: async () => { await submitCommand('useDeadlineSilence'); },

  autoAdvance: async () => { await get().refreshRoom(); },
  startTickInterval: () => {
    get().stopTickInterval();
    const interval = setInterval(() => {
      const state = get();
      const deadline = state.phaseDeadlineAt;
      const remaining = deadline === null ? 0 : Math.max(0, deadline - (Date.now() + serverClockOffsetMs));
      set({ phaseRemainingMs: remaining });
      if (deadline !== null && remaining === 0 && state.phase !== 'lobby') {
        const key = `${state.roomId}:${state.phaseVersion}`;
        if (lastAutoAdvanceKey !== key) {
          lastAutoAdvanceKey = key;
          void state.autoAdvance().finally(() => {
            const latest = get();
            if (latest.roomId === state.roomId && latest.phaseVersion === state.phaseVersion) lastAutoAdvanceKey = null;
          });
        }
      }
    }, TICK_INTERVAL_MS);
    set({ tickInterval: interval });
  },
  stopTickInterval: () => {
    const { tickInterval } = get();
    if (tickInterval) clearInterval(tickInterval);
    set({ tickInterval: null });
  },

  setRoleConfig: (cfg) => set({ roleConfig: cfg }),
  setNightZeroSeen: (value) => set({ nightZeroSeen: value }),
  setVoteAck: (ack) => set({ voteAck: ack }),
  clearPrivateBaResult: () => set((state) => ({ privateSkillResults: { ...state.privateSkillResults, baCheck: null } })),
  clearPrivateDaResult: () => set((state) => ({ privateSkillResults: { ...state.privateSkillResults, daCheck: null } })),

  subscribeToRoom: () => {
    const { roomId, playerId } = get();
    if (!roomId || !playerId) return;
    if (get().realtimeChannel && get().roomId === roomId) return;
    if (pendingSubscription && pendingSubscriptionRoom === roomId) return;
    if (get().realtimeChannel) get().unsubscribeFromRoom();

    const epoch = roomEpoch;
    pendingSubscriptionRoom = roomId;
    set({ authStatus: 'authenticating', connectionStatus: 'connecting' });
    pendingSubscription = (async () => {
      try {
        await ensureBrowserSession();
        if (roomEpoch !== epoch || get().roomId !== roomId) return;
        set({ authStatus: 'authenticated' });
        if (!get().authUnsubscribe) {
          const authUnsubscribe = subscribeToBrowserAuth((_event, session) => {
            set({ authStatus: session ? 'authenticated' : 'idle' });
            if (!session) set({ connectionStatus: 'offline' });
          });
          set({ authUnsubscribe });
        }

        const supabase = getSupabase();
        const channel = registerRoomRealtimeHandlers(
          supabase.channel(`room-view:${roomId}`),
          roomId,
          {
            onPublicState: (payload) => applyRealtimePublic(payload, roomId, epoch),
            onPrivateState: (payload) => applyRealtimePrivate(payload, roomId, epoch),
            onMessage: (payload) => applyRealtimeMessage(payload, roomId, epoch),
          }
        );

        const subscribed = channel.subscribe((status) => {
          if (roomEpoch !== epoch || get().roomId !== roomId) return;
          if (status === 'SUBSCRIBED') {
            set({ connectionStatus: 'online', authStatus: 'authenticated' });
            get().stopPollingFallback();
            void get().refreshRoom();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            set({ connectionStatus: 'reconnecting' });
            get().startPollingFallback();
          }
        });
        set({ realtimeChannel: subscribed });
        get().startTickInterval();

        const heartbeat = setInterval(() => { void sendPresenceHeartbeat(roomId, epoch); }, PRESENCE_INTERVAL_MS);
        set({ presenceHeartbeatInterval: heartbeat });
        await sendPresenceHeartbeat(roomId, epoch);
        await get().refreshRoom();
      } catch (error) {
        if (roomEpoch === epoch && get().roomId === roomId) {
          set({ authStatus: 'error', connectionStatus: 'offline', error: error instanceof Error ? error.message : 'Could not connect to room' });
        }
      }
    })().finally(() => {
      if (pendingSubscriptionRoom === roomId) {
        pendingSubscription = null;
        pendingSubscriptionRoom = null;
      }
    });
  },

  unsubscribeFromRoom: () => {
    roomEpoch += 1;
    pendingSubscription = null;
    pendingSubscriptionRoom = null;
    const state = get();
    if (state.realtimeChannel) void getSupabase().removeChannel(state.realtimeChannel);
    if (state.authUnsubscribe) state.authUnsubscribe();
    get().stopPollingFallback();
    get().stopTickInterval();
    if (state.presenceHeartbeatInterval) clearInterval(state.presenceHeartbeatInterval);
    set({
      realtimeChannel: null,
      authUnsubscribe: null,
      presenceHeartbeatInterval: null,
      connectionStatus: 'offline',
    });
  },

  startPollingFallback: () => {
    const { roomId, pollingInterval } = get();
    if (!roomId || pollingInterval) return;
    const epoch = roomEpoch;
    set({ connectionStatus: 'reconnecting' });
    const interval = setInterval(() => {
      if (roomEpoch !== epoch || get().roomId !== roomId) return;
      void get().refreshRoom();
    }, POLL_INTERVAL_MS);
    set({ pollingInterval: interval });
    void get().refreshRoom();
  },
  stopPollingFallback: () => {
    const { pollingInterval } = get();
    if (pollingInterval) clearInterval(pollingInterval);
    set({ pollingInterval: null });
  },

  clearError: () => set({ error: null }),
  closeRoleReveal: () => set((state) => ({
    showRoleReveal: false,
    roleRevealAcknowledgedVersion: state.phase === 'roleReveal' ? state.phaseVersion : state.roleRevealAcknowledgedVersion,
  })),
  resetRoleReveal: async () => { get().closeRoleReveal(); },
  resetRoom: async () => { await get().proposeRematch(); },

  leaveRoom: () => {
    get().unsubscribeFromRoom();
    seenPrivateEffects.clear();
    lastAutoAdvanceKey = null;
    set(initialRoomState());
  },
}));

function initialRoomState(): Pick<GameStore,
  | 'roomId' | 'publicState' | 'privateState' | 'endReveal' | 'playerId' | 'playerReady' | 'isSpectator' | 'isHost'
  | 'players' | 'phase' | 'phaseVersion' | 'revision' | 'currentSprint' | 'requiredTeamSize' | 'proposedTeam'
  | 'currentPO' | 'myRole' | 'faction' | 'knownRoles' | 'saboteurIds' | 'smId' | 'baId' | 'clientId'
  | 'allowedActions' | 'goodWins' | 'badWins' | 'rejectedTeams' | 'consecutiveDelays' | 'teamVoteSubmittedPlayerIds'
  | 'teamVotePendingPlayerIds' | 'teamVoteRevealVotes' | 'votes' | 'executionSubmittedCount' | 'executionReveal'
  | 'winner' | 'endReason' | 'chatPolicy' | 'isSilenced' | 'deadlineSilenced' | 'sepSilencedPlayerId'
  | 'ttsFollowTargetId' | 'pmOverrideUsed' | 'dataAnalystCheckUsed' | 'businessAnalystCheckUsed' | 'qcRedoUsed'
  | 'techDebtActive' | 'pmDeferredThisSprint' | 'techLeadPresent' | 'prevSprintTeam' | 'prevExecutionVotes'
  | 'prevSprintIndex' | 'discussionAdvanceVotes' | 'sprintHistory' | 'publicEvents' | 'gameLog' | 'phaseStartedAt'
  | 'phaseDeadlineAt' | 'poSelectDeadlineAt' | 'phaseRemainingMs' | 'rolePreset' | 'roleConfig' | 'roomSettings'
  | 'roomLocked' | 'rematch' | 'canUseBadFactionChat' | 'privateSkillResults' | 'voteAck' | 'messages' | 'badMessages'
  | 'connectionStatus' | 'error' | 'showRoleReveal' | 'roleRevealAcknowledgedVersion' | 'gameStarted' | 'nightZeroSeen'
> {
  return {
    roomId: null, publicState: null, privateState: null, endReveal: null, playerId: null,
    playerReady: false, isSpectator: false, isHost: false, players: [], phase: null,
    phaseVersion: 0, revision: 0, currentSprint: 0, requiredTeamSize: 0, proposedTeam: [], currentPO: null,
    myRole: null, faction: null, knownRoles: [], saboteurIds: [], smId: null, baId: null, clientId: null,
    allowedActions: [], goodWins: 0, badWins: 0, rejectedTeams: 0, consecutiveDelays: 0,
    teamVoteSubmittedPlayerIds: [], teamVotePendingPlayerIds: [], teamVoteRevealVotes: {}, votes: {},
    executionSubmittedCount: 0, executionReveal: null, winner: null, endReason: null,
    chatPolicy: { allMuted: false, mutedPlayerId: null }, isSilenced: false, deadlineSilenced: false,
    sepSilencedPlayerId: null, ttsFollowTargetId: null, pmOverrideUsed: false, dataAnalystCheckUsed: false,
    businessAnalystCheckUsed: false, qcRedoUsed: false, techDebtActive: false, pmDeferredThisSprint: false,
    techLeadPresent: false, prevSprintTeam: [], prevExecutionVotes: {}, prevSprintIndex: -1,
    discussionAdvanceVotes: [], sprintHistory: [], publicEvents: [], gameLog: [], phaseStartedAt: null,
    phaseDeadlineAt: null, poSelectDeadlineAt: null, phaseRemainingMs: 0, rolePreset: null,
    roleConfig: initialRoleConfig, roomSettings: null, roomLocked: false, rematch: null,
    canUseBadFactionChat: false, privateSkillResults: { ...initialPrivateResults }, voteAck: null,
    messages: [], badMessages: [], connectionStatus: 'offline', error: null,
    showRoleReveal: false, roleRevealAcknowledgedVersion: null, gameStarted: false, nightZeroSeen: false,
  };
}

async function sendRoomMessage(text: string, audience: 'public' | 'bad'): Promise<void> {
  const message = text.trim();
  const state = useGameStore.getState();
  const roomId = state.roomId;
  if (!message || !roomId || !state.playerId || state.isSpectator || state.isSilenced) return;
  if (audience === 'bad' && !state.canUseBadFactionChat) return;
  try {
    const data = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: globalThis.crypto.randomUUID(), text: message, audience }),
    }) as { message?: unknown };
    const parsed = mapMessage(data.message, roomId);
    if (!parsed || useGameStore.getState().roomId !== roomId) return;
    useGameStore.setState((current) => audience === 'bad'
      ? { badMessages: mergeRoomMessages(current.badMessages, [parsed]) }
      : { messages: mergeRoomMessages(current.messages, [parsed]) });
  } catch (error) {
    if (useGameStore.getState().roomId === roomId) useGameStore.setState({ error: error instanceof Error ? error.message : 'Failed to send message' });
  }
}

export type { GameRole as PlayerRole };
