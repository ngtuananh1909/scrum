import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import { projectState, type GameRole, type GameState } from '@/game';
import { POST as createRoom } from '@/app/api/rooms/route';
import { POST as joinRoom } from '@/app/api/rooms/[id]/join/route';
import { GET as getRoom } from '@/app/api/rooms/[id]/route';
import { POST as postCommand } from '@/app/api/rooms/[id]/commands/route';
import { databasePool } from '@/server/db';
import { RoomService, type RoomSnapshot } from '@/server/room-service';

const createdRoomIds: string[] = [];
const createdAuthUserIds: string[] = [];

afterEach(async () => {
  if (createdRoomIds.length > 0) {
    await databasePool().query('delete from public.game_rooms where room_id = any($1::text[])', [createdRoomIds]);
    createdRoomIds.length = 0;
  }
  if (createdAuthUserIds.length > 0) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    for (const authUserId of createdAuthUserIds.splice(0)) await admin.auth.admin.deleteUser(authUserId);
  }
});

describe('secure room routes', () => {
  it('requires a verified bearer token and binds the created seat to that subject', async () => {
    const unauthenticated = await createRoom(jsonRequest('/api/rooms', { roomId: 'CORE001', playerName: 'Host' }));
    expect(unauthenticated.status).toBe(401);

    const host = await createAuthUser();
    const roomId = newRoomId();
    const callerChosenId = randomUUID();
    const response = await createRoom(authenticatedRequest('/api/rooms', host.accessToken, {
      method: 'POST',
      body: { roomId, playerName: ' Host   Name ', playerId: callerChosenId },
    }));
    const snapshot = await response.json();

    expect(response.status).toBe(200);
    expect(snapshot.room.id).toBe(roomId);
    expect(snapshot.player.id).not.toBe(callerChosenId);
    expect(snapshot.player.displayName).toBe('Host Name');
    const stored = await databasePool().query<{ auth_user_id: string; id: string; display_name: string }>(
      'select auth_user_id, id, display_name from public.room_players where room_id = $1',
      [roomId],
    );
    expect(stored.rows).toEqual([{ auth_user_id: host.authUserId, id: snapshot.player.id, display_name: 'Host Name' }]);

    const outsider = await createAuthUser();
    const outsiderRead = await getRoom(authenticatedRequest(`/api/rooms/${roomId}`, outsider.accessToken), {
      params: Promise.resolve({ id: roomId }),
    });
    expect(outsiderRead.status).toBe(403);
  });

  it('applies host and ready controls with command idempotency and stable seats', async () => {
    const host = await createAuthUser();
    const hostSeat = await createRoomSeat(host, 'Host');
    const roomId = hostSeat.roomId;
    const guest = await createAuthUser();
    const guestSeat = await joinRoomSeat(roomId, guest, 'Guest');
    const duplicateNameUser = await createAuthUser();
    const duplicateName = await joinRoom(authenticatedRequest(`/api/rooms/${roomId}/join`, duplicateNameUser.accessToken, {
      method: 'POST', body: { playerName: '  gUeSt  ' },
    }), { params: Promise.resolve({ id: roomId }) });
    expect(duplicateName.status).toBe(409);
    expect((await duplicateName.json()).code).toBe('PLAYER_NAME_TAKEN');

    const forgedActor = await sendCommand(roomId, guest.accessToken, {
      type: 'setReady', commandId: randomUUID(), expectedPhaseVersion: 0,
      ready: true, actorId: hostSeat.snapshot.player.id,
    });
    expect(forgedActor.status).toBe(400);

    const lockedCommandId = randomUUID();
    const lockBody = { type: 'setLocked', commandId: lockedCommandId, expectedPhaseVersion: 0, locked: true };
    const locked = await sendCommand(roomId, host.accessToken, lockBody);
    expect(locked.status).toBe(200);
    expect((await locked.json()).room.locked).toBe(true);

    const guestHostAction = await sendCommand(roomId, guest.accessToken, {
      type: 'setLocked', commandId: randomUUID(), expectedPhaseVersion: 0, locked: false,
    });
    expect(guestHostAction.status).toBe(403);

    const retry = await sendCommand(roomId, host.accessToken, lockBody);
    expect(retry.status).toBe(200);
    const retrySnapshot = await retry.json();
    expect(retrySnapshot.room.locked).toBe(true);
    const commandRows = await databasePool().query<{ count: number }>(
      'select count(*)::int as count from public.applied_commands where room_id = $1 and command_id = $2',
      [roomId, lockedCommandId],
    );
    expect(commandRows.rows[0]?.count).toBe(1);

    const reusedByOtherActor = await sendCommand(roomId, guest.accessToken, lockBody);
    expect(reusedByOtherActor.status).toBe(409);
    expect((await reusedByOtherActor.json()).code).toBe('COMMAND_ID_CONFLICT');

    const staleVersion = await sendCommand(roomId, host.accessToken, {
      type: 'setReady', commandId: randomUUID(), expectedPhaseVersion: 1, ready: true,
    });
    expect(staleVersion.status).toBe(409);
    expect((await staleVersion.json()).code).toBe('STALE_PHASE');

    const blockedJoiner = await createAuthUser();
    const blockedJoin = await joinRoom(authenticatedRequest(`/api/rooms/${roomId}/join`, blockedJoiner.accessToken, {
      method: 'POST', body: { playerName: 'Blocked' },
    }), { params: Promise.resolve({ id: roomId }) });
    expect(blockedJoin.status).toBe(403);

    const unlock = await sendCommand(roomId, host.accessToken, {
      type: 'setLocked', commandId: randomUUID(), expectedPhaseVersion: 0, locked: false,
    });
    expect(unlock.status).toBe(200);
    const inPerson = await sendCommand(roomId, host.accessToken, {
      type: 'setSettings', commandId: randomUUID(), expectedPhaseVersion: 0, communicationMode: 'inPerson',
    });
    expect(inPerson.status).toBe(200);

    const additional = await Promise.all([2, 3, 4].map(async (index) => {
      const user = await createAuthUser();
      const result = await joinRoomSeat(roomId, user, `Player ${index}`);
      return { user, snapshot: result.snapshot };
    }));
    const seats = [hostSeat, guestSeat, ...additional.map(({ snapshot }) => ({ snapshot }))];
    expect(seats.map(({ snapshot }) => snapshot.player.id)).toHaveLength(5);
    expect(new Set(seats.map(({ snapshot }) => snapshot.player.id)).size).toBe(5);

    const customRoles: GameRole[] = ['Scrum Master', 'Business Analyst', 'Thực tập sinh', 'Người trễ task', 'Client'];
    const preset = await sendCommand(roomId, host.accessToken, {
      type: 'setRolePreset', commandId: randomUUID(), expectedPhaseVersion: 0, preset: 'custom', roles: customRoles,
    });
    expect(preset.status).toBe(200);
    expect((await preset.json()).room.rolePreview.roles).toEqual(customRoles);

    for (const { user } of [{ user: host }, { user: guest }, ...additional]) {
      const ready = await sendCommand(roomId, user.accessToken, {
        type: 'setReady', commandId: randomUUID(), expectedPhaseVersion: 0, ready: true,
      });
      expect(ready.status).toBe(200);
    }

    const start = await sendCommand(roomId, host.accessToken, {
      type: 'startGame', commandId: randomUUID(), expectedPhaseVersion: 0,
    });
    const started = await start.json();
    expect(start.status).toBe(200);
    expect(started.room.phase).toBe('roleReveal');
    expect(started.room.players.every((player: Record<string, unknown>) => !('role' in player))).toBe(true);
    expect(started.private.ownRole).toBeTruthy();
    expect(started.room.leaderId).toBe(hostSeat.snapshot.player.id);
    expect(started.room.hostPlayerId).toBe(hostSeat.snapshot.player.id);
    expect(started.room.settings.communicationMode).toBe('inPerson');

    const orderedSeats = await databasePool().query<{ id: string; joined_order: number }>(
      'select id, joined_order from public.room_players where room_id = $1 and is_spectator = false order by joined_order',
      [roomId],
    );
    expect(orderedSeats.rows.map(({ id }) => id)).toEqual(started.room.players.map((player: { id: string }) => player.id));
  });

  it('transfers lobby host authority after the host has been offline for a minute', async () => {
    const host = await createAuthUser();
    const hostSeat = await createRoomSeat(host, 'Host');
    const roomId = hostSeat.roomId;
    const guest = await createAuthUser();
    const guestSeat = await joinRoomSeat(roomId, guest, 'Guest');

    await databasePool().query(
      "update public.room_players set last_seen = now() - interval '61 seconds' where room_id = $1 and id = $2",
      [roomId, hostSeat.snapshot.player.id],
    );
    const read = await getRoom(authenticatedRequest(`/api/rooms/${roomId}`, guest.accessToken), {
      params: Promise.resolve({ id: roomId }),
    });
    expect(read.status).toBe(200);
    expect((await read.json()).room.hostPlayerId).toBe(guestSeat.snapshot.player.id);

    const lock = await sendCommand(roomId, guest.accessToken, {
      type: 'setLocked', commandId: randomUUID(), expectedPhaseVersion: 0, locked: true,
    });
    expect(lock.status).toBe(200);
  });

  it('accepts multiple Developers in a legal custom six-player room', async () => {
    const users = await Promise.all(Array.from({ length: 6 }, () => createAuthUser()));
    const hostSeat = await createRoomSeat(users[0]!, 'Host');
    const roomId = hostSeat.roomId;
    for (let index = 1; index < users.length; index += 1) {
      await joinRoomSeat(roomId, users[index]!, `Player ${index}`);
    }
    const roles: GameRole[] = [
      'Scrum Master', 'Developer', 'Developer', 'Business Analyst', 'Người trễ task', 'Client',
    ];
    const preset = await sendCommand(roomId, users[0]!.accessToken, {
      type: 'setRolePreset', commandId: randomUUID(), expectedPhaseVersion: 0, preset: 'custom', roles,
    });
    expect(preset.status).toBe(200);
    for (const user of users) {
      const ready = await sendCommand(roomId, user.accessToken, {
        type: 'setReady', commandId: randomUUID(), expectedPhaseVersion: 0, ready: true,
      });
      expect(ready.status).toBe(200);
    }
    const started = await sendCommand(roomId, users[0]!.accessToken, {
      type: 'startGame', commandId: randomUUID(), expectedPhaseVersion: 0,
    });
    expect(started.status).toBe(200);
  });

  it('advances the rematch phase version and recreates secret roles without unique-role collisions', async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => createAuthUser()));
    const roles: GameRole[] = ['Scrum Master', 'Business Analyst', 'Developer', 'Người trễ task', 'Client'];
    const roomId = await createStartedRoom(users, roles);
    const ended = await readInternalState(roomId);
    ended.phase = 'ended';
    ended.phaseVersion = 7;
    ended.revision += 1;
    ended.phaseDeadlineAt = null;
    ended.winner = 'good';
    ended.endReason = 'assassinationDeadline';
    await writeInternalState(roomId, ended);

    const proposal = await sendCommand(roomId, users[0]!.accessToken, {
      type: 'proposeRematch', commandId: randomUUID(), expectedPhaseVersion: 7,
    });
    expect(proposal.status).toBe(200);
    for (const user of users) {
      const ready = await sendCommand(roomId, user.accessToken, {
        type: 'setReady', commandId: randomUUID(), expectedPhaseVersion: 7, ready: true,
      });
      expect(ready.status).toBe(200);
    }
    // A zero-valued RNG rotates the five roles by one seat. Both unique roles
    // move, and at least one new holder is persisted before the old holder's
    // seat, so stale secret rows would collide with the unique role index.
    const rematchService = new RoomService({ pool: databasePool(), random: () => 0 });
    const snapshot = await rematchService.command(roomId, users[0]!.authUserId, {
      type: 'startRematch', commandId: randomUUID(), expectedPhaseVersion: 7,
    });
    expect(snapshot.room.phase).toBe('roleReveal');
    expect(snapshot.room.phaseVersion).toBeGreaterThan(ended.phaseVersion);

    const rematched = await readInternalState(roomId);
    expect(rematched.phaseVersion).toBe(snapshot.room.phaseVersion);
    expect(rematched.players.map(({ role }) => role).sort()).toEqual(ended.players.map(({ role }) => role).sort());

    const uniqueRoles: GameRole[] = ['Scrum Master', 'Người trễ task'];
    const uniqueRoleMoves = uniqueRoles.map((role) => ({
      role,
      previousOwnerIndex: ended.players.findIndex((player) => player.role === role),
      nextOwnerIndex: rematched.players.findIndex((player) => player.role === role),
    }));
    expect(uniqueRoleMoves.every(({ previousOwnerIndex, nextOwnerIndex }) => nextOwnerIndex !== previousOwnerIndex)).toBe(true);
    expect(uniqueRoleMoves.some(({ previousOwnerIndex, nextOwnerIndex }) => nextOwnerIndex < previousOwnerIndex)).toBe(true);

    const secrets = await databasePool().query<{ player_id: string; role: GameRole }>(`select ps.player_id, ps.role
      from public.player_secrets ps
      join public.room_players rp on rp.room_id = ps.room_id and rp.id = ps.player_id
      where ps.room_id = $1 and rp.kicked_at is null and rp.is_spectator = false
      order by rp.joined_order`, [roomId]);
    expect(secrets.rows).toHaveLength(rematched.players.length);
    expect(secrets.rows.map(({ player_id, role }) => ({ id: player_id, role }))).toEqual(
      rematched.players.map(({ id, role }) => ({ id, role })),
    );
    expect(secrets.rows.filter(({ role }) => role === 'Scrum Master')).toHaveLength(1);
    expect(secrets.rows.filter(({ role }) => role === 'Người trễ task')).toHaveLength(1);
  });

  it('persists private checks for reconnects while hiding TTS targets and uncast ballots from other seats', async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => createAuthUser()));
    const hostSeat = await createRoomSeat(users[0]!, 'Host');
    const roomId = hostSeat.roomId;
    for (let index = 1; index < users.length; index += 1) await joinRoomSeat(roomId, users[index]!, `Player ${index}`);

    const roles: GameRole[] = ['Scrum Master', 'Business Analyst', 'Thực tập sinh', 'Người trễ task', 'Client'];
    await sendCommand(roomId, users[0]!.accessToken, {
      type: 'setRolePreset', commandId: randomUUID(), expectedPhaseVersion: 0, preset: 'custom', roles,
    });
    for (const user of users) {
      await sendCommand(roomId, user.accessToken, {
        type: 'setReady', commandId: randomUUID(), expectedPhaseVersion: 0, ready: true,
      });
    }
    const start = await sendCommand(roomId, users[0]!.accessToken, {
      type: 'startGame', commandId: randomUUID(), expectedPhaseVersion: 0,
    });
    expect(start.status).toBe(200);

    let state = await readInternalState(roomId);
    const analyst = state.players.find((player) => player.role === 'Business Analyst')!;
    const analystAuth = await authUserForSeat(roomId, analyst.id, users);
    const targets = state.players.filter(({ id }) => id !== analyst.id).slice(0, 2);
    state.phase = 'planningDiscussion';
    state.phaseVersion += 1;
    state.revision += 1;
    state.phaseStartedAt = Date.now();
    state.phaseDeadlineAt = Date.now() + 180_000;
    state.teamSelectionDeadlineAt = null;
    await writeInternalState(roomId, state);

    const baCommandId = randomUUID();
    const baResponse = await sendCommand(roomId, analystAuth.accessToken, {
      type: 'useBaCheck', commandId: baCommandId, expectedPhaseVersion: state.phaseVersion,
      targetIds: [targets[0]!.id, targets[1]!.id],
    });
    const baSnapshot = await baResponse.json();
    expect(baResponse.status).toBe(200);
    expect(baSnapshot.private.effects).toContainEqual(expect.objectContaining({ commandId: baCommandId, kind: 'baCheck' }));
    expect(JSON.stringify(baSnapshot.room)).not.toContain('"result":"yes"');
    expect(JSON.stringify(baSnapshot.room)).not.toContain('"result":"no"');
    expect(baSnapshot.room).not.toHaveProperty('privateEffects');

    const reconnect = await getRoom(authenticatedRequest(`/api/rooms/${roomId}`, analystAuth.accessToken), {
      params: Promise.resolve({ id: roomId }),
    });
    const reconnectSnapshot = await reconnect.json();
    expect(reconnectSnapshot.private.effects).toContainEqual(expect.objectContaining({ commandId: baCommandId, kind: 'baCheck' }));

    const intern = state.players.find((player) => player.role === 'Thực tập sinh')!;
    const internAuth = await authUserForSeat(roomId, intern.id, users);
    state = await readInternalState(roomId);
    state.phase = 'firstNight';
    state.phaseVersion += 1;
    state.revision += 1;
    state.phaseStartedAt = Date.now();
    state.phaseDeadlineAt = Date.now() + 20_000;
    state.teamSelectionDeadlineAt = null;
    state.ttsFollowTargetId = null;
    await writeInternalState(roomId, state);

    const targetId = state.players.find((player) => player.id !== intern.id)!.id;
    const tts = await sendCommand(roomId, internAuth.accessToken, {
      type: 'setTtsTarget', commandId: randomUUID(), expectedPhaseVersion: state.phaseVersion, targetId,
    });
    const ttsSnapshot = await tts.json();
    expect(tts.status).toBe(200);
    expect(ttsSnapshot.room).not.toHaveProperty('ttsFollowTargetId');
    expect(ttsSnapshot.private.ttsFollowTargetId).toBe(targetId);
    const otherSeat = state.players.find((player) => player.id !== intern.id)!;
    const otherAuth = await authUserForSeat(roomId, otherSeat.id, users);
    const otherSnapshot = await getRoom(authenticatedRequest(`/api/rooms/${roomId}`, otherAuth.accessToken), {
      params: Promise.resolve({ id: roomId }),
    });
    expect((await otherSnapshot.json()).private.ttsFollowTargetId).toBeNull();

    state = await readInternalState(roomId);
    state.phase = 'teamVoting';
    state.phaseVersion += 1;
    state.revision += 1;
    state.phaseStartedAt = Date.now();
    state.phaseDeadlineAt = Date.now() + 30_000;
    state.teamSelectionDeadlineAt = null;
    state.teamIds = state.players.slice(0, state.requiredTeamSize).map(({ id }) => id);
    state.teamVotes = {};
    state.teamVoteOutcome = null;
    state.teamVoteRevealVotes = null;
    await writeInternalState(roomId, state);

    const ballot = await sendCommand(roomId, analystAuth.accessToken, {
      type: 'castTeamVote', commandId: randomUUID(), expectedPhaseVersion: state.phaseVersion, vote: 'approve',
    });
    const ballotSnapshot = await ballot.json();
    expect(ballot.status).toBe(200);
    expect(ballotSnapshot.room).not.toHaveProperty('teamVotes');
    expect(ballotSnapshot.room.teamVoteSubmittedPlayerIds).toContain(analyst.id);
    expect(ballotSnapshot.room.teamVoteOutcome).toBeNull();
    expect(JSON.stringify(ballotSnapshot.room)).not.toContain('approve');
    const voteRows = await databasePool().query<{ count: number }>(
      'select count(*)::int as count from public.team_votes where room_id = $1 and phase_version = $2 and player_id = $3',
      [roomId, state.phaseVersion, analyst.id],
    );
    expect(voteRows.rows[0]?.count).toBe(1);
  });

  it('persists simultaneous team votes and lets an expired-phase tick win over a late final ballot', async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => createAuthUser()));
    const roomId = await createStartedRoom(users, [
      'Scrum Master', 'Business Analyst', 'Developer', 'Người trễ task', 'Client',
    ]);
    let state = await readInternalState(roomId);
    state.phase = 'teamVoting';
    state.phaseVersion += 1;
    state.revision += 1;
    state.phaseStartedAt = Date.now();
    state.phaseDeadlineAt = Date.now() + 30_000;
    state.teamSelectionDeadlineAt = null;
    state.teamIds = state.players.slice(0, state.requiredTeamSize).map(({ id }) => id);
    state.teamVotes = {};
    state.teamVoteOutcome = null;
    state.teamVoteRevealVotes = null;
    await writeInternalState(roomId, state);

    const simultaneousPlayers = state.players.slice(0, 2);
    const [firstUser, secondUser] = await Promise.all(simultaneousPlayers.map(({ id }) => authUserForSeat(roomId, id, users)));
    const firstVoteCommand = {
      type: 'castTeamVote', commandId: randomUUID(), expectedPhaseVersion: state.phaseVersion, vote: 'approve',
    };
    const [firstVote, secondVote] = await Promise.all([
      sendCommand(roomId, firstUser!.accessToken, firstVoteCommand),
      sendCommand(roomId, secondUser!.accessToken, {
        type: 'castTeamVote', commandId: randomUUID(), expectedPhaseVersion: state.phaseVersion, vote: 'reject',
      }),
    ]);
    expect(firstVote.status).toBe(200);
    expect(secondVote.status).toBe(200);

    const replayedBallot = await sendCommand(roomId, firstUser!.accessToken, firstVoteCommand);
    expect(replayedBallot.status).toBe(200);
    const secondBallot = await sendCommand(roomId, firstUser!.accessToken, {
      type: 'castTeamVote', commandId: randomUUID(), expectedPhaseVersion: state.phaseVersion, vote: 'reject',
    });
    expect(secondBallot.status).toBe(409);
    expect((await secondBallot.json()).code).toBe('ALREADY_VOTED');

    state = await readInternalState(roomId);
    expect(Object.keys(state.teamVotes)).toHaveLength(2);
    const persistedSimultaneousVotes = await databasePool().query<{ count: number }>(
      'select count(*)::int as count from public.team_votes where room_id = $1 and phase_version = $2',
      [roomId, state.phaseVersion],
    );
    expect(persistedSimultaneousVotes.rows[0]?.count).toBe(2);

    const allButLast = state.players.slice(0, -1);
    const finalPlayer = state.players[state.players.length - 1]!;
    state.teamVotes = Object.fromEntries(allButLast.map((player, index) => [player.id, index % 2 ? 'reject' : 'approve']));
    state.phaseDeadlineAt = Date.now() - 1;
    state.phaseStartedAt = Date.now() - 30_001;
    state.phaseVersion += 1;
    state.revision += 1;
    await databasePool().query('delete from public.team_votes where room_id = $1', [roomId]);
    for (const player of allButLast) {
      await databasePool().query(`insert into public.team_votes (room_id, phase_version, player_id, vote)
        values ($1, $2, $3, $4)`, [roomId, state.phaseVersion, player.id, state.teamVotes[player.id]]);
    }
    await writeInternalState(roomId, state);

    const finalUser = await authUserForSeat(roomId, finalPlayer.id, users);
    const [lateBallot, tick] = await Promise.all([
      sendCommand(roomId, finalUser.accessToken, {
        type: 'castTeamVote', commandId: randomUUID(), expectedPhaseVersion: state.phaseVersion, vote: 'approve',
      }),
      getRoom(authenticatedRequest(`/api/rooms/${roomId}`, finalUser.accessToken), {
        params: Promise.resolve({ id: roomId }),
      }),
    ]);
    expect(lateBallot.status).toBe(409);
    expect((await lateBallot.json()).code).toBe('STALE_PHASE');
    const tickSnapshot = await tick.json();
    expect(tick.status).toBe(200);
    expect(tickSnapshot.room.phase).toBe('teamVoteReveal');
    const resolved = await readInternalState(roomId);
    expect(Object.keys(resolved.teamVotes)).toHaveLength(state.players.length);
    expect(resolved.teamVotes[finalPlayer.id]).toBe('reject');
  });

  it('rolls back a QC redo if event persistence fails after the state write', async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => createAuthUser()));
    const roomId = await createStartedRoom(users, [
      'Scrum Master', 'Quality Controller', 'Developer', 'Người trễ task', 'Client',
    ]);
    const state = await readInternalState(roomId);
    const qc = state.players.find((player) => player.role === 'Quality Controller')!;
    const qcUser = await authUserForSeat(roomId, qc.id, users);
    state.phase = 'sprintResult';
    state.phaseVersion += 1;
    state.revision += 1;
    state.phaseStartedAt = Date.now();
    state.phaseDeadlineAt = Date.now() + 20_000;
    state.teamSelectionDeadlineAt = null;
    state.checkpoint = {
      sprintIndex: state.sprintIndex,
      leaderIndex: state.leaderIndex,
      requiredTeamSize: state.requiredTeamSize,
      nextTeamSizeBonus: state.nextTeamSizeBonus,
      goodWins: state.goodWins,
      badWins: state.badWins,
      rejectedTeams: state.rejectedTeams,
      history: state.history.map((record) => ({ ...record, teamIds: [...record.teamIds] })),
    };
    state.skills.qcRedoUsed = false;
    state.teamIds = state.players.slice(0, state.requiredTeamSize).map(({ id }) => id);
    await writeInternalState(roomId, state);

    const nameSuffix = randomUUID().replaceAll('-', '');
    const functionName = `test_fail_event_${nameSuffix}`;
    const triggerName = `test_fail_event_${nameSuffix}`;
    const commandId = randomUUID();
    const pool = databasePool();
    try {
      await pool.query(`create function public.${functionName}() returns trigger language plpgsql as $body$
        begin raise exception 'atomicity fixture'; end;
      $body$`);
      await pool.query(`create trigger ${triggerName} before insert on public.game_events
        for each row when (new.room_id = '${roomId}') execute function public.${functionName}()`);

      const response = await sendCommand(roomId, qcUser.accessToken, {
        type: 'useQcRedo', commandId, expectedPhaseVersion: state.phaseVersion,
      });
      const error = await response.json();
      expect(response.status).toBe(500);
      expect(error).toEqual({ code: 'INTERNAL_ERROR', error: 'Unexpected server error' });
    } finally {
      await pool.query(`drop trigger if exists ${triggerName} on public.game_events`);
      await pool.query(`drop function if exists public.${functionName}()`);
    }

    const afterFailure = await readInternalState(roomId);
    expect(afterFailure.phase).toBe('sprintResult');
    expect(afterFailure.skills.qcRedoUsed).toBe(false);
    expect(afterFailure.revision).toBe(state.revision);
    const storedCommand = await databasePool().query<{ count: number }>(
      'select count(*)::int as count from public.applied_commands where room_id = $1 and command_id = $2',
      [roomId, commandId],
    );
    expect(storedCommand.rows[0]?.count).toBe(0);
  });
});

type AuthUser = { authUserId: string; accessToken: string };
type SeatSnapshot = { roomId: string; snapshot: RoomSnapshot };

async function createAuthUser(): Promise<AuthUser> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user || !data.session) throw error ?? new Error('Anonymous sign-in returned no session');
  createdAuthUserIds.push(data.user.id);
  return { authUserId: data.user.id, accessToken: data.session.access_token };
}

async function createRoomSeat(user: AuthUser, playerName: string): Promise<SeatSnapshot> {
  const roomId = newRoomId();
  const response = await createRoom(authenticatedRequest('/api/rooms', user.accessToken, {
    method: 'POST', body: { roomId, playerName },
  }));
  const snapshot = await response.json() as RoomSnapshot & { code?: string };
  if (!response.ok) throw new Error(`Room create failed with ${response.status}: ${snapshot.code}`);
  return { roomId, snapshot };
}

async function createStartedRoom(users: AuthUser[], roles: GameRole[]): Promise<string> {
  const hostSeat = await createRoomSeat(users[0]!, 'Host');
  const roomId = hostSeat.roomId;
  for (let index = 1; index < users.length; index += 1) await joinRoomSeat(roomId, users[index]!, `Player ${index}`);
  const preset = await sendCommand(roomId, users[0]!.accessToken, {
    type: 'setRolePreset', commandId: randomUUID(), expectedPhaseVersion: 0, preset: 'custom', roles,
  });
  if (!preset.ok) throw new Error('Could not set integration fixture roles');
  for (const user of users) {
    const ready = await sendCommand(roomId, user.accessToken, {
      type: 'setReady', commandId: randomUUID(), expectedPhaseVersion: 0, ready: true,
    });
    if (!ready.ok) throw new Error('Could not ready integration fixture player');
  }
  const start = await sendCommand(roomId, users[0]!.accessToken, {
    type: 'startGame', commandId: randomUUID(), expectedPhaseVersion: 0,
  });
  if (!start.ok) throw new Error('Could not start integration fixture game');
  return roomId;
}

async function joinRoomSeat(roomId: string, user: AuthUser, playerName: string): Promise<{ snapshot: RoomSnapshot }> {
  const response = await joinRoom(authenticatedRequest(`/api/rooms/${roomId}/join`, user.accessToken, {
    method: 'POST', body: { playerName },
  }), { params: Promise.resolve({ id: roomId }) });
  const snapshot = await response.json() as RoomSnapshot & { code?: string };
  if (!response.ok) throw new Error(`Room join failed with ${response.status}: ${snapshot.code}`);
  return { snapshot };
}

async function sendCommand(roomId: string, accessToken: string, body: Record<string, unknown>) {
  return postCommand(authenticatedRequest(`/api/rooms/${roomId}/commands`, accessToken, {
    method: 'POST', body,
  }), { params: Promise.resolve({ id: roomId }) });
}

async function readInternalState(roomId: string): Promise<GameState> {
  const row = await databasePool().query<{ internal_state: GameState }>(
    'select internal_state from public.game_rooms where room_id = $1', [roomId],
  );
  if (!row.rows[0]?.internal_state) throw new Error('Room internal state is missing');
  return row.rows[0].internal_state;
}

async function writeInternalState(roomId: string, state: GameState): Promise<void> {
  await databasePool().query(`update public.game_rooms
    set internal_state = $2::jsonb, phase_version = $3, revision = $4, deadline_at = $5
    where room_id = $1`, [roomId, JSON.stringify(state), state.phaseVersion, state.revision, new Date(state.phaseDeadlineAt ?? Date.now())]);
  await databasePool().query(`update public.room_public_state set revision = $2, payload = $3::jsonb where room_id = $1`,
    [roomId, state.revision, JSON.stringify(projectState(state))]);
}

async function authUserForSeat(roomId: string, seatId: string, users: AuthUser[]): Promise<AuthUser> {
  const row = await databasePool().query<{ auth_user_id: string }>(
    'select auth_user_id from public.room_players where room_id = $1 and id = $2', [roomId, seatId],
  );
  const authUserId = row.rows[0]?.auth_user_id;
  if (!authUserId) throw new Error('No authenticated subject for game seat');
  const matching = users.find((user) => user.authUserId === authUserId);
  if (matching) return matching;
  throw new Error('Game seat did not match a fixture user');
}

function newRoomId(): string {
  const roomId = `core-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  createdRoomIds.push(roomId);
  return roomId;
}

function jsonRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function authenticatedRequest(
  path: string,
  accessToken: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}
