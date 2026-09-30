import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameState, projectState, type GameRole } from '@/game';
import { POST as postChat, GET as getChat } from '@/app/api/rooms/[id]/chat/route';
import { POST as postCommand } from '@/app/api/rooms/[id]/commands/route';
import { databasePool } from '@/server/db';

const createdRoomIds: string[] = [];

afterEach(async () => {
  if (createdRoomIds.length === 0) return;
  await databasePool().query('delete from public.game_rooms where room_id = any($1::text[])', [createdRoomIds]);
  createdRoomIds.length = 0;
});

describe('room social routes', () => {
  it('rejects unauthenticated chat requests before validating their payload', async () => {
    const response = await postChat(
      new Request('http://localhost/api/rooms/ROOM1/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'ROOM1' }) },
    );

    expect(response.status).toBe(401);
  });

  it('rejects outsiders and prevents good players from reading or writing bad chat', async () => {
    const fixture = await createFixture();
    const outsider = await createAuthUser();

    const outsiderRead = await getChat(
      authenticatedRequest(fixture.roomId, outsider.accessToken),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const outsiderWrite = await postChat(
      authenticatedRequest(fixture.roomId, outsider.accessToken, {
        method: 'POST',
        body: { commandId: randomUUID(), audience: 'public', text: 'hello' },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const goodRead = await getChat(
      authenticatedRequest(fixture.roomId, fixture.host.accessToken, { audience: 'bad' }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const goodWrite = await postChat(
      authenticatedRequest(fixture.roomId, fixture.host.accessToken, {
        method: 'POST',
        body: { commandId: randomUUID(), audience: 'bad', text: 'secret' },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );

    expect(outsiderRead.status).toBe(403);
    expect(outsiderWrite.status).toBe(403);
    expect(goodRead.status).toBe(403);
    expect(goodWrite.status).toBe(403);
  });

  it('uses the authenticated seat instead of a caller-supplied player id or name', async () => {
    const fixture = await createFixture();
    const response = await postChat(
      authenticatedRequest(fixture.roomId, fixture.host.accessToken, {
        method: 'POST',
        body: {
          commandId: randomUUID(),
          playerId: fixture.badPlayer.id,
          playerName: 'Impersonated Bad Player',
          text: 'hello from the host',
        },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message.senderPlayerId).toBe(fixture.host.id);
    expect(result.message.sequence).toEqual(expect.any(Number));
    expect(Number.isSafeInteger(result.message.sequence)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Impersonated Bad Player');
    const stored = await databasePool().query<{ sender_player_id: string; display_name: string }>(
      `select messages.sender_player_id, players.display_name
       from public.room_messages messages
       join public.room_players players on players.id = messages.sender_player_id
       where messages.room_id = $1`,
      [fixture.roomId],
    );
    expect(stored.rows).toEqual([{ sender_player_id: fixture.host.id, display_name: 'Host' }]);
  });

  it('rejects silenced members and permits authorized bad-team chat', async () => {
    const silenced = await createFixture({ mutedPlayerId: 'host' });
    const blocked = await postChat(
      authenticatedRequest(silenced.roomId, silenced.host.accessToken, {
        method: 'POST',
        body: { commandId: randomUUID(), text: 'I should be muted' },
      }),
      { params: Promise.resolve({ id: silenced.roomId }) },
    );
    const deadlineSilenced = await createFixture({ allMuted: true });
    const globallyBlocked = await postChat(
      authenticatedRequest(deadlineSilenced.roomId, deadlineSilenced.badPlayer.accessToken, {
        method: 'POST',
        body: { commandId: randomUUID(), text: 'Deadline has silenced everyone' },
      }),
      { params: Promise.resolve({ id: deadlineSilenced.roomId }) },
    );

    const fixture = await createFixture();
    const privateCommandId = randomUUID();
    const accepted = await postChat(
      authenticatedRequest(fixture.roomId, fixture.badPlayer.accessToken, {
        method: 'POST',
        body: { commandId: privateCommandId, audience: 'bad', text: 'bad team only' },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const wrongAudienceReplay = await postChat(
      authenticatedRequest(fixture.roomId, fixture.badPlayer.accessToken, {
        method: 'POST',
        body: { commandId: privateCommandId, audience: 'public', text: 'bad team only' },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const changedTextReplay = await postChat(
      authenticatedRequest(fixture.roomId, fixture.badPlayer.accessToken, {
        method: 'POST',
        body: { commandId: privateCommandId, audience: 'bad', text: 'changed text' },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const badRead = await getChat(
      authenticatedRequest(fixture.roomId, fixture.badPlayer.accessToken, { audience: 'bad' }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );

    expect(blocked.status).toBe(403);
    expect(globallyBlocked.status).toBe(403);
    expect(accepted.status).toBe(200);
    expect(wrongAudienceReplay.status).toBe(409);
    expect(changedTextReplay.status).toBe(409);
    expect((await badRead.json()).messages).toHaveLength(1);
  });

  it('rejects empty or overlong chat and rate-limits the sixth message in ten seconds', async () => {
    const fixture = await createFixture();
    const post = (text: string) => postChat(
      authenticatedRequest(fixture.roomId, fixture.host.accessToken, {
        path: 'presence',
        method: 'POST',
        body: { commandId: randomUUID(), text },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );

    expect((await post('   ')).status).toBe(400);
    expect((await post('x'.repeat(501))).status).toBe(400);
    expect((await post('x'.repeat(500))).status).toBe(200);

    for (let index = 0; index < 4; index += 1) {
      expect((await post(`message ${index}`)).status).toBe(200);
    }
    expect((await post('sixth message')).status).toBe(429);
  });

  it('updates heartbeat timestamps for active members but does not refresh an offline seat', async () => {
    const fixture = await createFixture();
    const { POST: postPresence } = await import('@/app/api/rooms/[id]/presence/route');
    const oldTimestamp = '2001-01-01T00:00:00.000Z';
    await databasePool().query('update public.room_players set last_seen = $2 where id = $1', [fixture.host.id, oldTimestamp]);

    const offline = await postPresence(
      authenticatedRequest(fixture.roomId, fixture.host.accessToken, {
        path: 'presence',
        method: 'POST',
        body: { status: 'offline' },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const unchanged = await databasePool().query<{ last_seen: Date }>(
      'select last_seen from public.room_players where id = $1',
      [fixture.host.id],
    );
    const online = await postPresence(
      authenticatedRequest(fixture.roomId, fixture.host.accessToken, {
        method: 'POST',
        body: { status: 'online' },
      }),
      { params: Promise.resolve({ id: fixture.roomId }) },
    );
    const refreshed = await databasePool().query<{ last_seen: Date }>(
      'select last_seen from public.room_players where id = $1',
      [fixture.host.id],
    );

    expect(offline.status).toBe(200);
    expect(unchanged.rows[0]?.last_seen.toISOString()).toBe(oldTimestamp);
    expect(online.status).toBe(200);
    expect(refreshed.rows[0]?.last_seen.getTime()).toBeGreaterThan(new Date(oldTimestamp).getTime());
  });

  it('keeps role reveal private until the game has authoritatively ended', async () => {
    const fixture = await createFixture();
    const spectator = await createAuthUser();
    await databasePool().query(`insert into public.room_players
      (id, room_id, auth_user_id, display_name, joined_order, is_spectator)
      values ($1, $2, $3, 'Spectator', 10, true)`, [randomUUID(), fixture.roomId, spectator.authUserId]);
    const { GET: getEndReveal } = await import('@/app/api/rooms/[id]/end-reveal/route');
    const request = () => authenticatedRequest(fixture.roomId, fixture.host.accessToken, { path: 'end-reveal' });
    const spectatorRequest = () => authenticatedRequest(fixture.roomId, spectator.accessToken, { path: 'end-reveal' });

    const beforeEnd = await getEndReveal(request(), { params: Promise.resolve({ id: fixture.roomId }) });
    expect(beforeEnd.status).toBe(403);
    expect(await beforeEnd.json()).not.toHaveProperty('roles');
    const spectatorBeforeEnd = await getEndReveal(spectatorRequest(), { params: Promise.resolve({ id: fixture.roomId }) });
    expect(spectatorBeforeEnd.status).toBe(403);

    const state = fixture.state;
    state.phase = 'ended';
    state.winner = 'good';
    state.endReason = 'assassinationDeadline';
    await databasePool().query('update public.game_rooms set internal_state = $2::jsonb where room_id = $1', [
      fixture.roomId,
      JSON.stringify(state),
    ]);

    const afterEnd = await getEndReveal(request(), { params: Promise.resolve({ id: fixture.roomId }) });
    const response = await afterEnd.json();
    expect(afterEnd.status).toBe(200);
    expect(response.roles).toEqual(fixture.state.players.map(({ id, role }) => ({ playerId: id, role })));
    const spectatorAfterEnd = await getEndReveal(spectatorRequest(), { params: Promise.resolve({ id: fixture.roomId }) });
    expect(spectatorAfterEnd.status).toBe(200);
  });

  it('publishes an authorized reaction once and rate-limits a second command', async () => {
    const fixture = await createFixture();
    const body = {
      commandId: randomUUID(), expectedPhaseVersion: fixture.state.phaseVersion,
      type: 'react', emoji: '🔥', targetType: 'player', targetPlayerId: fixture.goodPlayer.id,
    };
    const request = (payload: unknown) => authenticatedRequest(fixture.roomId, fixture.host.accessToken, {
      path: 'commands', method: 'POST', body: payload,
    });
    const first = await postCommand(request(body), { params: Promise.resolve({ id: fixture.roomId }) });
    expect(first.status).toBe(200);
    const projection = (await first.json()).room;
    expect(projection.publicEvents.at(-1)).toEqual({
      type: 'reaction', visibility: 'public',
      data: { actorPlayerId: fixture.host.id, emoji: '🔥', targetType: 'player', targetPlayerId: fixture.goodPlayer.id },
    });
    const replay = await postCommand(request(body), { params: Promise.resolve({ id: fixture.roomId }) });
    expect(replay.status).toBe(200);
    const limited = await postCommand(request({ ...body, commandId: randomUUID() }), { params: Promise.resolve({ id: fixture.roomId }) });
    expect(limited.status).toBe(429);

    const silenced = await createFixture({ mutedPlayerId: 'host' });
    const blocked = await postCommand(authenticatedRequest(silenced.roomId, silenced.host.accessToken, {
      path: 'commands', method: 'POST', body: { ...body, commandId: randomUUID(), expectedPhaseVersion: silenced.state.phaseVersion },
    }), { params: Promise.resolve({ id: silenced.roomId }) });
    expect(blocked.status).toBe(403);
  });
});

type AuthUser = { authUserId: string; accessToken: string };
type TestSeat = AuthUser & { id: string; name: string; role: GameRole };

async function createAuthUser(): Promise<AuthUser> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user || !data.session) throw error ?? new Error('Anonymous sign-in returned no session');
  return { authUserId: data.user.id, accessToken: data.session.access_token };
}

async function createFixture(options: { mutedPlayerId?: 'host' | null; allMuted?: boolean } = {}) {
  const roomId = `social-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  createdRoomIds.push(roomId);
  const roleSpecs: Array<{ name: string; role: GameRole }> = [
    { name: 'Host', role: 'Scrum Master' },
    { name: 'Analyst', role: 'Business Analyst' },
    { name: 'Developer', role: 'Developer' },
    { name: 'Late Task', role: 'Người trễ task' },
    { name: 'Client', role: 'Client' },
  ];
  const authUsers = await Promise.all(roleSpecs.map(() => createAuthUser()));
  const players: TestSeat[] = roleSpecs.map((spec, index) => ({
    id: randomUUID(),
    name: spec.name,
    role: spec.role,
    ...authUsers[index]!,
  }));
  const state = createGameState({
    id: roomId,
    players: players.map(({ id, name, role }) => ({ id, name, role })),
    leaderId: players[0]!.id,
    now: Date.now(),
  });
  state.phase = 'planningDiscussion';
  state.phaseStartedAt = Date.now();
  state.phaseDeadlineAt = state.phaseStartedAt + 180_000;
  state.chatPolicy = {
    allMuted: options.allMuted ?? false,
    mutedPlayerId: options.mutedPlayerId === 'host' ? players[0]!.id : null,
  };

  const client = await databasePool().connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into public.game_rooms (room_id, host_player_id, phase_version, revision, internal_state)
       values ($1, null, $2, $3, $4::jsonb)`,
      [roomId, state.phaseVersion, state.revision, JSON.stringify(state)],
    );
    for (const [index, player] of players.entries()) {
      await client.query(
        `insert into public.room_players (id, room_id, auth_user_id, display_name, joined_order, is_spectator)
         values ($1, $2, $3, $4, $5, false)`,
        [player.id, roomId, player.authUserId, player.name, index],
      );
      await client.query(
        'insert into public.player_secrets (room_id, player_id, role) values ($1, $2, $3)',
        [roomId, player.id, player.role],
      );
    }
    await client.query('update public.game_rooms set host_player_id = $2 where room_id = $1', [roomId, players[0]!.id]);
    await client.query(
      'insert into public.room_public_state (room_id, revision, payload) values ($1, $2, $3::jsonb)',
      [roomId, state.revision, JSON.stringify(projectState(state))],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return {
    roomId,
    state,
    host: players[0]!,
    goodPlayer: players[1]!,
    badPlayer: players[3]!,
  };
}

function authenticatedRequest(
  roomId: string,
  accessToken: string,
  options: {
    path?: 'chat' | 'presence' | 'end-reveal' | 'commands';
    method?: 'GET' | 'POST';
    body?: unknown;
    audience?: 'public' | 'bad';
  } = {},
): Request {
  const url = new URL(`http://localhost/api/rooms/${roomId}/${options.path ?? 'chat'}`);
  if (options.audience) url.searchParams.set('audience', options.audience);
  return new Request(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}
