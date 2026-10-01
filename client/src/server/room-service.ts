import { randomInt, randomUUID } from 'node:crypto';

import {
  createGameState,
  isRoleSetValid,
  previewPreset,
  projectEndedState,
  projectPrivateState,
  projectState,
  transition,
  type GameCommand,
  type GameEvent,
  type GameRole,
  type GameState,
  type PublicGameState,
  type TransitionRejectionCode,
  type ViewerPrivateState,
} from '@/game';
import { factionForRole } from '@/game/presets';
import { databasePool, queryOne, type SqlClient, type SqlPool } from './db';

const CHAT_LIMIT_COUNT = 5;
const CHAT_LIMIT_WINDOW_SECONDS = 10;

export type CommunicationMode = 'remote' | 'inPerson';
export type LobbyPreset = 'beginner' | 'classic' | 'advanced' | 'chaos' | 'custom';

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
  settings: { communicationMode: CommunicationMode };
  rolePreview: { preset: LobbyPreset; roles: GameRole[]; seed: string } | null;
  rematch: { proposedBy: string; readyPlayerIds: string[] } | null;
}

export interface RematchState {
  proposedBy: string;
  readyPlayerIds: string[];
}

export type PublicGameRoomState = PublicGameState & {
  hostPlayerId: string;
  settings?: { communicationMode: CommunicationMode };
  rematch?: RematchState;
};
export type PublicRoomState = LobbyPublicState | PublicGameRoomState;

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

export type CommandInput = Omit<GameCommand, 'actorId'> | LobbyCommand;

export type LobbyCommand = {
  commandId: string;
  expectedPhaseVersion: number;
} & (
  | { type: 'setReady'; ready: boolean }
  | { type: 'setLocked'; locked: boolean }
  | { type: 'kickPlayer'; targetPlayerId: string }
  | { type: 'transferHost'; targetPlayerId: string }
  | { type: 'setSettings'; communicationMode: CommunicationMode }
  | { type: 'setRolePreset'; preset: LobbyPreset; roles?: GameRole[]; seed?: string }
  | { type: 'rerollRolePreset'; seed?: string }
  | { type: 'startGame' }
  | { type: 'proposeRematch' }
  | { type: 'startRematch' }
);

export class RoomServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly currentPhaseVersion?: number,
  ) {
    super(message);
    this.name = 'RoomServiceError';
  }
}

type RoomRow = {
  room_id: string;
  host_player_id: string | null;
  phase_version: number;
  revision: number;
  internal_state: GameState | null;
  deadline_at: Date | null;
};

type MemberRow = {
  id: string;
  display_name: string;
  ready: boolean;
  last_seen: Date | null;
  is_spectator: boolean;
};

type StoredPublicRow = { payload: PublicRoomState };

export interface RoomServiceDependencies {
  pool?: SqlPool;
  now?: () => number;
  random?: () => number;
}

export class RoomService {
  private readonly pool: SqlPool;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(dependencies: RoomServiceDependencies = {}) {
    this.pool = dependencies.pool ?? databasePool();
    this.now = dependencies.now ?? Date.now;
    this.random = dependencies.random ?? secureRandom;
  }

  async createRoom(roomId: string, displayName: string, authUserId: string, commandId?: string): Promise<RoomSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      assertRoomId(roomId);
      if (commandId !== undefined) assertCommandId(commandId);
      const name = normalizeDisplayName(displayName);
      const insertedRoom = await queryOne<RoomRow>(client, `
        insert into public.game_rooms (room_id, host_player_id, phase_version, revision, internal_state)
        values ($1, null, 0, 0, null)
        on conflict (room_id) do nothing
        returning room_id, host_player_id, phase_version, revision, internal_state, deadline_at
      `, [roomId]);
      if (!insertedRoom) {
        const room = await this.lockRoom(client, roomId);
        const priorCommand = commandId ? await queryOne<{ actor_auth_user_id: string | null }>(client,
          'select actor_auth_user_id from public.applied_commands where room_id = $1 and command_id = $2',
          [roomId, commandId],
        ) : null;
        if (priorCommand?.actor_auth_user_id === authUserId) {
          const member = await this.requireMember(client, roomId, authUserId);
          await this.catchUpDuePhase(client, room);
          const snapshot = await this.snapshotInTransaction(client, room, member);
          await client.query('COMMIT');
          return snapshot;
        }
        throw new RoomServiceError('ROOM_EXISTS', 'Room already exists', 409);
      }
      const room = normalizeRoomRow(insertedRoom);

      const member = await queryOne<MemberRow>(client, `
        insert into public.room_players (id, room_id, auth_user_id, display_name, joined_order, ready, last_seen, is_spectator)
        values ($1, $2, $3, $4, 0, false, now(), false)
        returning id, display_name, ready, last_seen, is_spectator
      `, [randomUUID(), roomId, authUserId, name]);
      if (!member) throw new RoomServiceError('CREATE_FAILED', 'Could not create host seat', 500);

      room.host_player_id = member.id;
      await client.query('update public.game_rooms set host_player_id = $2, updated_at = now() where room_id = $1', [roomId, member.id]);
      const lobby = await this.writeLobbyProjection(client, room, null);
      if (commandId) await this.recordCommand(client, roomId, commandId, authUserId, 0, { revision: 0, phaseVersion: 0 });
      await client.query('COMMIT');
      return { room: lobby, private: null, player: seatFrom(member), serverNow: this.now() };
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async joinRoom(roomId: string, displayName: string, authUserId: string, spectator = false): Promise<RoomSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const room = await this.lockRoom(client, roomId);
      const existing = await this.memberForAuth(client, roomId, authUserId);
      if (existing) {
        await this.catchUpDuePhase(client, room);
        await client.query('update public.room_players set last_seen = now() where id = $1', [existing.id]);
        const publicState = await this.publicState(client, roomId);
        if (isLobby(publicState)) {
          await this.touchLobbyRevision(client, room);
          await this.writeLobbyProjection(client, room, publicState);
        }
        const refreshed = await this.memberById(client, roomId, existing.id);
        const snapshot = await this.snapshotInTransaction(client, room, refreshed ?? existing);
        await client.query('COMMIT');
        return snapshot;
      }
      const publicState = await this.publicState(client, roomId);
      if (!room.internal_state && !isLobby(publicState)) throw new RoomServiceError('INVALID_ROOM_STATE', 'Room is unavailable for joining', 409);
      if (isLobby(publicState) && publicState.locked) throw new RoomServiceError('ROOM_LOCKED', 'The room is locked', 403);
      if (room.internal_state && !spectator) {
        throw new RoomServiceError('GAME_ALREADY_STARTED', 'Only spectators can join after the game starts', 403);
      }
      if (!room.internal_state && !spectator) {
        const activeCount = await queryOne<{ player_count: number }>(client,
          'select count(*)::int as player_count from public.room_players where room_id = $1 and kicked_at is null and is_spectator = false',
          [roomId],
        );
        if ((activeCount?.player_count ?? 0) >= 10) throw new RoomServiceError('ROOM_FULL', 'A game room supports at most 10 players', 409);
      }
      const normalizedName = normalizeDisplayName(displayName);
      const duplicateName = await queryOne<{ id: string }>(client, `select id from public.room_players
        where room_id = $1 and kicked_at is null and lower(display_name) = lower($2) limit 1`, [roomId, normalizedName]);
      if (duplicateName) throw new RoomServiceError('PLAYER_NAME_TAKEN', 'Tên này đã được sử dụng trong phòng', 409);
      const nextOrder = await queryOne<{ next_order: number }>(client,
        'select coalesce(max(joined_order), -1)::int + 1 as next_order from public.room_players where room_id = $1',
        [roomId],
      );
      const member = await queryOne<MemberRow>(client, `
        insert into public.room_players (id, room_id, auth_user_id, display_name, joined_order, ready, last_seen, is_spectator)
        values ($1, $2, $3, $4, $5, false, now(), $6)
        returning id, display_name, ready, last_seen, is_spectator
      `, [randomUUID(), roomId, authUserId, normalizedName, nextOrder?.next_order ?? 0, spectator]);
      if (!member) throw new RoomServiceError('JOIN_FAILED', 'Could not join room', 500);
      await this.maybeTransferHost(client, room);
      await this.catchUpDuePhase(client, room);
      if (isLobby(publicState)) await this.touchLobbyRevision(client, room);
      const snapshot = room.internal_state
        ? await this.snapshotInTransaction(client, room, member)
        : { room: await this.writeLobbyProjection(client, room, publicState), private: null, player: seatFrom(member), serverNow: this.now() };
      await client.query('COMMIT');
      return snapshot;
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async snapshot(roomId: string, authUserId: string): Promise<RoomSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const room = await this.lockRoom(client, roomId);
      const member = await this.requireMember(client, roomId, authUserId);
      await this.catchUpDuePhase(client, room);
      const snapshot = await this.snapshotInTransaction(client, room, member);
      await client.query('COMMIT');
      return snapshot;
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async command(roomId: string, authUserId: string, input: CommandInput): Promise<RoomSnapshot> {
    assertCommand(input);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const room = await this.lockRoom(client, roomId);
      const member = await this.requireMember(client, roomId, authUserId);
      await this.catchUpDuePhase(client, room);
      const duplicate = await queryOne<{ result: unknown; actor_auth_user_id: string | null }>(client,
        'select result, actor_auth_user_id from public.applied_commands where room_id = $1 and command_id = $2',
        [roomId, input.commandId],
      );
      if (duplicate) {
        if (duplicate.actor_auth_user_id !== authUserId) {
          throw new RoomServiceError('COMMAND_ID_CONFLICT', 'commandId has already been used', 409);
        }
        const snapshot = await this.snapshotInTransaction(client, room, member);
        await client.query('COMMIT');
        return snapshot;
      }
      if (input.expectedPhaseVersion !== room.phase_version) {
        throw new RoomServiceError('STALE_PHASE', 'This action was based on an older phase', 409, room.phase_version);
      }
      const snapshot = isLobbyCommand(input)
        ? await this.applyLobbyCommand(client, room, member, authUserId, input)
        : await this.applyGameCommand(client, room, member, authUserId, input);
      await client.query('COMMIT');
      return snapshot;
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePresence(roomId: string, authUserId: string, refresh = true): Promise<ViewerSeat> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const room = await this.lockRoom(client, roomId);
      const member = await this.requireMember(client, roomId, authUserId);
      if (refresh) {
        await client.query('update public.room_players set last_seen = now() where id = $1', [member.id]);
        member.last_seen = new Date(this.now());
        await this.maybeTransferHost(client, room);
        const publicState = await this.publicState(client, roomId);
        if (isLobby(publicState)) {
          await this.touchLobbyRevision(client, room);
          await this.writeLobbyProjection(client, room, publicState);
        }
      }
      await client.query('COMMIT');
      return seatFrom(member);
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async messages(roomId: string, authUserId: string, audience: 'public' | 'bad' = 'public') {
    assertAudienceValue(audience);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const room = await this.lockRoom(client, roomId);
      const member = await this.requireMember(client, roomId, authUserId);
      await this.catchUpDuePhase(client, room);
      await this.assertAudience(client, room, member, audience);
      const result = await client.query<{
        sequence: string; room_id: string; audience: 'public' | 'bad'; sender_player_id: string; text: string; created_at: Date;
      }>(`select sequence, room_id, audience, sender_player_id, text, created_at
          from public.room_messages where room_id = $1 and audience = $2 order by sequence asc limit 100`, [roomId, audience]);
      await client.query('COMMIT');
      return result.rows.map(messageDto);
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async sendMessage(roomId: string, authUserId: string, commandId: string, rawText: string, audience: 'public' | 'bad' = 'public') {
    assertCommandId(commandId);
    assertAudienceValue(audience);
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    if (text.length < 1 || text.length > 500) throw new RoomServiceError('INVALID_MESSAGE', 'Message must be 1-500 characters');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const room = await this.lockRoom(client, roomId);
      const member = await this.requireMember(client, roomId, authUserId);
      await this.catchUpDuePhase(client, room);
      await this.assertAudience(client, room, member, audience);
      const duplicate = await queryOne<{
        sequence: string; room_id: string; audience: 'public' | 'bad'; sender_player_id: string; text: string; created_at: Date;
      }>(client, `select sequence, room_id, audience, sender_player_id, text, created_at
          from public.room_messages where room_id = $1 and command_id = $2 and sender_player_id = $3`, [roomId, commandId, member.id]);
      if (duplicate) {
        if (duplicate.audience !== audience || duplicate.text !== text) {
          throw new RoomServiceError('COMMAND_ID_CONFLICT', 'Message commandId was reused for different content', 409);
        }
        await client.query('COMMIT');
        return messageDto(duplicate);
      }
      this.assertChatAllowed(room, member.id);
      const rate = await queryOne<{ count: number }>(client, `select count(*)::int as count from public.room_messages
        where room_id = $1 and sender_player_id = $2 and created_at > now() - make_interval(secs => $3)`,
      [roomId, member.id, CHAT_LIMIT_WINDOW_SECONDS]);
      if ((rate?.count ?? 0) >= CHAT_LIMIT_COUNT) throw new RoomServiceError('RATE_LIMITED', 'Please wait before sending another message', 429);
      const inserted = await queryOne<{
        sequence: string; room_id: string; audience: 'public' | 'bad'; sender_player_id: string; text: string; created_at: Date;
      }>(client, `insert into public.room_messages (room_id, audience, sender_player_id, text, command_id)
          values ($1, $2, $3, $4, $5) returning sequence, room_id, audience, sender_player_id, text, created_at`,
      [roomId, audience, member.id, text, commandId]);
      if (!inserted) throw new RoomServiceError('MESSAGE_FAILED', 'Could not send message', 500);
      await client.query('COMMIT');
      return messageDto(inserted);
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async endReveal(roomId: string, authUserId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const room = await this.lockRoom(client, roomId);
      await this.requireMember(client, roomId, authUserId);
      await this.catchUpDuePhase(client, room);
      const state = room.internal_state;
      if (!state || state.phase !== 'ended') throw new RoomServiceError('REVEAL_UNAVAILABLE', 'Roles are revealed only after the game ends', 403);
      const endedProjection = projectEndedState(state);
      if (!endedProjection) throw new RoomServiceError('REVEAL_UNAVAILABLE', 'Roles are revealed only after the game ends', 403);
      await client.query('COMMIT');
      return { roles: endedProjection.revealedRoles };
    } catch (error) {
      await safeRollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyGameCommand(client: SqlClient, room: RoomRow, member: MemberRow, authUserId: string, input: Omit<GameCommand, 'actorId'>): Promise<RoomSnapshot> {
    if (!room.internal_state) throw new RoomServiceError('GAME_NOT_STARTED', 'The game has not started', 409);
    if (member.is_spectator) throw new RoomServiceError('SPECTATOR_READ_ONLY', 'Spectators cannot play', 403);
    const command = { ...input, actorId: member.id } as GameCommand;
    if (command.type === 'react') {
      const recent = await queryOne<{ count: number }>(client, `select count(*)::int as count from public.game_events
        where room_id = $1 and actor_player_id = $2 and event_type = 'reaction'
          and created_at > now() - interval '3 seconds'`, [room.room_id, member.id]);
      if ((recent?.count ?? 0) > 0) throw new RoomServiceError('RATE_LIMITED', 'Wait before reacting again', 429);
    }
    const result = transition(room.internal_state, command, { now: this.now(), random: this.random });
    if (!result.ok) {
      throw new RoomServiceError(
        result.rejection.code,
        result.rejection.message,
        transitionErrorStatus(result.rejection.code),
        result.state.phaseVersion,
      );
    }
    await this.insertNormalizedVote(client, room.room_id, command);
    room.internal_state = result.state;
    room.phase_version = result.state.phaseVersion;
    room.revision = result.state.revision;
    room.deadline_at = result.state.phaseDeadlineAt ? new Date(result.state.phaseDeadlineAt) : null;
    await this.persistGameState(client, room, command.commandId, authUserId, command.expectedPhaseVersion, result.events, member.id);
    const currentMember = await this.memberById(client, room.room_id, member.id);
    return this.snapshotInTransaction(client, room, currentMember ?? member);
  }

  private async applyLobbyCommand(client: SqlClient, room: RoomRow, member: MemberRow, authUserId: string, command: LobbyCommand): Promise<RoomSnapshot> {
    const publicState = await this.publicState(client, room.room_id);
    const isHost = room.host_player_id === member.id;
    const endedGame = Boolean(room.internal_state?.phase === 'ended');
    const rematchState = isGameRoomState(publicState) ? publicState.rematch ?? null : null;
    const rematchCommand = command.type === 'proposeRematch' || command.type === 'startRematch';

    if (room.internal_state && !(endedGame && (rematchCommand || (command.type === 'setReady' && rematchState)))) {
      throw new RoomServiceError('GAME_ALREADY_STARTED', 'Lobby settings cannot change during a game', 409);
    }
    if (!room.internal_state && rematchCommand) {
      throw new RoomServiceError('INVALID_PHASE', 'Rematches are available only after a game ends', 409);
    }

    if (command.type === 'setReady' && endedGame) {
      if (!rematchState) throw new RoomServiceError('REMATCH_NOT_PROPOSED', 'A rematch must be proposed first', 409);
      if (member.is_spectator) throw new RoomServiceError('SPECTATOR_READ_ONLY', 'Spectators cannot ready up', 403);
      await client.query('update public.room_players set ready = $2, last_seen = now() where id = $1', [member.id, command.ready]);
      member.ready = command.ready;
      const readyRows = await client.query<{ id: string }>(`select id from public.room_players
        where room_id = $1 and kicked_at is null and is_spectator = false and ready = true order by joined_order`, [room.room_id]);
      const updatedRematch: RematchState = { ...rematchState, readyPlayerIds: readyRows.rows.map(({ id }) => id) };
      await this.writeGameRematchProjection(client, room, updatedRematch);
      await this.recordCommand(client, room.room_id, command.commandId, authUserId, command.expectedPhaseVersion, { revision: room.revision, phaseVersion: room.phase_version });
      return this.snapshotInTransaction(client, room, member);
    }

    const lobby = isLobby(publicState) ? publicState : null;
    if (!lobby && !rematchCommand) throw new RoomServiceError('INVALID_PHASE', 'Lobby command is unavailable', 409);

    if (command.type === 'setReady') {
      if (member.is_spectator) throw new RoomServiceError('SPECTATOR_READ_ONLY', 'Spectators cannot ready up', 403);
      await client.query('update public.room_players set ready = $2, last_seen = now() where id = $1', [member.id, command.ready]);
      member.ready = command.ready;
    } else if (command.type === 'setLocked') {
      requireHost(isHost);
      lobby!.locked = command.locked;
    } else if (command.type === 'kickPlayer') {
      requireHost(isHost);
      if (command.targetPlayerId === member.id) throw new RoomServiceError('INVALID_TARGET', 'Host cannot kick themselves');
      const target = await queryOne<MemberRow>(client, `update public.room_players set kicked_at = now() where room_id = $1 and id = $2 and kicked_at is null
        returning id, display_name, ready, last_seen, is_spectator`, [room.room_id, command.targetPlayerId]);
      if (!target) throw new RoomServiceError('INVALID_TARGET', 'Player is not in this room', 404);
    } else if (command.type === 'transferHost') {
      requireHost(isHost);
      const target = await queryOne<MemberRow>(client, `select id, display_name, ready, last_seen, is_spectator from public.room_players
        where room_id = $1 and id = $2 and kicked_at is null and is_spectator = false`, [room.room_id, command.targetPlayerId]);
      if (!target) throw new RoomServiceError('INVALID_TARGET', 'Choose an active player as host', 404);
      room.host_player_id = target.id;
      await client.query('update public.game_rooms set host_player_id = $2, updated_at = now() where room_id = $1', [room.room_id, target.id]);
    } else if (command.type === 'setSettings') {
      requireHost(isHost);
      if (command.communicationMode !== 'remote' && command.communicationMode !== 'inPerson') {
        throw new RoomServiceError('INVALID_SETTINGS', 'Choose a supported communication mode');
      }
      lobby!.settings.communicationMode = command.communicationMode;
    } else if (command.type === 'setRolePreset') {
      requireHost(isHost);
      lobby!.rolePreview = this.makeRolePreview(lobby!.players.filter((player) => !player.isSpectator).length, command.preset, command.seed, command.roles);
    } else if (command.type === 'rerollRolePreset') {
      requireHost(isHost);
      const current = lobby!.rolePreview;
      if (!current) throw new RoomServiceError('PRESET_UNAVAILABLE', 'Choose a role preset before rerolling');
      if (current.preset === 'custom') throw new RoomServiceError('PRESET_UNAVAILABLE', 'Custom role sets cannot be rerolled');
      lobby!.rolePreview = this.makeRolePreview(lobby!.players.filter((player) => !player.isSpectator).length, current.preset, command.seed);
    } else if (command.type === 'startGame') {
      requireHost(isHost);
      await this.startGame(client, room, lobby!, member, authUserId, command);
      const currentMember = await this.memberById(client, room.room_id, member.id);
      return this.snapshotInTransaction(client, room, currentMember ?? member);
    } else if (command.type === 'proposeRematch') {
      if (!endedGame || !room.internal_state) throw new RoomServiceError('INVALID_PHASE', 'Rematches are available only after a game ends', 409);
      if (member.is_spectator) throw new RoomServiceError('SPECTATOR_READ_ONLY', 'Spectators cannot propose a rematch', 403);
      requireHost(isHost);
      await client.query(`update public.room_players set ready = (id = $2) where room_id = $1 and kicked_at is null and is_spectator = false`, [room.room_id, member.id]);
      member.ready = true;
      const rematch: RematchState = { proposedBy: member.id, readyPlayerIds: [member.id] };
      await this.writeGameRematchProjection(client, room, rematch);
    } else if (command.type === 'startRematch') {
      requireHost(isHost);
      if (!endedGame || !room.internal_state || !rematchState) throw new RoomServiceError('REMATCH_NOT_PROPOSED', 'A rematch must be proposed first', 409);
      await this.startRematch(client, room, member, authUserId, command, rematchState);
      const currentMember = await this.memberById(client, room.room_id, member.id);
      return this.snapshotInTransaction(client, room, currentMember ?? member);
    }

    if (lobby) {
      await this.touchLobbyRevision(client, room);
      const projected = await this.writeLobbyProjection(client, room, lobby);
      await this.recordCommand(client, room.room_id, command.commandId, authUserId, command.expectedPhaseVersion, { revision: room.revision, phaseVersion: room.phase_version });
      return { room: projected, private: null, player: seatFrom(member), serverNow: this.now() };
    }

    await this.recordCommand(client, room.room_id, command.commandId, authUserId, command.expectedPhaseVersion, { revision: room.revision, phaseVersion: room.phase_version });
    return this.snapshotInTransaction(client, room, member);
  }

  private async startGame(client: SqlClient, room: RoomRow, lobby: LobbyPublicState, member: MemberRow, authUserId: string, command: LobbyCommand) {
    const active = await client.query<MemberRow>(`select id, display_name, ready, last_seen, is_spectator from public.room_players
      where room_id = $1 and kicked_at is null and is_spectator = false order by joined_order`, [room.room_id]);
    if (active.rows.length < 5 || active.rows.length > 10) throw new RoomServiceError('INVALID_PLAYER_COUNT', 'A game needs 5-10 active players');
    if (active.rows.some((player) => !player.ready)) throw new RoomServiceError('PLAYERS_NOT_READY', 'All players must be ready');
    const roles = lobby.rolePreview?.roles;
    if (!roles || !isRoleSetValid(roles, active.rows.length)) throw new RoomServiceError('INVALID_ROLES', 'Choose a valid role preview before starting');
    const shuffled = shuffle(roles, this.random);
    const state = createGameState({
      id: room.room_id,
      players: active.rows.map((player, index) => ({ id: player.id, name: player.display_name, role: shuffled[index]! })),
      leaderId: active.rows.find((player) => player.id === room.host_player_id)?.id ?? active.rows[0]!.id,
      now: this.now(),
    });
    state.revision = room.revision + 1;
    room.internal_state = state;
    room.phase_version = state.phaseVersion;
    room.revision = state.revision;
    room.deadline_at = state.phaseDeadlineAt ? new Date(state.phaseDeadlineAt) : null;
    await client.query('update public.room_players set ready = false where room_id = $1 and kicked_at is null and is_spectator = false', [room.room_id]);
    await this.persistGameState(client, room, command.commandId, authUserId, command.expectedPhaseVersion, [], member.id);
  }

  private async startRematch(
    client: SqlClient,
    room: RoomRow,
    member: MemberRow,
    authUserId: string,
    command: LobbyCommand,
    rematch: RematchState,
  ) {
    const previous = room.internal_state;
    if (!previous || previous.phase !== 'ended') throw new RoomServiceError('INVALID_PHASE', 'The game has not ended', 409);
    const active = await client.query<MemberRow>(`select id, display_name, ready, last_seen, is_spectator from public.room_players
      where room_id = $1 and kicked_at is null and is_spectator = false order by joined_order`, [room.room_id]);
    if (active.rows.length < 5 || active.rows.length > 10) throw new RoomServiceError('INVALID_PLAYER_COUNT', 'A game needs 5-10 active players');
    if (active.rows.some((player) => !player.ready || !rematch.readyPlayerIds.includes(player.id))) {
      throw new RoomServiceError('PLAYERS_NOT_READY', 'All active players must opt in before the rematch starts');
    }
    const priorRoles = new Map(previous.players.map(({ id, role }) => [id, role]));
    const roles = active.rows.map((player) => priorRoles.get(player.id));
    if (roles.some((role) => !role) || !isRoleSetValid(roles as GameRole[], active.rows.length)) {
      throw new RoomServiceError('INVALID_ROLES', 'The previous role set cannot be used for this rematch', 409);
    }
    const shuffled = shuffle(roles as GameRole[], this.random);
    const state = createGameState({
      id: room.room_id,
      players: active.rows.map((player, index) => ({ id: player.id, name: player.display_name, role: shuffled[index]! })),
      leaderId: active.rows.find((player) => player.id === room.host_player_id)?.id ?? active.rows[0]!.id,
      now: this.now(),
    });
    state.phaseVersion = previous.phaseVersion + 1;
    state.revision = room.revision + 1;
    room.internal_state = state;
    room.phase_version = state.phaseVersion;
    room.revision = state.revision;
    room.deadline_at = state.phaseDeadlineAt === null ? null : new Date(state.phaseDeadlineAt);
    await client.query('delete from public.team_votes where room_id = $1', [room.room_id]);
    await client.query('delete from public.execution_votes where room_id = $1', [room.room_id]);
    // Role assignments can move between seats; clear old secret rows before
    // reinserting so immediate one-SM/one-task-delayer indexes never see a transient duplicate.
    await client.query('delete from public.player_secrets where room_id = $1', [room.room_id]);
    await client.query(`delete from public.room_messages where room_id = $1 and audience = 'bad'`, [room.room_id]);
    await client.query('update public.room_players set ready = false where room_id = $1 and kicked_at is null and is_spectator = false', [room.room_id]);
    member.ready = false;
    await this.persistGameState(client, room, command.commandId, authUserId, command.expectedPhaseVersion, [], member.id);
  }

  private async catchUpDuePhase(client: SqlClient, room: RoomRow): Promise<void> {
    for (let transitions = 0; transitions < 100; transitions += 1) {
      const state = room.internal_state;
      if (!state?.phaseDeadlineAt || state.phaseDeadlineAt > this.now()) return;
      const command = {
        commandId: randomUUID(), actorId: null, expectedPhaseVersion: state.phaseVersion, type: 'expirePhase' as const,
      };
      const result = transition(state, command, { now: this.now(), random: this.random });
      if (!result.ok) return;
      room.internal_state = result.state;
      room.phase_version = result.state.phaseVersion;
      room.revision = result.state.revision;
      room.deadline_at = result.state.phaseDeadlineAt ? new Date(result.state.phaseDeadlineAt) : null;
      await this.persistGameState(client, room, command.commandId, null, command.expectedPhaseVersion, result.events, null);
    }
    if (room.internal_state?.phaseDeadlineAt && room.internal_state.phaseDeadlineAt <= this.now()) {
      throw new RoomServiceError('PHASE_CATCHUP_LIMIT', 'Room phase catch-up limit reached', 503);
    }
  }

  private async persistGameState(
    client: SqlClient,
    room: RoomRow,
    commandId: string,
    authUserId: string | null,
    expectedPhaseVersion: number,
    events: readonly GameEvent[],
    actorPlayerId: string | null,
  ) {
    const state = room.internal_state;
    if (!state) throw new RoomServiceError('MISSING_STATE', 'Game state is missing', 500);
    const previousPublicState = await this.publicState(client, room.room_id);
    const publicState: PublicGameRoomState = {
      ...projectPublicGameState(state),
      hostPlayerId: room.host_player_id ?? '',
      settings: previousPublicState.settings ?? { communicationMode: 'remote' },
    };
    await client.query(`update public.game_rooms set internal_state = $2, phase_version = $3, revision = $4, deadline_at = $5, updated_at = now()
      where room_id = $1`, [room.room_id, JSON.stringify(state), state.phaseVersion, state.revision, room.deadline_at]);
    await client.query(`insert into public.room_public_state (room_id, revision, payload) values ($1, $2, $3)
      on conflict (room_id) do update set revision = excluded.revision, payload = excluded.payload`, [room.room_id, state.revision, JSON.stringify(publicState)]);
    for (const player of state.players) {
      const privateState = projectPrivateState(state, player.id).private;
      await client.query(`insert into public.player_secrets (room_id, player_id, role, private_state) values ($1, $2, $3, $4)
        on conflict (room_id, player_id) do update set role = excluded.role, private_state = excluded.private_state`,
      [room.room_id, player.id, player.role, JSON.stringify(privateState)]);
    }
    await this.recordCommand(client, room.room_id, commandId, authUserId, expectedPhaseVersion, { revision: state.revision, phaseVersion: state.phaseVersion });
    for (const event of events.map(projectPublicEvent).filter((item): item is GameEvent => item !== null)) {
      await client.query(`insert into public.game_events (room_id, sequence, command_id, phase_version, actor_player_id, event_type, public_payload)
        values ($1, nextval('public.game_events_sequence_seq'), $2, $3, $4, $5, $6)`,
      [room.room_id, commandId, state.phaseVersion, actorPlayerId, event.type, JSON.stringify(event.data)]);
    }
  }

  private async insertNormalizedVote(client: SqlClient, roomId: string, command: GameCommand): Promise<void> {
    if (command.type === 'castTeamVote') {
      const inserted = await queryOne<{ player_id: string }>(client, `insert into public.team_votes (room_id, phase_version, player_id, vote)
        values ($1, $2, $3, $4) on conflict do nothing returning player_id`, [roomId, command.expectedPhaseVersion, command.actorId, command.vote]);
      if (!inserted) throw new RoomServiceError('ALREADY_VOTED', 'You already voted in this phase', 409);
    }
    if (command.type === 'castExecutionVote') {
      const inserted = await queryOne<{ player_id: string }>(client, `insert into public.execution_votes (room_id, phase_version, player_id, vote)
        values ($1, $2, $3, $4) on conflict do nothing returning player_id`, [roomId, command.expectedPhaseVersion, command.actorId, command.vote]);
      if (!inserted) throw new RoomServiceError('ALREADY_VOTED', 'You already voted in this phase', 409);
    }
  }

  private async snapshotInTransaction(client: SqlClient, room: RoomRow, member: MemberRow): Promise<RoomSnapshot> {
    const publicState = await this.publicState(client, room.room_id);
    const privateRow = member.is_spectator || !room.internal_state ? null : await queryOne<{ private_state: ViewerPrivateState }>(client,
      'select private_state from public.player_secrets where room_id = $1 and player_id = $2', [room.room_id, member.id]);
    return { room: publicState, private: privateRow?.private_state ?? null, player: seatFrom(member), serverNow: this.now() };
  }

  private async lockRoom(client: SqlClient, roomId: string): Promise<RoomRow> {
    assertRoomId(roomId);
    const result = await queryOne<RoomRow>(client, `select room_id, host_player_id, phase_version, revision, internal_state, deadline_at
      from public.game_rooms where room_id = $1 for update`, [roomId]);
    if (!result) throw new RoomServiceError('ROOM_NOT_FOUND', 'Room not found', 404);
    const room = normalizeRoomRow(result);
    await this.maybeTransferHost(client, room);
    return room;
  }

  private async maybeTransferHost(client: SqlClient, room: RoomRow): Promise<void> {
    if (room.internal_state && room.internal_state.phase !== 'ended') return;
    const host = room.host_player_id ? await queryOne<{ last_seen: Date | null }>(client,
      'select last_seen from public.room_players where room_id = $1 and id = $2 and kicked_at is null and is_spectator = false',
      [room.room_id, room.host_player_id],
    ) : null;
    if (host?.last_seen && this.now() - host.last_seen.getTime() <= 60_000) return;
    const successor = await queryOne<{ id: string }>(client, `select id from public.room_players
      where room_id = $1 and kicked_at is null and is_spectator = false
        and last_seen >= now() - interval '45 seconds'
      order by joined_order limit 1`, [room.room_id]);
    if (!successor || successor.id === room.host_player_id) return;

    room.host_player_id = successor.id;
    room.revision += 1;
    if (room.internal_state) room.internal_state.revision = room.revision;
    await client.query(`update public.game_rooms
      set host_player_id = $2, revision = $3, internal_state = $4, updated_at = now()
      where room_id = $1`, [room.room_id, successor.id, room.revision,
      room.internal_state ? JSON.stringify(room.internal_state) : null]);
    const previous = await this.publicState(client, room.room_id);
    if (isLobby(previous)) {
      await this.writeLobbyProjection(client, room, previous);
    } else {
      const projected: PublicGameRoomState = { ...previous, hostPlayerId: successor.id, revision: room.revision };
      await client.query(`update public.room_public_state set revision = $2, payload = $3 where room_id = $1`,
        [room.room_id, room.revision, JSON.stringify(projected)]);
    }
  }

  private async requireMember(client: SqlClient, roomId: string, authUserId: string): Promise<MemberRow> {
    const member = await this.memberForAuth(client, roomId, authUserId);
    if (!member) throw new RoomServiceError('NOT_A_MEMBER', 'Join this room before accessing it', 403);
    return member;
  }

  private async memberForAuth(client: SqlClient, roomId: string, authUserId: string): Promise<MemberRow | null> {
    return queryOne<MemberRow>(client, `select id, display_name, ready, last_seen, is_spectator from public.room_players
      where room_id = $1 and auth_user_id = $2 and kicked_at is null`, [roomId, authUserId]);
  }

  private async memberById(client: SqlClient, roomId: string, playerId: string): Promise<MemberRow | null> {
    return queryOne<MemberRow>(client, `select id, display_name, ready, last_seen, is_spectator from public.room_players
      where room_id = $1 and id = $2 and kicked_at is null`, [roomId, playerId]);
  }

  private async publicState(client: SqlClient, roomId: string): Promise<PublicRoomState> {
    const row = await queryOne<StoredPublicRow>(client, 'select payload from public.room_public_state where room_id = $1', [roomId]);
    if (!row?.payload) throw new RoomServiceError('MISSING_PUBLIC_STATE', 'Room state is unavailable', 500);
    return row.payload;
  }

  private async writeLobbyProjection(client: SqlClient, room: RoomRow, prior: PublicRoomState | null): Promise<LobbyPublicState> {
    const players = await client.query<MemberRow>(`select id, display_name, ready, last_seen, is_spectator from public.room_players
      where room_id = $1 and kicked_at is null order by joined_order`, [room.room_id]);
    const existing = isLobby(prior) ? prior : null;
    const activePlayerCount = players.rows.filter((player) => !player.is_spectator).length;
    const rolePreview = existing?.rolePreview
      ? this.refreshRolePreview(existing.rolePreview, activePlayerCount)
      : null;
    const lobby: LobbyPublicState = {
      id: room.room_id,
      phase: 'lobby',
      phaseVersion: room.phase_version,
      revision: room.revision,
      locked: existing?.locked ?? false,
      hostPlayerId: room.host_player_id ?? '',
      players: players.rows.map((player) => ({
        id: player.id, name: player.display_name, ready: player.ready,
        presence: player.last_seen && this.now() - player.last_seen.getTime() < 45_000 ? 'online' : 'away',
        isSpectator: player.is_spectator,
      })),
      settings: existing?.settings ?? { communicationMode: 'remote' },
      rolePreview,
      rematch: existing?.rematch ?? null,
    };
    await client.query(`insert into public.room_public_state (room_id, revision, payload) values ($1, $2, $3)
      on conflict (room_id) do update set revision = excluded.revision, payload = excluded.payload`, [room.room_id, room.revision, JSON.stringify(lobby)]);
    return lobby;
  }

  private async touchLobbyRevision(client: SqlClient, room: RoomRow): Promise<void> {
    room.revision += 1;
    await client.query('update public.game_rooms set revision = $2, updated_at = now() where room_id = $1', [room.room_id, room.revision]);
  }

  private makeRolePreview(playerCount: number, preset: LobbyPreset, rawSeed?: string, customRoles?: GameRole[]) {
    if (!isLobbyPreset(preset)) throw new RoomServiceError('INVALID_PRESET', 'Choose a supported role preset');
    const seed = normalizeSeed(rawSeed);
    if (preset === 'custom') {
      if (playerCount < 5 || playerCount > 10) throw new RoomServiceError('INVALID_PLAYER_COUNT', 'Custom roles require 5-10 active players');
      if (!customRoles || !isCustomRoleSetValid(customRoles, playerCount)) throw new RoomServiceError('INVALID_ROLES', 'Choose a valid role set');
      return { preset, roles: [...customRoles], seed };
    }
    if (customRoles !== undefined) throw new RoomServiceError('INVALID_ROLES', 'Only custom presets accept a role list');
    if (playerCount < 5 || playerCount > 10) return { preset, roles: [] as GameRole[], seed };
    return { preset, roles: previewPreset({ mode: preset, playerCount, seed: seedToNumber(seed) }), seed };
  }

  private refreshRolePreview(
    current: NonNullable<LobbyPublicState['rolePreview']>,
    playerCount: number,
  ): NonNullable<LobbyPublicState['rolePreview']> {
    if (current.preset === 'custom') {
      return { ...current, roles: isCustomRoleSetValid(current.roles, playerCount) ? [...current.roles] : [] };
    }
    return this.makeRolePreview(playerCount, current.preset, current.seed);
  }

  private async writeGameRematchProjection(client: SqlClient, room: RoomRow, rematch: RematchState): Promise<void> {
    const state = room.internal_state;
    if (!state || state.phase !== 'ended') throw new RoomServiceError('INVALID_PHASE', 'Rematches are available only after a game ends', 409);
    room.revision += 1;
    state.revision = room.revision;
    await client.query('update public.game_rooms set revision = $2, internal_state = $3, updated_at = now() where room_id = $1',
      [room.room_id, room.revision, JSON.stringify(state)]);
    const previousPublicState = await this.publicState(client, room.room_id);
    const payload: PublicGameRoomState = {
      ...projectPublicGameState(state), hostPlayerId: room.host_player_id ?? '',
      settings: previousPublicState.settings ?? { communicationMode: 'remote' }, rematch,
    };
    await client.query(`insert into public.room_public_state (room_id, revision, payload) values ($1, $2, $3)
      on conflict (room_id) do update set revision = excluded.revision, payload = excluded.payload`,
    [room.room_id, state.revision, JSON.stringify(payload)]);
  }

  private async recordCommand(client: SqlClient, roomId: string, commandId: string, authUserId: string | null, expectedPhaseVersion: number, result: unknown): Promise<void> {
    await client.query(`insert into public.applied_commands (room_id, command_id, actor_auth_user_id, expected_phase_version, result, applied_revision)
      values ($1, $2, $3, $4, $5, $6)`, [roomId, commandId, authUserId, expectedPhaseVersion, JSON.stringify(result), (result as { revision?: number }).revision ?? 0]);
  }

  private async assertAudience(client: SqlClient, room: RoomRow, member: MemberRow, audience: 'public' | 'bad') {
    if (audience === 'public') return;
    if (!room.internal_state || member.is_spectator) throw new RoomServiceError('CHAT_FORBIDDEN', 'Bad-team chat is unavailable', 403);
    const secret = await queryOne<{ role: GameRole }>(client, 'select role from public.player_secrets where room_id = $1 and player_id = $2', [room.room_id, member.id]);
    if (!secret || factionForRole(secret.role) !== 'bad') throw new RoomServiceError('CHAT_FORBIDDEN', 'Bad-team chat is unavailable', 403);
  }

  private assertChatAllowed(room: RoomRow, playerId: string) {
    const policy = room.internal_state?.chatPolicy;
    if (policy && (policy.allMuted || policy.mutedPlayerId === playerId)) {
      throw new RoomServiceError('CHAT_SILENCED', 'Chat is disabled for you in this phase', 403);
    }
  }
}

export function roomService(): RoomService {
  return new RoomService();
}

function assertRoomId(roomId: string) {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(roomId)) throw new RoomServiceError('INVALID_ROOM_ID', 'Room id must be 3-64 letters, numbers, underscores, or dashes');
}

function normalizeDisplayName(value: string): string {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 20) throw new RoomServiceError('INVALID_NAME', 'Name must be 1-20 characters');
  return name;
}

function assertCommand(value: CommandInput): asserts value is CommandInput & { commandId: string; expectedPhaseVersion: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RoomServiceError('INVALID_COMMAND', 'Command must be an object');
  }
  const candidate = value as unknown as Record<string, unknown>;
  if ('actorId' in candidate || 'playerId' in candidate) {
    throw new RoomServiceError('INVALID_COMMAND', 'Actor identity is assigned from the bearer token');
  }
  if (typeof candidate.type !== 'string') throw new RoomServiceError('INVALID_COMMAND', 'Command type is required');
  assertCommandId(candidate.commandId);
  if (!Number.isSafeInteger(candidate.expectedPhaseVersion) || (candidate.expectedPhaseVersion as number) < 0) {
    throw new RoomServiceError('INVALID_COMMAND', 'expectedPhaseVersion must be a non-negative integer');
  }

  switch (candidate.type) {
    case 'setReady':
    case 'setLocked':
      if (typeof candidate[candidate.type === 'setReady' ? 'ready' : 'locked'] !== 'boolean') {
        throw new RoomServiceError('INVALID_COMMAND', `${candidate.type === 'setReady' ? 'ready' : 'locked'} must be a boolean`);
      }
      return;
    case 'kickPlayer':
    case 'transferHost':
      assertPlayerId(candidate.targetPlayerId, 'targetPlayerId');
      return;
    case 'setSettings':
      if (candidate.communicationMode !== 'remote' && candidate.communicationMode !== 'inPerson') {
        throw new RoomServiceError('INVALID_COMMAND', 'communicationMode is invalid');
      }
      return;
    case 'setRolePreset':
      if (!isLobbyPreset(candidate.preset)) throw new RoomServiceError('INVALID_COMMAND', 'preset is invalid');
      assertOptionalSeed(candidate.seed);
      if (candidate.roles !== undefined) assertRoleList(candidate.roles);
      return;
    case 'rerollRolePreset':
      assertOptionalSeed(candidate.seed);
      return;
    case 'startGame':
    case 'proposeRematch':
    case 'startRematch':
      return;
    case 'setTtsTarget':
    case 'useBossSilence':
    case 'useDaCheck':
    case 'guessScrumMaster':
      assertPlayerId(candidate.targetId, 'targetId');
      return;
    case 'setTeam':
    case 'finalizeTeam':
    case 'usePmOverride':
      assertPlayerIdList(candidate.teamIds, 'teamIds');
      return;
    case 'castTeamVote':
      if (candidate.vote !== 'approve' && candidate.vote !== 'reject') throw new RoomServiceError('INVALID_COMMAND', 'vote is invalid');
      return;
    case 'castExecutionVote':
      if (candidate.vote !== 'success' && candidate.vote !== 'fail') throw new RoomServiceError('INVALID_COMMAND', 'vote is invalid');
      return;
    case 'react':
      if (!['🤨', '😂', '💀', '🔥', '👀', '🤡'].includes(String(candidate.emoji))) {
        throw new RoomServiceError('INVALID_COMMAND', 'emoji is invalid');
      }
      if (candidate.targetType === 'player') assertPlayerId(candidate.targetPlayerId, 'targetPlayerId');
      else if ((candidate.targetType !== 'proposal' && candidate.targetType !== 'sprintResult')
        || candidate.targetPlayerId !== undefined) throw new RoomServiceError('INVALID_COMMAND', 'reaction target is invalid');
      return;
    case 'useBaCheck':
      if (!Array.isArray(candidate.targetIds) || candidate.targetIds.length !== 2) {
        throw new RoomServiceError('INVALID_COMMAND', 'targetIds must contain two player ids');
      }
      assertPlayerId(candidate.targetIds[0], 'targetIds[0]');
      assertPlayerId(candidate.targetIds[1], 'targetIds[1]');
      return;
    case 'useDeadlineSilence':
    case 'useQcRedo':
      return;
    case 'resolveTeamVote':
    case 'resolveExecution':
    case 'expirePhase':
      throw new RoomServiceError('SYSTEM_COMMAND', 'System commands cannot be submitted by players', 403);
    default:
      throw new RoomServiceError('INVALID_COMMAND', 'Unknown command type');
  }
}

function assertCommandId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    throw new RoomServiceError('INVALID_COMMAND', 'commandId must be a UUID');
  }
}

function assertPlayerId(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    throw new RoomServiceError('INVALID_COMMAND', `${field} must be a player UUID`);
  }
}

function assertPlayerIdList(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))) {
    throw new RoomServiceError('INVALID_COMMAND', `${field} must contain player UUIDs`);
  }
}

function assertOptionalSeed(value: unknown): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== 'string' || value.length < 1 || value.length > 128)) {
    throw new RoomServiceError('INVALID_COMMAND', 'seed must be a 1-128 character string');
  }
}

function assertRoleList(value: unknown): asserts value is GameRole[] {
  if (!Array.isArray(value) || value.some((role) => !isGameRole(role))) {
    throw new RoomServiceError('INVALID_COMMAND', 'roles must contain supported game roles');
  }
}

function isLobby(value: PublicRoomState | null): value is LobbyPublicState {
  return Boolean(value && value.phase === 'lobby');
}

function isGameRoomState(value: PublicRoomState): value is PublicGameRoomState {
  return value.phase !== 'lobby';
}

function isLobbyCommand(command: CommandInput): command is LobbyCommand {
  return ['setReady', 'setLocked', 'kickPlayer', 'transferHost', 'setSettings', 'setRolePreset', 'rerollRolePreset', 'startGame', 'proposeRematch', 'startRematch'].includes(command.type);
}

function requireHost(isHost: boolean) {
  if (!isHost) throw new RoomServiceError('NOT_HOST', 'Only the host can do that', 403);
}

function transitionErrorStatus(code: TransitionRejectionCode): number {
  if (code === 'NOT_AUTHORIZED' || code === 'UNKNOWN_ACTOR') return 403;
  if (code === 'STALE_PHASE' || code === 'INVALID_PHASE' || code === 'ALREADY_VOTED' || code === 'PHASE_EXPIRED') return 409;
  return 400;
}

function seatFrom(member: MemberRow): ViewerSeat {
  return { id: member.id, displayName: member.display_name, ready: member.ready, isSpectator: member.is_spectator };
}

function normalizeRoomRow(room: RoomRow): RoomRow {
  const phaseVersion = Number(room.phase_version);
  const revision = Number(room.revision);
  if (!Number.isSafeInteger(phaseVersion) || !Number.isSafeInteger(revision)) {
    throw new RoomServiceError('INVALID_ROOM_STATE', 'Stored room version is invalid', 500);
  }
  const state = room.internal_state && typeof room.internal_state === 'object' && 'phase' in room.internal_state
    ? room.internal_state
    : null;
  return { ...room, phase_version: phaseVersion, revision, internal_state: state };
}

function normalizeSeed(value?: string): string {
  if (value === undefined) return randomUUID();
  if (value.length < 1 || value.length > 128) throw new RoomServiceError('INVALID_SEED', 'seed must be 1-128 characters');
  return value;
}

function seedToNumber(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function isLobbyPreset(value: unknown): value is LobbyPreset {
  return value === 'beginner' || value === 'classic' || value === 'advanced' || value === 'chaos' || value === 'custom';
}

function isGameRole(value: unknown): value is GameRole {
  return typeof value === 'string' && [
    'Scrum Master', 'Project Manager', 'Developer', 'Business Analyst', 'Quality Controller',
    'Technical Leader', 'Data Analyst', 'Thực tập sinh', 'Người trễ task', 'Client',
    'Ông sếp khó ưa', 'Kẻ fake CV', 'QC cẩu thả', 'Deadline', 'Technical Debt',
  ].includes(value);
}

function isCustomRoleSetValid(roles: readonly GameRole[], playerCount: number): boolean {
  const singleInstanceRoles = roles.filter((role) => role !== 'Developer');
  return roles.every(isGameRole)
    && new Set(singleInstanceRoles).size === singleInstanceRoles.length
    && isRoleSetValid(roles, playerCount);
}

function assertAudienceValue(value: unknown): asserts value is 'public' | 'bad' {
  if (value !== 'public' && value !== 'bad') throw new RoomServiceError('INVALID_AUDIENCE', 'Audience must be public or bad');
}

function projectPublicGameState(state: GameState): PublicGameState {
  const projected = projectState(state);
  projected.publicEvents = state.publicEvents.map(projectPublicEvent).filter((event): event is GameEvent => event !== null);
  return projected;
}

function projectPublicEvent(event: GameEvent): GameEvent | null {
  if (!event || event.visibility !== 'public' || !event.data || typeof event.data !== 'object') return null;
  const pick = (...keys: string[]) => Object.fromEntries(keys
    .filter((key) => Object.prototype.hasOwnProperty.call(event.data, key))
    .map((key) => [key, event.data[key]]));
  switch (event.type) {
    case 'phaseChanged':
      return ['roleReveal', 'firstNight', 'planningDiscussion', 'teamSelection', 'teamVoting', 'teamVoteReveal', 'execution', 'executionReveal', 'sprintResult', 'assassination', 'ended'].includes(String(event.data.phase))
        ? { type: event.type, visibility: 'public', data: { phase: event.data.phase } }
        : null;
    case 'teamAccepted':
    case 'teamRejected':
      if (!isNonNegativeInteger(event.data.approveWeight) || !isNonNegativeInteger(event.data.rejectWeight)) return null;
      return { type: event.type, visibility: 'public', data: pick('approveWeight', 'rejectWeight') };
    case 'sprintResolved':
      if ((event.data.outcome !== 'success' && event.data.outcome !== 'fail')
        || !isNonNegativeInteger(event.data.goodWins) || !isNonNegativeInteger(event.data.badWins)) return null;
      return { type: event.type, visibility: 'public', data: pick('outcome', 'goodWins', 'badWins') };
    case 'gameEnded':
      if ((event.data.winner !== 'good' && event.data.winner !== 'bad')
        || !['threeFailedSprints', 'fourRejectedTeams', 'assassinationGuess', 'assassinationDeadline', 'fiveSprintTiebreak'].includes(String(event.data.reason))) return null;
      return { type: event.type, visibility: 'public', data: pick('winner', 'reason') };
    case 'skillUsed':
      return ['pmOverride', 'bossSilence', 'deadlineSilence', 'baCheck', 'daCheck', 'qcRedo'].includes(String(event.data.skill))
        ? { type: event.type, visibility: 'public', data: { skill: event.data.skill } }
        : null;
    case 'reaction':
      if (typeof event.data.actorPlayerId !== 'string'
        || !['🤨', '😂', '💀', '🔥', '👀', '🤡'].includes(String(event.data.emoji))
        || !['player', 'proposal', 'sprintResult'].includes(String(event.data.targetType))) return null;
      return { type: event.type, visibility: 'public', data: pick('actorPlayerId', 'emoji', 'targetType', 'targetPlayerId') };
    default:
      return null;
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function messageDto(message: { sequence: string; room_id: string; audience: 'public' | 'bad'; sender_player_id: string; text: string; created_at: Date }) {
  const sequence = Number(message.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new RoomServiceError('INVALID_MESSAGE_SEQUENCE', 'Stored message sequence is invalid', 500);
  return { sequence, roomId: message.room_id, audience: message.audience, senderPlayerId: message.sender_player_id, text: message.text, createdAt: message.created_at.toISOString() };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function secureRandom(): number {
  return randomInt(0, 0x1_0000_0000) / 0x1_0000_0000;
}

async function safeRollback(client: SqlClient) {
  try { await client.query('ROLLBACK'); } catch { /* transaction did not start */ }
}
