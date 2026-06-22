import { createClient } from '@vercel/kv';
import type { Room, Player, GameAction, Phase, Vote } from './types';
import { assignRoles, getSprintSize, requiresDoubleFail, isGoodRole, ROLES } from './types';

// KV client - uses env vars in production, mock in dev without them
const kv = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

// In-memory fallback for local development without Vercel KV
const memoryStore: Map<string, Room> = new Map();
const eventListeners: Map<string, Set<(room: Room) => void>> = new Map();

function getRoomFromStorage(roomId: string): Room | null {
  if (kv) {
    // Will be async in real usage
    return null; // For now, use memory store
  }
  return memoryStore.get(roomId) || null;
}

function saveRoomToStorage(room: Room): void {
  room.lastUpdated = Date.now();
  if (kv) {
    // Async save
  }
  memoryStore.set(room.id, room);
  // Notify listeners
  const listeners = eventListeners.get(room.id);
  if (listeners) {
    listeners.forEach(fn => fn(room));
  }
}

// ===== Room Operations =====

export function createRoom(roomId: string, playerName: string): { room: Room; player: Player } {
  const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const player: Player = {
    id: playerId,
    name: playerName,
    isAlive: true
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
    lastUpdated: Date.now()
  };

  saveRoomToStorage(room);
  return { room, player };
}

export function joinRoom(roomId: string, playerName: string): { room: Room; player: Player } | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;
  if (room.phase !== 'lobby') return null;
  if (room.players.length >= 10) return null;

  const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const player: Player = {
    id: playerId,
    name: playerName,
    isAlive: true
  };

  room.players.push(player);
  saveRoomToStorage(room);
  return { room, player };
}

export function startGame(roomId: string): Room | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;
  if (room.players.length < 5) return null;

  // Assign roles
  room.players = assignRoles(room.players);
  room.phase = 'planning';

  saveRoomToStorage(room);
  return room;
}

export function getRoom(roomId: string): Room | null {
  return getRoomFromStorage(roomId);
}

export function getPlayerRole(roomId: string, playerId: string): { role: string; isGood: boolean } | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.role) return null;
  return { role: player.role, isGood: isGoodRole(player.role) };
}

export function getSaboteurs(roomId: string, playerId: string): string[] | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'Người trễ task') return null;
  return room.players.filter(p => p.role === 'Người trễ task' && p.id !== playerId).map(p => p.id);
}

export function getSMInfo(roomId: string, playerId: string): { smId: string } | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'Scrum Master') return null;
  const sm = room.players.find(p => p.role === 'Scrum Master');
  if (!sm) return null;
  const saboteurIds = room.players.filter(p => p.role === 'Người trễ task').map(p => p.id);
  return { smId: sm.id };
}

// ===== Game Actions =====

export function proposeTeam(roomId: string, playerId: string, playerIds: string[]): Room | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;

  const PO = room.players[room.currentPO];
  if (PO.id !== playerId) return null;

  room.proposedTeam = playerIds;
  room.votes = {};
  room.executionVotes = {};
  room.phase = 'teamVoting';

  saveRoomToStorage(room);
  return room;
}

export function voteTeam(roomId: string, playerId: string, vote: Vote): Room | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;
  if (room.phase !== 'teamVoting') return null;
  if (room.votes[playerId]) return null;

  room.votes[playerId] = vote;

  // Check if all voted
  const alivePlayers = room.players.filter(p => p.isAlive);
  if (Object.keys(room.votes).length === alivePlayers.length) {
    return tallyTeamVote(room);
  }

  saveRoomToStorage(room);
  return room;
}

function tallyTeamVote(room: Room): Room {
  const votes = Object.values(room.votes);
  const agree = votes.filter(v => v === 'agree').length;
  const reject = votes.filter(v => v === 'reject').length;

  if (agree > reject) {
    room.phase = 'execution';
    room.consecutiveDelays = 0;
    room.techLeadPresent = room.proposedTeam.some(id => {
      const p = room.players.find(pl => pl.id === id);
      return p && p.role === 'Tech Lead';
    });

    if (room.qcBugged) {
      room.phase = 'sprintResult';
      room.badWins++;
      room.qcBugged = false;
      checkWinCondition(room);
      saveRoomToStorage(room);
      return room;
    }
  } else {
    room.consecutiveDelays++;
    room.currentPO = (room.currentPO + 1) % room.players.length;

    if (room.consecutiveDelays >= 4) {
      room.phase = 'ended';
      room.badWins = 3;
      saveRoomToStorage(room);
      return room;
    }
    room.phase = 'planning';
  }

  saveRoomToStorage(room);
  return room;
}

export function voteExecution(roomId: string, playerId: string, vote: Vote): Room | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;
  if (room.phase !== 'execution') return null;
  if (!room.proposedTeam.includes(playerId)) return null;
  if (room.executionVotes[playerId]) return null;

  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.role) return null;

  // Good guys must vote success
  if (!ROLES.BAD.includes(player.role) && vote === 'fail') {
    return null;
  }

  room.executionVotes[playerId] = vote;

  // Check if all voted
  if (Object.keys(room.executionVotes).length === room.proposedTeam.length) {
    return tallyExecutionVote(room);
  }

  saveRoomToStorage(room);
  return room;
}

function tallyExecutionVote(room: Room): Room {
  const votes = Object.values(room.executionVotes);
  const fails = votes.filter(v => v === 'fail').length;
  const success = votes.filter(v => v === 'success').length;

  room.phase = 'sprintResult';

  // QC cẩu thả bug propagation
  const QC = room.players.find(p => p.role === 'QC cẩu thả');
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

  saveRoomToStorage(room);
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

export function saboteurGuess(roomId: string, playerId: string, guessedSmId: string): { winner: string; correct: boolean } | null {
  const room = getRoomFromStorage(roomId);
  if (!room) return null;

  const saboteur = room.players.find(p => p.id === playerId && p.role === 'Người trễ task');
  if (!saboteur) return null;

  const SM = room.players.find(p => p.role === 'Scrum Master');
  const correct = Boolean(SM && SM.id === guessedSmId);

  room.phase = 'ended';
  saveRoomToStorage(room);

  return { winner: correct ? 'bad' : 'good', correct };
}

export function subscribeToRoom(roomId: string, callback: (room: Room) => void): () => void {
  if (!eventListeners.has(roomId)) {
    eventListeners.set(roomId, new Set());
  }
  eventListeners.get(roomId)!.add(callback);

  return () => {
    eventListeners.get(roomId)?.delete(callback);
  };
}

// Poll-based sync for client (backup for SSE)
export async function pollRoom(roomId: string): Promise<Room | null> {
  return getRoomFromStorage(roomId);
}
