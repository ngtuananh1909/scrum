import { supabaseAdmin } from './supabase';
import type {
  Room,
  Player,
  Phase,
  Vote,
  PlayerRole,
  SprintHistoryEntry,
  GameLogEntry,
  GameLogCategory,
} from './types';
import {
  assignRoles,
  assignSelectedRoles,
  getSprintSize,
  requiresDoubleFail,
  isGoodRole,
  isBadRole,
  ROLES,
  TIMER_DEFAULTS,
  ttsMultiplier,
  shuffleArray,
} from './types';

// Cap persisted log entries so the JSONB blob stays small across many resets.
const MAX_GAME_LOG_ENTRIES = 100;

let logCounter = 0;
function newLogId(): string {
  logCounter = (logCounter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${logCounter.toString(36)}`;
}

// Append a single log entry. Caps the array to the most recent N entries.
function appendLog(
  room: Room,
  category: GameLogCategory,
  text: string,
  tone?: GameLogEntry['tone']
): void {
  const entry: GameLogEntry = {
    id: newLogId(),
    category,
    text,
    timestamp: Date.now(),
    tone,
  };
  const next = [...(room.gameLog ?? []), entry];
  room.gameLog =
    next.length > MAX_GAME_LOG_ENTRIES
      ? next.slice(next.length - MAX_GAME_LOG_ENTRIES)
      : next;
}

function nameOf(room: Room, playerId: string): string {
  return room.players.find((p) => p.id === playerId)?.name ?? 'Unknown';
}

// ===== Supabase-backed room storage =====
// Each game is one row in public.rooms. State is a JSONB blob matching the Room interface.
// One UPSERT per action — atomic, single round-trip. Realtime fans out row changes to subscribers.

async function readRoom(id: string): Promise<Room | null> {
  const { data, error } = await supabaseAdmin()
    .from('rooms')
    .select('state')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  // Normalize legacy / missing fields so callers can safely read them.
  return normalizeRoom(data.state as Room);
}

function normalizeRoom(room: Room): Room {
  // Migrate legacy 'nightZero' to new 'night' phase name.
  const phase: Phase = (room.phase as string) === 'nightZero' ? 'night' : room.phase;
  return {
    ...room,
    phase,
    pmOverrideUsed: room.pmOverrideUsed ?? false,
    dataAnalystCheckUsed: room.dataAnalystCheckUsed ?? false,
    businessAnalystCheckUsed: room.businessAnalystCheckUsed ?? false,
    qcRedoUsed: room.qcRedoUsed ?? false,
    deadlineUsed: room.deadlineUsed ?? false,
    sepSilencedPlayerId: room.sepSilencedPlayerId ?? null,
    deadlineSilenced: room.deadlineSilenced ?? false,
    techDebtActive: room.techDebtActive ?? false,
    techLeadPresent: room.techLeadPresent ?? false,
    ttsFollowTargetId: room.ttsFollowTargetId ?? null,
    prevSprintTeam: room.prevSprintTeam ?? [],
    prevExecutionVotes: room.prevExecutionVotes ?? {},
    prevSprintIndex: room.prevSprintIndex ?? -1,
    sprintHistory: room.sprintHistory ?? [],
    phaseStartedAt: room.phaseStartedAt ?? null,
    phaseDeadlineAt: room.phaseDeadlineAt ?? null,
    pmDeferredThisSprint: room.pmDeferredThisSprint ?? false,
    clientId: room.clientId ?? null,
    poSelectDeadlineAt: room.poSelectDeadlineAt ?? null,
    gameLog: room.gameLog ?? [],
  };
}

async function writeRoom(room: Room): Promise<void> {
  room.lastUpdated = Date.now();
  const { error } = await supabaseAdmin().from('rooms').upsert({
    id: room.id,
    state: room,
    last_updated: new Date().toISOString(),
  });
  if (error) {
    console.error('[store] writeRoom failed:', error);
    throw new Error('Failed to persist room state');
  }
}

function findPlayer(room: Room, playerId: string): Player | null {
  return room.players.find((p) => p.id === playerId) ?? null;
}

// ===== Room Operations =====

export async function createRoom(
  roomId: string,
  playerName: string,
  playerId: string
): Promise<{ room: Room; player: Player } | null> {
  if (!playerId) return null;

  const existing = await readRoom(roomId);
  if (existing) return null;

  const player: Player = { id: playerId, name: playerName, isAlive: true };

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
    businessAnalystCheckUsed: false,
    qcRedoUsed: false,
    deadlineUsed: false,
    sepSilencedPlayerId: null,
    deadlineSilenced: false,
    techDebtActive: false,
    techLeadPresent: false,
    ttsFollowTargetId: null,
    prevSprintTeam: [],
    prevExecutionVotes: {},
    prevSprintIndex: -1,
    sprintHistory: [],
    phaseStartedAt: null,
    phaseDeadlineAt: null,
    pmDeferredThisSprint: false,
    clientId: null,
    poSelectDeadlineAt: null,
    gameLog: [],
    lastUpdated: Date.now(),
  };

  appendLog(room, 'system', `Phòng ${room.id} được tạo bởi ${playerName}.`);
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

  // Rejoin path: same UUID already in room — return that player, regardless of phase
  // (so refresh mid-game works). Update name if changed.
  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    if (existing.name !== playerName) {
      existing.name = playerName;
      await writeRoom(room);
    }
    return { room, player: existing };
  }

  // New player joining: only allowed in lobby, max 10.
  if (room.phase !== 'lobby') return null;
  if (room.players.length >= 10) return null;

  const player: Player = { id: playerId, name: playerName, isAlive: true };
  room.players.push(player);
  appendLog(room, 'system', `${playerName} đã tham gia phòng.`);
  await writeRoom(room);
  return { room, player };
}

export interface StartGameResult {
  room: Room;
  role: string;
  isGood: boolean;
  saboteurIds: string[];
  smId: string | null;
  baId: string | null;
  clientId: string | null;
}

export async function startGame(
  roomId: string,
  playerId: string,
  roles?: string[]
): Promise<StartGameResult | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'lobby') return null; // game already started — ignore re-call
  if (room.players.length < 5) return null;
  // Only the room's PO (creator / first player) may start.
  const po = room.players[room.currentPO];
  if (!po || po.id !== playerId) return null;

  room.players = roles ? assignSelectedRoles(room.players, roles) : assignRoles(room.players);

  // Always enter Tan ca (night) on game start. SM/BA/Client see info passively;
  // TTS picks follow target; everyone else waits. After timeout OR all skill-users
  // confirm, advance to planning.
  const now = Date.now();
  room.phase = 'night';
  room.phaseStartedAt = now;
  room.phaseDeadlineAt = now + TIMER_DEFAULTS.nightFirstMs;

  // Compute Client id once so BA can discover it from night 0 onwards.
  const client = room.players.find((p) => p.role === 'Client');
  room.clientId = client?.id ?? null;

  appendLog(room, 'phase', `Game bắt đầu — ${room.players.length} người chơi, vào Giờ Tan Ca.`, 'neutral');
  await writeRoom(room);

  return buildRoleInfo(room, playerId);
}

function buildRoleInfo(room: Room, playerId: string): StartGameResult {
  const me = findPlayer(room, playerId);
  if (!me || !me.role) {
    return { room, role: '', isGood: true, saboteurIds: [], smId: null, baId: null, clientId: null };
  }

  const allSaboteurIds = room.players
    .filter((p) => p.role === 'Người trễ task')
    .map((p) => p.id);
  const sm = room.players.find((p) => p.role === 'Scrum Master');
  const ba = room.players.find((p) => p.role === 'Business Analyst');
  const client = room.players.find((p) => p.role === 'Client');

  return {
    room,
    role: me.role,
    isGood: isGoodRole(me.role),
    // SM sees ALL saboteurs (knows the bad team). Other saboteurs see each other.
    saboteurIds:
      me.role === 'Scrum Master'
        ? allSaboteurIds
        : me.role === 'Người trễ task'
        ? allSaboteurIds.filter((id) => id !== playerId)
        : [],
    smId: me.role === 'Scrum Master' ? sm?.id ?? null : null,
    // Client knows BA identity from night zero.
    baId: me.role === 'Client' ? ba?.id ?? null : null,
    // BA knows Client identity from night zero (mutual reveal).
    clientId: me.role === 'Business Analyst' ? client?.id ?? room.clientId ?? null : null,
  };
}

export async function getRoom(roomId: string): Promise<Room | null> {
  return readRoom(roomId);
}

// Return the caller's own role + auxiliary info (for hydration after refresh).
export async function getRoleInfo(roomId: string, playerId: string): Promise<StartGameResult | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  return buildRoleInfo(room, playerId);
}

// ===== Night (tan ca) =====

// Called by TTS to record their follow target during the FIRST night only.
// For subsequent nights (no TTS action), use nightAdvance() to move to planning.
// After TTS confirms, phase advances to planning.
export async function nightZeroComplete(
  roomId: string,
  playerId: string,
  ttsTargetId: string | null
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;
  if (room.currentSprint > 0) return null; // TTS only picks on first night

  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Thực tập sinh') return null;
  if (ttsTargetId && !findPlayer(room, ttsTargetId)) return null;

  room.ttsFollowTargetId = ttsTargetId;

  appendLog(
    room,
    'skill',
    ttsTargetId
      ? `Thực tập sinh ${nameOf(room, playerId)} chọn theo sát ${nameOf(room, ttsTargetId)} (x2 phiếu từ Sprint 2).`
      : `Thực tập sinh ${nameOf(room, playerId)} bỏ qua chọn target.`,
    'neutral'
  );
  await writeRoom(room);
  return room;
}

// ===== Game Actions =====

export async function proposeTeam(
  roomId: string,
  playerId: string,
  playerIds: string[]
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'planning') return null;

  const PO = room.players[room.currentPO];
  if (!PO || PO.id !== playerId) return null;

  const expectedSize = getSprintSize(room.players.length, room.currentSprint, room.techDebtActive);
  if (playerIds.length !== expectedSize) return null;

  const now = Date.now();
  room.proposedTeam = playerIds;
  room.votes = {};
  room.executionVotes = {};
  room.phase = 'teamVoting';
  room.phaseStartedAt = now;
  room.phaseDeadlineAt = now + TIMER_DEFAULTS.teamVoteMs;
  room.poSelectDeadlineAt = null;

  const teamNames = playerIds.map((id) => nameOf(room, id)).join(', ');
  appendLog(
    room,
    'phase',
    `Sprint ${room.currentSprint + 1}: ${PO.name} đề xuất nhóm (${expectedSize} người): ${teamNames}.`,
    'neutral'
  );

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
  // Silenced players cannot vote.
  if (room.deadlineSilenced || room.sepSilencedPlayerId === playerId) return null;

  room.votes[playerId] = vote;

  const eligibleVoters = room.players.filter(
    (p) => p.isAlive && !(room.deadlineSilenced || room.sepSilencedPlayerId === p.id)
  );
  if (Object.keys(room.votes).length >= eligibleVoters.length) {
    return tallyTeamVote(room);
  }

  await writeRoom(room);
  return room;
}

// Auto-fill missing team votes with 'agree' (per user requirement: timeout = agree),
// then tally. Called when teamVote deadline expires.
export async function autoFillTeamVote(roomId: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'teamVoting') return null;

  const eligibleVoters = room.players.filter(
    (p) => p.isAlive && !(room.deadlineSilenced || room.sepSilencedPlayerId === p.id)
  );
  for (const p of eligibleVoters) {
    if (!room.votes[p.id]) room.votes[p.id] = 'agree';
  }
  return tallyTeamVote(room);
}

async function tallyTeamVote(room: Room): Promise<Room> {
  // Apply TTS x2 multiplier from Sprint 2 onward.
  let agreeWeight = 0;
  let rejectWeight = 0;
  for (const [voterId, v] of Object.entries(room.votes)) {
    const mult = ttsMultiplier(room, voterId);
    if (v === 'agree') agreeWeight += mult;
    else if (v === 'reject') rejectWeight += mult;
  }

  if (agreeWeight > rejectWeight) {
    const now = Date.now();
    room.phase = 'execution';
    room.phaseStartedAt = now;
    room.phaseDeadlineAt = now + TIMER_DEFAULTS.executionVoteMs;
    room.consecutiveDelays = 0;
    room.techLeadPresent = room.proposedTeam.some((id) => {
      const p = findPlayer(room, id);
      return p && p.role === 'Technical Leader';
    });
    appendLog(
      room,
      'vote',
      `Biểu quyết duyệt nhóm: ĐỒNG Ý (${agreeWeight}-${rejectWeight}) → vào Thực thi.`,
      'good'
    );
  } else {
    room.consecutiveDelays++;
    // Rotate PO to next alive player.
    do {
      room.currentPO = (room.currentPO + 1) % room.players.length;
    } while (!room.players[room.currentPO]?.isAlive);

    if (room.consecutiveDelays >= 3) {
      room.phase = 'ended';
      room.phaseDeadlineAt = null;
      room.phaseStartedAt = null;
      room.badWins = Math.max(room.badWins, 2);
      appendLog(
        room,
        'sprint',
        `Delay thứ ${room.consecutiveDelays} liên tiếp — phe Phá Dự Án thắng!`,
        'bad'
      );
      await writeRoom(room);
      return room;
    }
    const now = Date.now();
    room.phase = 'planning';
    room.phaseStartedAt = now;
    room.phaseDeadlineAt = now + TIMER_DEFAULTS.planningMs;
    room.poSelectDeadlineAt = now + TIMER_DEFAULTS.poSelectTeamMs;
    room.votes = {};
    room.proposedTeam = [];
    // Reset per-sprint skill flags
    room.sepSilencedPlayerId = null;
    room.deadlineSilenced = false;
    room.pmDeferredThisSprint = false;
    appendLog(
      room,
      'vote',
      `Biểu quyết duyệt nhóm: TỪ CHỐI (${agreeWeight}-${rejectWeight}) — delay thứ ${room.consecutiveDelays}.`,
      'bad'
    );
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

  const player = findPlayer(room, playerId);
  if (!player || !player.role) return null;

  // Good roles cannot vote fail.
  if (isGoodRole(player.role) && vote === 'fail') {
    return null;
  }

  room.executionVotes[playerId] = vote;

  if (Object.keys(room.executionVotes).length === room.proposedTeam.length) {
    return tallyExecutionVote(room);
  }

  await writeRoom(room);
  return room;
}

// Auto-fill missing execution votes with 'success' (per spec PDF §1.1).
export async function autoFillExecutionVote(roomId: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'execution') return null;
  for (const pid of room.proposedTeam) {
    if (!room.executionVotes[pid]) room.executionVotes[pid] = 'success';
  }
  return tallyExecutionVote(room);
}

async function tallyExecutionVote(room: Room): Promise<Room> {
  // QC cẩu thả: their fail vote counts as 2.
  let fails = 0;
  let success = 0;
  for (const [pid, v] of Object.entries(room.executionVotes)) {
    const player = findPlayer(room, pid);
    if (v === 'fail') {
      fails += player?.role === 'QC cẩu thả' ? 2 : 1;
    } else if (v === 'success') {
      success += 1;
    }
  }
  void success;

  // Snapshot for Data Analyst check in next sprint.
  room.prevSprintTeam = [...room.proposedTeam];
  room.prevExecutionVotes = { ...room.executionVotes };
  room.prevSprintIndex = room.currentSprint;

  // Technical Debt: if TD player was on this sprint's team, next sprint gets +1.
  const tdPlayer = room.players.find((p) => p.role === 'Technical Debt');
  const tdOnTeam = tdPlayer ? room.proposedTeam.includes(tdPlayer.id) : false;

  const doubleFail = requiresDoubleFail(room.players.length, room.currentSprint);
  let sprintFailed = doubleFail ? fails >= 2 : fails >= 1;

  // Technical Leader saves exactly 1 fail.
  if (sprintFailed && room.techLeadPresent && fails === 1) {
    sprintFailed = false;
  }

  if (sprintFailed) {
    room.badWins++;
  } else {
    room.goodWins++;
  }

  // Append to sprint history BEFORE incrementing currentSprint.
  const historyEntry: SprintHistoryEntry = {
    sprintIndex: room.currentSprint + 1,
    proposedTeam: [...room.proposedTeam],
    outcome: sprintFailed ? 'fail' : 'success',
    votesAgree: { ...room.votes } as Record<string, 'agree' | 'reject'>,
    votesExecution: { ...room.executionVotes } as Record<string, 'success' | 'fail'>,
    timestamp: Date.now(),
  };
  room.sprintHistory = [...(room.sprintHistory ?? []), historyEntry];

  const sprintIdx = room.currentSprint + 1;
  const teamSummary = room.proposedTeam.map((id) => nameOf(room, id)).join(', ');
  const tlSaved = !sprintFailed && room.techLeadPresent && fails === 1;
  appendLog(
    room,
    'sprint',
    sprintFailed
      ? `Sprint ${sprintIdx} CHÁY DEADLINE (${fails} fail) — Tỉ số: Tốt ${room.goodWins} / Xấu ${room.badWins}. Team: ${teamSummary}.`
      : `Sprint ${sprintIdx} HOÀN THÀNH (${success} success) — Tỉ số: Tốt ${room.goodWins} / Xấu ${room.badWins}. Team: ${teamSummary}.`,
    sprintFailed ? 'bad' : 'good'
  );
  if (tlSaved) {
    appendLog(
      room,
      'skill',
      `Technical Leader vô hiệu hóa 1 fail — Sprint ${sprintIdx} được cứu.`,
      'good'
    );
  }
  if (tdOnTeam) {
    appendLog(
      room,
      'skill',
      `Technical Debt đã tham gia Sprint ${sprintIdx} — Sprint sau +1 người.`,
      'bad'
    );
  }

  room.currentSprint++;
  transitionAfterResult(room, tdOnTeam);

  await writeRoom(room);
  return room;
}

// After incrementing currentSprint, transition phase and reset per-sprint flags.
// Goes to night (tan ca) for next sprint, OR ended/discussion on terminal.
function transitionAfterResult(room: Room, techDebtOnPrevTeam: boolean): void {
  const now = Date.now();

  // Terminal: bad team wins outright.
  if (room.badWins >= 2) {
    room.phase = 'ended';
    room.phaseStartedAt = now;
    room.phaseDeadlineAt = null;
    appendLog(room, 'sprint', `Phe Phá Dự Án thắng (≥2 fail)!`, 'bad');
    return;
  }
  // Terminal: good team reached 3 wins → enter discussion (assassination).
  if (room.goodWins >= 3) {
    room.phase = 'discussion';
    room.phaseStartedAt = now;
    room.phaseDeadlineAt = now + TIMER_DEFAULTS.assassinationMs;
    appendLog(
      room,
      'phase',
      'Scrum Team đạt 3 sprint — vào vòng thảo luận lật kèo (60s).',
      'neutral'
    );
    return;
  }
  // Terminal: ran out of sprints.
  if (room.currentSprint >= 4) {
    room.phase = 'ended';
    room.phaseStartedAt = now;
    room.phaseDeadlineAt = null;
    appendLog(room, 'sprint', `Hết 4 sprint — game kết thúc.`, 'neutral');
    return;
  }

  // Stay in sprintResult briefly (20s) so QC redo / DA check window applies,
  // then advance to night (tan ca) via advanceFromSprintResult.
  room.phase = 'sprintResult';
  room.phaseStartedAt = now;
  room.phaseDeadlineAt = now + TIMER_DEFAULTS.postSprintMs;

  // Per-sprint resets (apply now so post-sprint skill window has clean state).
  room.sepSilencedPlayerId = null;
  room.deadlineSilenced = false;
  room.proposedTeam = [];
  room.votes = {};
  room.executionVotes = {};
  room.techLeadPresent = false;
  room.techDebtActive = techDebtOnPrevTeam;
  room.poSelectDeadlineAt = null;
  // Rotate PO to next alive player for the next sprint (per user spec:
  // "sprint tiếp theo thì lại tiếp tục với người thứ 4..."). This way each
  // sprint has a different PO unless a reject rotates mid-sprint.
  do {
    room.currentPO = (room.currentPO + 1) % room.players.length;
  } while (!room.players[room.currentPO]?.isAlive);
}

// Called by client after sprintResult acknowledged OR auto-expired.
// Moves from sprintResult → betweenSprintDiscussion (90s) for next sprint.
export async function advanceFromSprintResult(roomId: string, playerId?: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'sprintResult') return null;

  const now = Date.now();
  room.phase = 'betweenSprintDiscussion';
  room.phaseStartedAt = now;
  room.phaseDeadlineAt = now + TIMER_DEFAULTS.discussionMs;

  appendLog(
    room,
    'phase',
    `Sprint ${room.currentSprint} kết thúc — vào bàn luận 90s trước Giờ Tan Ca.`,
    'neutral'
  );
  await writeRoom(room);
  return room;
}

// Called by client after betweenSprintDiscussion acknowledged OR auto-expired.
// Moves from betweenSprintDiscussion → night (tan ca) for skill window.
export async function advanceFromDiscussion(roomId: string, playerId?: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'betweenSprintDiscussion') return null;

  const now = Date.now();
  room.phase = 'night';
  room.phaseStartedAt = now;
  // First night (after game start) uses nightFirstMs (30s);
  // subsequent nights use nightRecurringMs (60s). currentSprint > 0 ⇒ recurring.
  room.phaseDeadlineAt =
    now + (room.currentSprint === 0 ? TIMER_DEFAULTS.nightFirstMs : TIMER_DEFAULTS.nightRecurringMs);

  appendLog(
    room,
    'phase',
    `Sprint ${room.currentSprint + 1}: vào Giờ Tan Ca (skill window).`,
    'neutral'
  );
  await writeRoom(room);
  return room;
}

// Helper: returns true if every "skill-once-per-game" player in the room has
// already used their skill. Used to skip the night phase early.
export function allSkillsUsed(room: Room): boolean {
  const hasRole = (r: PlayerRole) => room.players.some((p) => p.isAlive && p.role === r);

  if (hasRole('Project Manager') && !room.pmOverrideUsed) return false;
  if (hasRole('Quality Controller') && !room.qcRedoUsed) return false;
  // Data Analyst skill only available from Sprint 2 (currentSprint >= 1).
  if (hasRole('Data Analyst') && room.currentSprint >= 1 && !room.dataAnalystCheckUsed) return false;
  // Business Analyst is a check skill — also trackable.
  if (hasRole('Business Analyst') && !room.businessAnalystCheckUsed) return false;
  if (hasRole('Deadline') && !room.deadlineUsed) return false;
  // Sếp is per-sprint (auto-resets each sprint) — never blocks skip.
  return true;
}

// Called by client to advance from night (tan ca) → planning (vào ca).
export async function nightAdvance(roomId: string, playerId?: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;

  const now = Date.now();
  room.phase = 'planning';
  room.phaseStartedAt = now;
  room.phaseDeadlineAt = now + TIMER_DEFAULTS.planningMs;
  room.poSelectDeadlineAt = now + TIMER_DEFAULTS.poSelectTeamMs;
  room.pmDeferredThisSprint = false;
  // TTS follow target persists across rounds; do not reset here.

  const poName = nameOf(room, room.players[room.currentPO]?.id ?? '');
  appendLog(
    room,
    'phase',
    `Sprint ${room.currentSprint + 1}: vào ca — ${poName} chuẩn bị đề xuất nhóm.`,
    'neutral'
  );
  await writeRoom(room);
  return room;
}

// Called by client after sprintResult is acknowledged — advances phase to planning.
// (Legacy endpoint — now delegates to advanceFromSprintResult.)
export async function advanceToPlanning(roomId: string, playerId: string): Promise<Room | null> {
  return advanceFromSprintResult(roomId, playerId);
}

// Generic auto-advance dispatcher: when a phase's deadline expires,
// call this to advance to the next phase appropriately.
export async function autoAdvancePhase(roomId: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;

  switch (room.phase) {
    case 'night':
      // Skip early if every skill-once-per-game player has used their skill.
      if (allSkillsUsed(room)) return nightAdvance(roomId);
      return nightAdvance(roomId);
    case 'betweenSprintDiscussion':
      return advanceFromDiscussion(roomId);
    case 'sprintResult':
      return advanceFromSprintResult(roomId);
    case 'teamVoting':
      return autoFillTeamVote(roomId);
    case 'execution':
      return autoFillExecutionVote(roomId);
    case 'planning': {
      // PO selection timeout — auto-pick random team.
      if (
        room.poSelectDeadlineAt &&
        Date.now() >= room.poSelectDeadlineAt
      ) {
        return autoSelectTeam(roomId);
      }
      // Otherwise planning discussion timer expiration is non-terminal — just refresh.
      return room;
    }
    case 'discussion':
      // Auto-end discussion (no saboteur-guess was made in time).
      room.phase = 'ended';
      room.phaseDeadlineAt = null;
      appendLog(
        room,
        'phase',
        'Hết thời gian thảo luận lật kèo — Scrum Team thắng!',
        'good'
      );
      await writeRoom(room);
      return room;
    default:
      return room;
  }
}

// PO selection timeout → randomly pick requiredSize alive players and submit.
export async function autoSelectTeam(roomId: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'planning') return null;

  const required = getSprintSize(room.players.length, room.currentSprint, room.techDebtActive);
  const alive = room.players.filter((p) => p.isAlive);
  const shuffled = shuffleArray(alive);
  const picked = shuffled.slice(0, required).map((p) => p.id);

  return proposeTeam(roomId, room.players[room.currentPO]?.id ?? '', picked);
}

export async function saboteurGuess(
  roomId: string,
  playerId: string,
  guessedSmId: string
): Promise<{ winner: string; correct: boolean; room: Room } | null> {
  const room = await readRoom(roomId);
  if (!room) return null;

  // Saboteur can only guess after at least 1 good win, and only at end of game.
  if (room.goodWins < 1) return null;

  const saboteur = findPlayer(room, playerId);
  if (!saboteur || saboteur.role !== 'Người trễ task') return null;

  const SM = room.players.find((p) => p.role === 'Scrum Master');
  const correct = Boolean(SM && SM.id === guessedSmId);

  room.phase = 'ended';
  room.phaseDeadlineAt = null;
  room.saboteurGuess = guessedSmId;
  if (correct) {
    // Bad team flips the win — set badWins so client win detection picks it up.
    room.badWins = Math.max(room.badWins, 2);
  }
  appendLog(
    room,
    'sprint',
    correct
      ? `Lật kèo THÀNH CÔNG — ${nameOf(room, playerId)} chỉ điểm đúng Scrum Master. Phe Phá Dự Án thắng!`
      : `Lật kèo THẤT BẠI — ${nameOf(room, playerId)} chỉ nhầm ${nameOf(room, guessedSmId)}. Scrum Team thắng!`,
    correct ? 'bad' : 'good'
  );
  await writeRoom(room);

  return { winner: correct ? 'bad' : 'good', correct, room };
}

// ===== Skill: Project Manager override =====

export async function skillPmOverride(
  roomId: string,
  playerId: string,
  playerIds: string[]
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  // Per new spec: PM override can only be set up during night phase.
  if (room.phase !== 'night') return null;

  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Project Manager') return null;
  if (room.pmOverrideUsed) return null;
  if (room.pmDeferredThisSprint) return null; // already deferred this sprint

  const expectedSize = getSprintSize(room.players.length, room.currentSprint, room.techDebtActive);
  if (playerIds.length !== expectedSize) return null;

  const now = Date.now();
  room.proposedTeam = playerIds;
  room.votes = {};
  room.executionVotes = {};
  room.pmOverrideUsed = true;
  room.pmDeferredThisSprint = true; // committed — can't defer anymore this sprint
  room.consecutiveDelays = 0;
  room.techLeadPresent = playerIds.some((id) => findPlayer(room, id)?.role === 'Technical Leader');
  room.phase = 'execution'; // skip teamVoting entirely
  room.phaseStartedAt = now;
  room.phaseDeadlineAt = now + TIMER_DEFAULTS.executionVoteMs;
  room.poSelectDeadlineAt = null;

  const team = playerIds.map((id) => nameOf(room, id)).join(', ');
  appendLog(
    room,
    'skill',
    `PM Override — ${nameOf(room, playerId)} chỉ định nhóm (${playerIds.length} người) bỏ qua biểu quyết: ${team}.`,
    'neutral'
  );
  await writeRoom(room);
  return room;
}

// PM explicitly defers using override this sprint — keeps 1-shot for a future sprint.
export async function skillPmDefer(
  roomId: string,
  playerId: string
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;
  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Project Manager') return null;
  if (room.pmOverrideUsed) return null;
  if (room.pmDeferredThisSprint) return null;
  room.pmDeferredThisSprint = true;
  await writeRoom(room);
  return room;
}

// ===== Skill: Business Analyst check =====
// Private result returned to caller only; never stored in room.state.
// Kẻ fake CV: appears as good even though they're bad.

export interface BACheckResult {
  result: 'Yes' | 'No';
}

export async function skillBusinessAnalystCheck(
  roomId: string,
  playerId: string,
  targetIds: [string, string]
): Promise<{ room: Room; private: BACheckResult } | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;

  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Business Analyst') return null;
  if (room.businessAnalystCheckUsed) return null;

  const [a, b] = targetIds;
  const targetA = findPlayer(room, a);
  const targetB = findPlayer(room, b);
  if (!targetA || !targetB || a === b) return null;

  const isEffectivelyBad = (p: Player) => {
    if (p.role === 'Kẻ fake CV') return false; // lies to BA
    return p.role ? (ROLES.BAD as readonly string[]).includes(p.role) : false;
  };
  const anyBad = isEffectivelyBad(targetA) || isEffectivelyBad(targetB);

  room.businessAnalystCheckUsed = true;
  appendLog(
    room,
    'skill',
    `Business Analyst ${nameOf(room, playerId)} kiểm tra ${nameOf(room, a)} & ${nameOf(room, b)} — kết quả: ${anyBad ? 'Yes' : 'No'}.`,
    'neutral'
  );
  await writeRoom(room);

  return { room, private: { result: anyBad ? 'Yes' : 'No' } };
}

// ===== Skill: Quality Controller (good) redo =====

export async function skillQcRedo(
  roomId: string,
  playerId: string
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;

  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Quality Controller') return null;
  if (room.qcRedoUsed) return null;

  // The just-completed sprint is at prevSprintIndex (currentSprint was incremented).
  const prevIdx = room.prevSprintIndex;
  if (prevIdx < 0) return null;

  // Roll back the just-counted sprint outcome.
  // We don't know which side won the last sprint from room alone — recompute from prevExecutionVotes.
  let fails = 0;
  for (const [pid, v] of Object.entries(room.prevExecutionVotes)) {
    if (v !== 'fail') continue;
    const p = findPlayer(room, pid);
    fails += p?.role === 'QC cẩu thả' ? 2 : 1;
  }
  const doubleFail = requiresDoubleFail(room.players.length, prevIdx);
  let lastFailed = doubleFail ? fails >= 2 : fails >= 1;
  // techLead save (mirror tally logic): only neutralizes when exactly 1 fail and TL was on team.
  const tlOnPrev = room.prevSprintTeam.some((id) => findPlayer(room, id)?.role === 'Technical Leader');
  if (lastFailed && tlOnPrev && fails === 1) lastFailed = false;

  if (lastFailed) {
    room.badWins = Math.max(0, room.badWins - 1);
  } else {
    room.goodWins = Math.max(0, room.goodWins - 1);
  }

  // Rewind to the sprint that was just played.
  room.currentSprint = Math.max(0, prevIdx);
  room.qcRedoUsed = true;
  const now = Date.now();
  room.phase = 'planning';
  room.phaseStartedAt = now;
  room.phaseDeadlineAt = now + TIMER_DEFAULTS.planningMs;
  room.poSelectDeadlineAt = now + TIMER_DEFAULTS.poSelectTeamMs;
  room.proposedTeam = [];
  room.votes = {};
  room.executionVotes = {};
  room.techLeadPresent = false;
  // Rotate PO back to whoever was PO for the rerun sprint — simplest: keep current PO.
  // (We rotated PO once in advanceAfterSprint; rotate it back.)
  do {
    room.currentPO = (room.currentPO - 1 + room.players.length) % room.players.length;
  } while (!room.players[room.currentPO]?.isAlive);

  // Pop the last sprint history entry since we're rolling back.
  if (room.sprintHistory.length > 0) {
    room.sprintHistory = room.sprintHistory.slice(0, -1);
  }

  appendLog(
    room,
    'skill',
    `QC Redo — ${nameOf(room, playerId)} yêu cầu làm lại Sprint ${prevIdx + 1}. Quay về Planning.`,
    'neutral'
  );
  await writeRoom(room);
  return room;
}

// ===== Skill: Data Analyst check =====

export interface DACheckResult {
  result: 'success' | 'fail';
  targetId: string;
}

export async function skillDataAnalystCheck(
  roomId: string,
  playerId: string,
  targetId: string
): Promise<{ room: Room; private: DACheckResult } | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;

  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Data Analyst') return null;
  if (room.dataAnalystCheckUsed) return null;
  // Need at least one completed sprint.
  if (room.prevSprintIndex < 0) return null;
  if (!room.prevSprintTeam.includes(targetId)) return null;

  const v = room.prevExecutionVotes[targetId];
  if (v !== 'success' && v !== 'fail') return null;

  room.dataAnalystCheckUsed = true;
  appendLog(
    room,
    'skill',
    `Data Analyst ${nameOf(room, playerId)} kiểm tra phiếu của ${nameOf(room, targetId)} (Sprint ${room.prevSprintIndex + 1}) — kết quả: ${v === 'success' ? 'Hoàn thành' : 'Cháy deadline'}.`,
    'neutral'
  );
  await writeRoom(room);

  return { room, private: { result: v, targetId } };
}

// ===== Skill: Ông sếp khó ưa silence =====

export async function skillSepSilence(
  roomId: string,
  playerId: string,
  targetId: string
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;

  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Ông sếp khó ưa') return null;
  if (room.sepSilencedPlayerId) return null; // already used this sprint

  const target = findPlayer(room, targetId);
  if (!target) return null;

  room.sepSilencedPlayerId = targetId;
  appendLog(
    room,
    'skill',
    `Sếp khó ưa ${nameOf(room, playerId)} khóa miệng ${nameOf(room, targetId)} trong Sprint này.`,
    'bad'
  );
  await writeRoom(room);
  return room;
}

// ===== Skill: Deadline silence-all =====

export async function skillDeadlineSilence(
  roomId: string,
  playerId: string
): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  if (room.phase !== 'night') return null;

  const me = findPlayer(room, playerId);
  if (!me || me.role !== 'Deadline') return null;
  if (room.deadlineUsed) return null;

  room.deadlineUsed = true;
  room.deadlineSilenced = true;
  appendLog(
    room,
    'skill',
    `Deadline kích hoạt — ${nameOf(room, playerId)} cấm chat toàn bộ team trong Sprint này.`,
    'bad'
  );
  await writeRoom(room);
  return room;
}

// Poll-based sync for client (fallback when Realtime unavailable)
export async function pollRoom(roomId: string): Promise<Room | null> {
  return readRoom(roomId);
}

// ===== Room reset (end-of-game → back to lobby) =====
// Keeps the player roster; wipes gameplay state so the same room can host
// a fresh match. Allowed from any phase (typically called from `ended`).
export async function resetRoom(roomId: string, playerId: string): Promise<Room | null> {
  const room = await readRoom(roomId);
  if (!room) return null;
  // Caller must be a current member of the room.
  if (!findPlayer(room, playerId)) return null;

  // Preserve player list + identities, reset everything else.
  room.phase = 'lobby';
  room.currentPO = 0;
  room.currentSprint = 0;
  room.proposedTeam = [];
  room.votes = {};
  room.executionVotes = {};
  room.consecutiveDelays = 0;
  room.goodWins = 0;
  room.badWins = 0;
  room.saboteurGuess = null;
  room.pmOverrideUsed = false;
  room.dataAnalystCheckUsed = false;
  room.businessAnalystCheckUsed = false;
  room.qcRedoUsed = false;
  room.deadlineUsed = false;
  room.sepSilencedPlayerId = null;
  room.deadlineSilenced = false;
  room.techDebtActive = false;
  room.techLeadPresent = false;
  room.ttsFollowTargetId = null;
  room.prevSprintTeam = [];
  room.prevExecutionVotes = {};
  room.prevSprintIndex = -1;
  room.sprintHistory = [];
  room.phaseStartedAt = null;
  room.phaseDeadlineAt = null;
  room.pmDeferredThisSprint = false;
  room.clientId = null;
  room.poSelectDeadlineAt = null;
  // Clear per-player role + revive anyone marked dead.
  for (const p of room.players) {
    p.role = undefined as unknown as PlayerRole;
    p.isAlive = true;
  }
  // Re-pick the first alive player as PO (in case index 0 was killed mid-game).
  if (!room.players[room.currentPO]?.isAlive) {
    const firstAlive = room.players.findIndex((p) => p.isAlive);
    room.currentPO = firstAlive >= 0 ? firstAlive : 0;
  }
  // Wipe log so the new game starts with a clean timeline.
  room.gameLog = [];
  appendLog(
    room,
    'system',
    `Phòng reset bởi ${nameOf(room, playerId)} — bắt đầu ván mới.`,
    'neutral'
  );

  await writeRoom(room);
  return room;
}

// ===== Player self-service =====

// Allow a player to change their display name at any time during the game.
// Useful after joining via shared link (name was set on landing page) or
// to fix a typo. The new name syncs to all clients via Supabase Realtime.
export async function renamePlayer(
  roomId: string,
  playerId: string,
  newName: string
): Promise<Room | null> {
  const trimmed = newName.trim().slice(0, 20);
  if (!trimmed) return null;
  const room = await readRoom(roomId);
  if (!room) return null;
  const me = room.players.find((p) => p.id === playerId);
  if (!me) return null;
  me.name = trimmed;
  await writeRoom(room);
  return room;
}

// Re-exports for tests (kept for backwards compat with route handlers).
export type { Phase, Vote, PlayerRole };

// ===== Information disclosure control =====
// Each player must only see roles their role is allowed to know.
// This prevents DevTools / Network-tab / sessionStorage cache leaks of
// other players' roles. Default rule: strip role on every player except
// the viewer; allow-list specific reveals per game rules.
//
// Reveal rules:
//   - Viewer always sees their own role.
//   - 'Scrum Master' sees ALL roles (must identify bad team from start).
//   - 'Người trễ task' sees other saboteurs' roles.
//   - 'Client' sees 'Business Analyst' role.
//   - 'Business Analyst' sees 'Client' role.
//   - During 'ended' phase, everyone sees everything (game over reveal).
//   - 'lobby' / 'night' of the first turn: only viewer (other roles not assigned yet).
//
// Pass `null` for viewerId to strip all roles (e.g. unauthenticated GET).
export function sanitizeRoomForPlayer<T extends Room>(room: T, viewerId: string | null): T {
  const cloned: T = {
    ...room,
    players: room.players.map((p) => ({ ...p })),
  };

  if (!viewerId) {
    // Anonymous viewer: strip everything.
    for (const p of cloned.players) delete (p as { role?: PlayerRole }).role;
    return cloned;
  }

  const viewer = cloned.players.find((p) => p.id === viewerId);
  const viewerRole = viewer?.role as PlayerRole | undefined;
  const revealAll = cloned.phase === 'ended';

  // Build a set of playerIds whose role the viewer is allowed to see.
  const allowed = new Set<string>([viewerId]);
  if (revealAll) {
    for (const p of cloned.players) allowed.add(p.id);
  } else if (viewerRole === 'Scrum Master') {
    for (const p of cloned.players) allowed.add(p.id);
  } else if (viewerRole === 'Người trễ task') {
    for (const p of cloned.players) {
      if (p.role === 'Người trễ task') allowed.add(p.id);
    }
  } else if (viewerRole === 'Client') {
    for (const p of cloned.players) {
      if (p.role === 'Business Analyst') allowed.add(p.id);
    }
  } else if (viewerRole === 'Business Analyst') {
    for (const p of cloned.players) {
      if (p.role === 'Client') allowed.add(p.id);
    }
  }

  for (const p of cloned.players) {
    if (!allowed.has(p.id)) {
      delete (p as { role?: PlayerRole }).role;
    }
  }
  return cloned;
}
