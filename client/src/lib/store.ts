import { supabaseAdmin } from './supabase';
import type { Room, Player, GameAction, Phase, Vote } from './types';
import { assignRoles, getSprintSize, requiresDoubleFail, isGoodRole, ROLES } from './types';

// ===== Supabase-backed room storage =====
// Each game is one row in public.rooms. State is a JSONB blob matching the Room interface.
// One UPSERT per action — atomic, single round-trip. Realtime fans out row changes to subscribers.

async function readRoom(id: string): Promise<Room | null> {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('state')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data.state as Room;
}

async function writeRoom(room: Room): Promise<void> {
  const { error } = await supabaseAdmin.from('rooms').upsert({
    id: room.id,
    state: room,
    last_updated: new Date().toISOString(),
  });
  if (error) {
    console.error('[store] writeRoom failed:', error);
    throw new Error('Failed to persist room state');
  }
}

// ===== Room Operations =====

export async function createRoom(
  roomId: string,
  playerName: string,
  playerId: string
): Promise<{ room: Room; player: Player } | null> {
  if (!playerId) return null;

  // If room already exists, reject (caller should join instead).
  const existing = await readRoom(roomId);
  if (existing) return null;

  const player: Player = {
    id: playerId,
    name: playerName,
    isAlive: true,
  };

  const room: Room = {
    id: roomId,
    players: [player],
    phase: 'lobby',
    currentPO: 0,
    currentSprint: 0,
    proposedTeam: [],
    votes: {},
    executionVotes: {},
    consecutiveDelays: 0,
    goodWins: 0,
    badWins: 0,
    saboteurGuess: null,
    pmOverrideUsed: false,
    dataAnalystCheckUsed: false,
    techLeadPresent: false,
    qcBugged: false,
    lastUpdated: Date.now(),
  };

  await writeRoom(room);
  return { room, player };
}

export async function joinRoom(
  roomId: string,
  playerName: string,
  playerId: string
): Promise<{ room: Room; player: Player } | null> {
  if (!playerId) return null;

  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'lobby') return null;
  if (room.players.length >= 10) return null;

  // Rejoin path: same UUID already in room → return that player (preserves role, isAlive).
  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    if (existing.name !== playerName) {
      existing.name = playerName;
      await writeRoom(room);
    }
    return { room, player: existing };
  }

  const player: Player = {
    id: playerId,
    name: playerName,
    isAlive: true,
  };

  room.players.push(player);
  await writeRoom(room);
  return { room, player };
}

export async function startGame(
  roomId: string,
  playerId: string
): Promise<{ room: Room; role: string; isGood: boolean; saboteurIds: string[]; smId: string | null } | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.players.length < 5) return null;

  room.players = assignRoles(room.players);
  room.phase = 'planning';
  await writeRoom(room);

  // Caller-specific role info
  const me = room.players.find((p) => p.id === playerId);
  if (!me || !me.role) return { room, role: '', isGood: true, saboteurIds: [], smId: null };

  const saboteurIds = room.players
    .filter((p) => p.role === 'Người trễ task')
    .map((p) => p.id);

  const sm = room.players.find((p) => p.role === 'Scrum Master');

  return {
    room,
    role: me.role,
    isGood: isGoodRole(me.role),
    saboteurIds: me.role === 'Người trễ task' ? saboteurIds.filter((id) => id !== playerId) : [],
    smId: me.role === 'Scrum Master' ? sm?.id ?? null : null,
  };
}

export async function getRoom(roomId: string): Promise<Room | null> {
  return readRoom(roomId);
}

export async function getPlayerRole(
  roomId: string,
  playerId: string
): Promise<{ role: string; isGood: boolean } | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.role) return null;
  return { role: player.role, isGood: isGoodRole(player.role) };
}

export async function getSaboteurs(roomId: string, playerId: string): Promise<string[] | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.role !== 'Người trễ task') return null;
  return room.players
    .filter((p) => p.role === 'Người trễ task' && p.id !== playerId)
    .map((p) => p.id);
}

export async function getSMInfo(roomId: string, playerId: string): Promise<{ smId: string } | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.role !== 'Scrum Master') return null;
  const sm = room.players.find((p) => p.role === 'Scrum Master');
  if (!sm) return null;
  return { smId: sm.id };
}

// ===== Game Actions =====

export async function proposeTeam(
  roomId: string,
  playerId: string,
  playerIds: string[]
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;

  const PO = room.players[room.currentPO];
  if (!PO || PO.id !== playerId) return null;

  room.proposedTeam = playerIds;
  room.votes = {};
  room.executionVotes = {};
  room.phase = 'teamVoting';

  await writeRoom(room);
  return room;
}

export async function voteTeam(
  roomId: string,
  playerId: string,
  vote: Vote
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'teamVoting') return null;
  if (room.votes[playerId]) return null;

  room.votes[playerId] = vote;

  const alivePlayers = room.players.filter((p) => p.isAlive);
  if (Object.keys(room.votes).length === alivePlayers.length) {
    return tallyTeamVote(room);
  }

  await writeRoom(room);
  return room;
}

async function tallyTeamVote(room: Room): Promise<Room> {
  const votes = Object.values(room.votes);
  const agree = votes.filter((v) => v === 'agree').length;
  const reject = votes.filter((v) => v === 'reject').length;

  if (agree > reject) {
    room.phase = 'execution';
    room.consecutiveDelays = 0;
    room.techLeadPresent = room.proposedTeam.some((id) => {
      const p = room.players.find((pl) => pl.id === id);
      return p && p.role === 'Tech Lead';
    });

    if (room.qcBugged) {
      room.phase = 'sprintResult';
      room.badWins++;
      room.qcBugged = false;
      checkWinCondition(room);
      await writeRoom(room);
      return room;
    }
  } else {
    room.consecutiveDelays++;
    room.currentPO = (room.currentPO + 1) % room.players.length;

    if (room.consecutiveDelays >= 4) {
      room.phase = 'ended';
      room.badWins = 3;
      await writeRoom(room);
      return room;
    }
    room.phase = 'planning';
  }

  await writeRoom(room);
  return room;
}

export async function voteExecution(
  roomId: string,
  playerId: string,
  vote: Vote
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'execution') return null;
  if (!room.proposedTeam.includes(playerId)) return null;
  if (room.executionVotes[playerId]) return null;

  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.role) return null;

  // Good guys must vote success
  if (!ROLES.BAD.includes(player.role) && vote === 'fail') {
    return null;
  }

  room.executionVotes[playerId] = vote;

  if (Object.keys(room.executionVotes).length === room.proposedTeam.length) {
    return tallyExecutionVote(room);
  }

  await writeRoom(room);
  return room;
}

async function tallyExecutionVote(room: Room): Promise<Room> {
  const votes = Object.values(room.executionVotes);
  const fails = votes.filter((v) => v === 'fail').length;
  const success = votes.filter((v) => v === 'success').length;

  room.phase = 'sprintResult';

  // QC cẩu thả bug propagation
  const QC = room.players.find((p) => p.role === 'QC cẩu thả');
  if (QC && room.proposedTeam.includes(QC.id)) {
    room.qcBugged = true;
  }

  const doubleFail = requiresDoubleFail(room.players.length, room.currentSprint);
  let sprintFailed = doubleFail ? fails >= 2 : fails >= 1;

  // Tech Lead prevents failure
  if (sprintFailed && room.techLeadPresent) {
    sprintFailed = false;
  }

  if (sprintFailed) {
    room.badWins++;
  } else {
    room.goodWins++;
  }

  room.currentSprint++;
  checkWinCondition(room);

  await writeRoom(room);
  return room;
}

function checkWinCondition(room: Room): void {
  if (room.badWins >= 3) {
    room.phase = 'ended';
    return;
  }

  if (room.goodWins >= 3) {
    room.phase = 'ended';
    return;
  }

  if (room.currentSprint >= 5) {
    room.phase = 'ended';
    return;
  }

  // Next sprint
  room.phase = 'planning';
  room.proposedTeam = [];
  room.votes = {};
  room.executionVotes = {};
  room.techLeadPresent = false;
}

export async function saboteurGuess(
  roomId: string,
  playerId: string,
  guessedSmId: string
): Promise<{ winner: string; correct: boolean } | null> {
  const room = await readRoom(roomId);
  if (!room) return null;

  const saboteur = room.players.find((p) => p.id === playerId && p.role === 'Người trễ task');
  if (!saboteur) return null;

  const SM = room.players.find((p) => p.role === 'Scrum Master');
  const correct = Boolean(SM && SM.id === guessedSmId);

  room.phase = 'ended';
  await writeRoom(room);

  return { winner: correct ? 'bad' : 'good', correct };
}

// Poll-based sync for client (fallback when Realtime unavailable)
export async function pollRoom(roomId: string): Promise<Room | null> {
  return readRoom(roomId);
}
