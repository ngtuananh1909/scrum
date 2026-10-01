import { GAME_CONFIG, phaseDuration, requiredTeamSize, requiresTwoFails } from './config';
import { factionForRole, isRoleSetValid } from './presets';
import type {
  ExecutionVote, GameCommand, GameEvent, GamePhase, GamePlayer, GameState, PrivateEffect,
  SprintOutcome, TransitionContext, TransitionRejectionCode, TransitionResult,
} from './types';

export interface CreateGameStateInput {
  id: string;
  /** Players must be supplied in stable joined_order seat order. */
  players: GamePlayer[];
  leaderId: string;
  now: number;
}

export function createGameState(input: CreateGameStateInput): GameState {
  if (new Set(input.players.map((player) => player.id)).size !== input.players.length) throw new Error('Player IDs must be unique');
  if (!isRoleSetValid(input.players.map((player) => player.role), input.players.length)) throw new Error('Invalid role set');
  const leaderIndex = input.players.findIndex((player) => player.id === input.leaderId);
  if (leaderIndex < 0) throw new Error('Leader must be a player');
  return {
    id: input.id,
    players: input.players.map((player) => ({ ...player })),
    phase: 'roleReveal', phaseVersion: 0, phaseStartedAt: input.now,
    phaseDeadlineAt: input.now + phaseDuration('roleReveal'), teamSelectionDeadlineAt: null,
    revision: 0, sprintIndex: 0, leaderIndex,
    requiredTeamSize: requiredTeamSize(input.players.length, 0, 0),
    teamIds: [], teamVotes: {}, executionVotes: {}, teamVoteOutcome: null, teamVoteRevealVotes: null,
    executionReveal: null, rejectedTeams: 0, goodWins: 0, badWins: 0, nextTeamSizeBonus: 0,
    ttsFollowTargetId: null,
    skills: { pmOverrideUsed: false, qcRedoUsed: false, baCheckUsed: false, daCheckUsed: false, deadlineUsed: false, bossUsedForSprint: false },
    chatPolicy: { allMuted: false, mutedPlayerId: null }, checkpoint: null, history: [],
    winner: null, endReason: null, publicEvents: [],
    privateEffects: [],
  };
}

export function transition(state: GameState, command: GameCommand, context: TransitionContext): TransitionResult {
  if (command.expectedPhaseVersion !== state.phaseVersion) return reject(state, 'STALE_PHASE', 'The room has advanced; refresh before retrying.');
  if (command.actorId !== null && !player(state, command.actorId)) return reject(state, 'UNKNOWN_ACTOR', 'Actor is not in this game.');
  if (command.actorId !== null && state.phaseDeadlineAt !== null && context.now >= state.phaseDeadlineAt) {
    return reject(state, 'PHASE_EXPIRED', 'This phase has expired.');
  }
  const next = structuredClone(state) as GameState;
  next.privateEffects ??= [];
  const events: GameEvent[] = [];
  const privateEffects: PrivateEffect[] = [];
  const random = context.random ?? Math.random;

  switch (command.type) {
    case 'setTtsTarget': {
      if (!isPhase(next, 'firstNight')) return reject(state, 'INVALID_PHASE', 'TTS target is only selected during the first night.');
      if (!hasRole(next, command.actorId, 'Thực tập sinh')) return reject(state, 'NOT_AUTHORIZED', 'Only the intern may choose a target.');
      if (next.ttsFollowTargetId) return reject(state, 'ACTION_ALREADY_USED', 'The intern has already chosen a target.');
      if (!validTarget(next, command.targetId) || command.targetId === command.actorId) return reject(state, 'INVALID_TARGET', 'Choose another player in this room.');
      next.ttsFollowTargetId = command.targetId;
      break;
    }
    case 'setTeam': {
      if (!isPhase(next, 'teamSelection')) return reject(state, 'INVALID_PHASE', 'Teams are chosen during team selection.');
      if (leaderId(next) !== command.actorId) return reject(state, 'NOT_AUTHORIZED', 'Only the current PO may select a team.');
      if (!isValidTeamDraft(next, command.teamIds)) return reject(state, 'INVALID_TEAM', 'Team draft must contain distinct players from this room.');
      next.teamIds = [...command.teamIds];
      break;
    }
    case 'finalizeTeam': {
      if (!isPhase(next, 'teamSelection')) return reject(state, 'INVALID_PHASE', 'Teams are finalized during team selection.');
      if (leaderId(next) !== command.actorId) return reject(state, 'NOT_AUTHORIZED', 'Only the current PO may finalize a team.');
      if (!isValidTeam(next, command.teamIds)) return reject(state, 'INVALID_TEAM', 'Team must contain the required number of distinct players.');
      next.teamIds = [...command.teamIds];
      enter(next, 'teamVoting', context.now, events);
      break;
    }
    case 'usePmOverride': {
      if (!(isPhase(next, 'planningDiscussion') || isPhase(next, 'teamSelection'))) return reject(state, 'INVALID_PHASE', 'PM override is available before the PO finalizes a team.');
      if (!hasRole(next, command.actorId, 'Project Manager') || next.skills.pmOverrideUsed) return reject(state, 'SKILL_UNAVAILABLE', 'PM override is unavailable.');
      if (!isValidTeam(next, command.teamIds)) return reject(state, 'INVALID_TEAM', 'Team must contain the required number of distinct players.');
      next.teamIds = [...command.teamIds];
      next.skills.pmOverrideUsed = true;
      next.rejectedTeams = 0;
      enter(next, 'execution', context.now, events);
      event(events, 'skillUsed', { skill: 'pmOverride' });
      break;
    }
    case 'castTeamVote': {
      if (!isPhase(next, 'teamVoting')) return reject(state, 'INVALID_PHASE', 'Team voting is closed.');
      if (!command.actorId || next.teamVotes[command.actorId]) return reject(state, 'ALREADY_VOTED', 'This player already voted.');
      if (command.vote !== 'approve' && command.vote !== 'reject') return reject(state, 'INVALID_VOTE', 'Choose approve or reject.');
      next.teamVotes[command.actorId] = command.vote;
      if (Object.keys(next.teamVotes).length === next.players.length) resolveTeamVote(next, context.now, events);
      break;
    }
    case 'resolveTeamVote': {
      if (!isPhase(next, 'teamVoting') || command.actorId !== null) return reject(state, 'INVALID_PHASE', 'Only the system resolves team votes.');
      if (next.phaseDeadlineAt === null || context.now < next.phaseDeadlineAt) return reject(state, 'NOT_EXPIRED', 'The team vote is still open.');
      fillMissingTeamVotes(next, 'reject');
      resolveTeamVote(next, context.now, events);
      break;
    }
    case 'castExecutionVote': {
      if (!isPhase(next, 'execution')) return reject(state, 'INVALID_PHASE', 'Execution voting is closed.');
      if (!command.actorId || !next.teamIds.includes(command.actorId)) return reject(state, 'NOT_AUTHORIZED', 'Only the selected team can vote.');
      if (next.executionVotes[command.actorId]) return reject(state, 'ALREADY_VOTED', 'This player already voted.');
      if (command.vote !== 'success' && command.vote !== 'fail') return reject(state, 'INVALID_VOTE', 'Choose success or fail.');
      if (command.vote === 'fail' && factionForRole(player(next, command.actorId)!.role) === 'good') return reject(state, 'INVALID_VOTE', 'Good roles must vote success.');
      next.executionVotes[command.actorId] = command.vote;
      if (Object.keys(next.executionVotes).length === next.teamIds.length) resolveExecution(next, context.now, random, events);
      break;
    }
    case 'resolveExecution': {
      if (!isPhase(next, 'execution') || command.actorId !== null) return reject(state, 'INVALID_PHASE', 'Only the system resolves execution votes.');
      if (next.phaseDeadlineAt === null || context.now < next.phaseDeadlineAt) return reject(state, 'NOT_EXPIRED', 'Execution voting is still open.');
      for (const id of next.teamIds) if (!next.executionVotes[id]) next.executionVotes[id] = 'success';
      resolveExecution(next, context.now, random, events);
      break;
    }
    case 'useBossSilence': {
      if (!isPhase(next, 'planningDiscussion') || !hasRole(next, command.actorId, 'Ông sếp khó ưa') || next.skills.bossUsedForSprint) return reject(state, 'SKILL_UNAVAILABLE', 'Boss silence is unavailable.');
      if (!validTarget(next, command.targetId)) return reject(state, 'INVALID_TARGET', 'Target is not in this room.');
      next.skills.bossUsedForSprint = true;
      next.chatPolicy.mutedPlayerId = command.targetId;
      event(events, 'skillUsed', { skill: 'bossSilence' });
      break;
    }
    case 'useDeadlineSilence': {
      if (!isPhase(next, 'planningDiscussion') || !hasRole(next, command.actorId, 'Deadline') || next.skills.deadlineUsed) return reject(state, 'SKILL_UNAVAILABLE', 'Deadline silence is unavailable.');
      next.skills.deadlineUsed = true;
      next.chatPolicy.allMuted = true;
      event(events, 'skillUsed', { skill: 'deadlineSilence' });
      break;
    }
    case 'useBaCheck': {
      if (!(isPhase(next, 'firstNight') || isPhase(next, 'planningDiscussion')) || !hasRole(next, command.actorId, 'Business Analyst') || next.skills.baCheckUsed) return reject(state, 'SKILL_UNAVAILABLE', 'BA check is unavailable.');
      if (!Array.isArray(command.targetIds) || command.targetIds.length !== 2) return reject(state, 'INVALID_TARGET', 'Choose two distinct players.');
      const [first, second] = command.targetIds;
      if (!validTarget(next, first) || !validTarget(next, second) || first === second) return reject(state, 'INVALID_TARGET', 'Choose two distinct players.');
      next.skills.baCheckUsed = true;
      const targets = [player(next, first)!, player(next, second)!];
      privateEffects.push({ commandId: command.commandId, viewerId: command.actorId!, kind: 'baCheck', result: targets.some(isBadToBa) ? 'yes' : 'no' });
      break;
    }
    case 'useDaCheck': {
      if (!isPhase(next, 'sprintResult') || !hasRole(next, command.actorId, 'Data Analyst') || next.skills.daCheckUsed) return reject(state, 'SKILL_UNAVAILABLE', 'DA check is unavailable.');
      if (!next.teamIds.includes(command.targetId) || !next.executionVotes[command.targetId]) return reject(state, 'INVALID_TARGET', 'Target must have voted in the sprint that just ended.');
      next.skills.daCheckUsed = true;
      privateEffects.push({ commandId: command.commandId, viewerId: command.actorId!, kind: 'daCheck', targetId: command.targetId, vote: next.executionVotes[command.targetId] });
      break;
    }
    case 'useQcRedo': {
      if (!isPhase(next, 'sprintResult') || !hasRole(next, command.actorId, 'Quality Controller') || next.skills.qcRedoUsed || !next.checkpoint) return reject(state, 'SKILL_UNAVAILABLE', 'QC redo is unavailable.');
      restoreCheckpoint(next, context.now, events);
      next.skills.qcRedoUsed = true;
      event(events, 'skillUsed', { skill: 'qcRedo' });
      break;
    }
    case 'guessScrumMaster': {
      if (!isPhase(next, 'assassination') || !hasRole(next, command.actorId, 'Người trễ task')) return reject(state, 'NOT_AUTHORIZED', 'Only the task-delayer may make an assassination guess.');
      const target = player(next, command.targetId);
      if (!target || factionForRole(target.role) !== 'good') return reject(state, 'INVALID_TARGET', 'Choose a member of the Scrum Team.');
      const correct = player(next, command.targetId)!.role === 'Scrum Master';
      end(next, correct ? 'bad' : 'good', 'assassinationGuess', context.now, events);
      break;
    }
    case 'react': {
      if (!command.actorId || state.phase === 'ended' || state.phase === 'roleReveal' || state.phase === 'firstNight') {
        return reject(state, 'NOT_AUTHORIZED', 'Reactions are unavailable in this phase.');
      }
      if (next.chatPolicy.allMuted || next.chatPolicy.mutedPlayerId === command.actorId) {
        return reject(state, 'NOT_AUTHORIZED', 'Reactions are disabled while you are silenced.');
      }
      if (!['🤨', '😂', '💀', '🔥', '👀', '🤡'].includes(command.emoji)) {
        return reject(state, 'INVALID_REACTION', 'Choose a supported reaction.');
      }
      if (command.targetType === 'player') {
        if (!command.targetPlayerId || !validTarget(next, command.targetPlayerId)) return reject(state, 'INVALID_TARGET', 'Choose a player in this room.');
      } else if (command.targetType === 'proposal') {
        if (!next.teamIds.length || command.targetPlayerId) return reject(state, 'INVALID_TARGET', 'No current proposal is available.');
      } else if (command.targetType === 'sprintResult') {
        if (!next.history.length || command.targetPlayerId) return reject(state, 'INVALID_TARGET', 'No Sprint result is available.');
      } else {
        return reject(state, 'INVALID_REACTION', 'Choose a valid reaction target.');
      }
      event(events, 'reaction', {
        actorPlayerId: command.actorId, emoji: command.emoji,
        targetType: command.targetType, targetPlayerId: command.targetPlayerId ?? null,
      });
      break;
    }
    case 'expirePhase': {
      if (command.actorId !== null) return reject(state, 'NOT_AUTHORIZED', 'Only the system expires phases.');
      const expired = next.phaseDeadlineAt !== null && context.now >= next.phaseDeadlineAt;
      if (!expired) return reject(state, 'NOT_EXPIRED', 'This phase has not expired.');
      const expiredResult = expire(next, context.now, random, events);
      if (expiredResult) return reject(state, expiredResult, 'Phase cannot expire.');
      break;
    }
    default:
      return reject(state, 'INVALID_PHASE', 'Unknown game command.');
  }

  next.privateEffects.push(...privateEffects.map((effect) => ({ ...effect })));
  next.revision += 1;
  next.publicEvents = [...next.publicEvents, ...events].slice(-100);
  return { ok: true, state: next, events, privateEffects };
}

function expire(state: GameState, now: number, random: () => number, events: GameEvent[]): TransitionRejectionCode | null {
  switch (state.phase) {
    case 'roleReveal': enter(state, 'firstNight', now, events); return null;
    case 'firstNight':
      if (!state.ttsFollowTargetId) {
        const intern = state.players.find((candidate) => candidate.role === 'Thực tập sinh');
        if (intern) {
          const targets = state.players.filter((candidate) => candidate.id !== intern.id);
          if (targets.length > 0) state.ttsFollowTargetId = targets[randomIndex(targets.length, random)].id;
        }
      }
      beginPlanning(state, now, events); return null;
    case 'planningDiscussion':
      enter(state, 'teamSelection', now, events);
      return null;
    case 'teamSelection':
      state.teamIds = randomTeam(state, random);
      enter(state, 'teamVoting', now, events);
      return null;
    case 'teamVoting': fillMissingTeamVotes(state, 'reject'); resolveTeamVote(state, now, events); return null;
    case 'teamVoteReveal':
      if (state.teamVoteOutcome?.accepted) {
        state.teamVotes = {}; state.teamVoteOutcome = null; state.teamVoteRevealVotes = null;
        enter(state, 'execution', now, events);
      } else if (state.rejectedTeams >= GAME_CONFIG.badWinRejectedTeams) {
        end(state, 'bad', 'fourRejectedTeams', now, events);
      } else {
        state.teamIds = []; state.teamVotes = {}; state.teamVoteOutcome = null; state.teamVoteRevealVotes = null;
        state.leaderIndex = nextLeader(state);
        beginPlanning(state, now, events);
      }
      return null;
    case 'execution': for (const id of state.teamIds) if (!state.executionVotes[id]) state.executionVotes[id] = 'success'; resolveExecution(state, now, random, events); return null;
    case 'executionReveal': settleSprint(state, now, events); return null;
    case 'sprintResult':
      if (state.badWins >= GAME_CONFIG.badWinFailedSprints) end(state, 'bad', 'threeFailedSprints', now, events);
      else if (state.goodWins >= GAME_CONFIG.goodWinsForAssassination) enter(state, 'assassination', now, events);
      else if (state.sprintIndex >= 5) end(state, state.goodWins > state.badWins ? 'good' : 'bad', 'fiveSprintTiebreak', now, events);
      else beginPlanning(state, now, events);
      return null;
    case 'assassination': end(state, 'good', 'assassinationDeadline', now, events); return null;
    case 'ended': return 'INVALID_PHASE';
  }
}

function resolveTeamVote(state: GameState, now: number, events: GameEvent[]): void {
  const votes = state.teamVotes;
  const ttsMultiplier = state.sprintIndex >= 1 && state.ttsFollowTargetId;
  let approveWeight = 0; let rejectWeight = 0;
  for (const person of state.players) {
    const vote = votes[person.id] ?? 'reject';
    const weight = ttsMultiplier === person.id ? 2 : 1;
    if (vote === 'approve') approveWeight += weight; else rejectWeight += weight;
  }
  const accepted = approveWeight > rejectWeight;
  state.teamVoteOutcome = { approveWeight, rejectWeight, accepted };
  state.teamVoteRevealVotes = { ...votes };
  if (accepted) state.rejectedTeams = 0; else state.rejectedTeams += 1;
  enter(state, 'teamVoteReveal', now, events);
  event(events, accepted ? 'teamAccepted' : 'teamRejected', { approveWeight, rejectWeight });
}

function resolveExecution(state: GameState, now: number, random: () => number, events: GameEvent[]): void {
  let failWeight = 0;
  const ballots: ExecutionVote[] = [];
  for (const id of state.teamIds) {
    const vote = state.executionVotes[id] ?? 'success';
    ballots.push(vote);
    if (vote === 'fail') failWeight += player(state, id)?.role === 'QC cẩu thả' ? 2 : 1;
  }
  const hasTechnicalLeader = state.teamIds.some((id) => player(state, id)?.role === 'Technical Leader');
  let outcome: SprintOutcome = failWeight >= (requiresTwoFails(state.players.length, state.sprintIndex) ? 2 : 1) ? 'fail' : 'success';
  if (outcome === 'fail' && hasTechnicalLeader && failWeight === 1) outcome = 'success';
  state.executionReveal = { ballots: shuffle(ballots, random), failWeight, outcome };
  enter(state, 'executionReveal', now, events);
}

function settleSprint(state: GameState, now: number, events: GameEvent[]): void {
  const reveal = state.executionReveal!;
  const technicalDebtApplied = state.teamIds.some((id) => player(state, id)?.role === 'Technical Debt');
  state.history.push({ sprintNumber: state.sprintIndex + 1, teamIds: [...state.teamIds], outcome: reveal.outcome, failWeight: reveal.failWeight, technicalDebtApplied });
  if (reveal.outcome === 'success') state.goodWins += 1; else state.badWins += 1;
  state.sprintIndex += 1;
  state.nextTeamSizeBonus = technicalDebtApplied ? 1 : 0;
  state.leaderIndex = nextLeader(state);
  event(events, 'sprintResolved', { outcome: reveal.outcome, goodWins: state.goodWins, badWins: state.badWins });
  enter(state, 'sprintResult', now, events);
}

function beginPlanning(state: GameState, now: number, events: GameEvent[]): void {
  state.requiredTeamSize = requiredTeamSize(state.players.length, state.sprintIndex, state.nextTeamSizeBonus);
  state.teamIds = []; state.teamVotes = {}; state.teamVoteOutcome = null; state.teamVoteRevealVotes = null;
  state.executionVotes = {}; state.executionReveal = null; state.chatPolicy = { allMuted: false, mutedPlayerId: null };
  state.skills.bossUsedForSprint = false;
  state.checkpoint = {
    sprintIndex: state.sprintIndex, leaderIndex: state.leaderIndex, requiredTeamSize: state.requiredTeamSize,
    nextTeamSizeBonus: state.nextTeamSizeBonus, goodWins: state.goodWins, badWins: state.badWins,
    rejectedTeams: state.rejectedTeams, history: state.history.map((record) => ({ ...record, teamIds: [...record.teamIds] })),
    publicEvents: state.publicEvents.map((event) => ({ ...event, data: { ...event.data } })),
  };
  enter(state, 'planningDiscussion', now, events);
}

function restoreCheckpoint(state: GameState, now: number, events: GameEvent[]): void {
  const checkpoint = state.checkpoint!;
  state.sprintIndex = checkpoint.sprintIndex; state.leaderIndex = checkpoint.leaderIndex;
  state.requiredTeamSize = checkpoint.requiredTeamSize; state.nextTeamSizeBonus = checkpoint.nextTeamSizeBonus;
  state.goodWins = checkpoint.goodWins; state.badWins = checkpoint.badWins; state.rejectedTeams = checkpoint.rejectedTeams;
  state.history = checkpoint.history.map((record) => ({ ...record, teamIds: [...record.teamIds] }));
  if (checkpoint.publicEvents) state.publicEvents = checkpoint.publicEvents.map((event) => ({ ...event, data: { ...event.data } }));
  state.teamIds = []; state.teamVotes = {}; state.teamVoteOutcome = null; state.teamVoteRevealVotes = null;
  state.executionVotes = {}; state.executionReveal = null; state.chatPolicy = { allMuted: false, mutedPlayerId: null };
  state.skills.bossUsedForSprint = false;
  enter(state, 'planningDiscussion', now, events);
}

function enter(state: GameState, phase: GamePhase, now: number, events: GameEvent[]): void {
  state.phase = phase; state.phaseVersion += 1; state.phaseStartedAt = now;
  state.phaseDeadlineAt = phase === 'ended' ? null : now + phaseDuration(phase);
  state.teamSelectionDeadlineAt = phase === 'teamSelection' ? state.phaseDeadlineAt : null;
  if (phase === 'teamVoting' || phase === 'execution') state.chatPolicy = { allMuted: false, mutedPlayerId: null };
  event(events, 'phaseChanged', { phase });
}

function end(state: GameState, winner: 'good' | 'bad', reason: GameState['endReason'], now: number, events: GameEvent[]): void {
  state.winner = winner; state.endReason = reason; enter(state, 'ended', now, events); event(events, 'gameEnded', { winner, reason });
}

function fillMissingTeamVotes(state: GameState, vote: 'reject'): void {
  for (const candidate of state.players) if (!state.teamVotes[candidate.id]) state.teamVotes[candidate.id] = vote;
}

function randomTeam(state: GameState, random: () => number): string[] {
  return shuffle(state.players.map((candidate) => candidate.id), random).slice(0, state.requiredTeamSize);
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, random);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function randomIndex(length: number, random: () => number): number {
  const value = random();
  const normalized = Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
  return Math.floor(normalized * length);
}

function nextLeader(state: GameState): number { return (state.leaderIndex + 1) % state.players.length; }
function player(state: GameState, id: string | null): GamePlayer | undefined { return state.players.find((candidate) => candidate.id === id); }
function leaderId(state: GameState): string | undefined { return state.players[state.leaderIndex]?.id; }
function validTarget(state: GameState, id: string): boolean { return Boolean(player(state, id)); }
function hasRole(state: GameState, id: string | null, role: GamePlayer['role']): boolean { return player(state, id)?.role === role; }
function isPhase(state: GameState, phase: GamePhase): boolean { return state.phase === phase; }
function isValidTeamDraft(state: GameState, ids: readonly string[]): boolean {
  return Array.isArray(ids)
    && ids.length <= state.requiredTeamSize
    && new Set(ids).size === ids.length
    && ids.every((id) => typeof id === 'string' && validTarget(state, id));
}
function isValidTeam(state: GameState, ids: readonly string[]): boolean {
  return Array.isArray(ids) && ids.length === state.requiredTeamSize && isValidTeamDraft(state, ids);
}
function isBadToBa(candidate: GamePlayer): boolean { return factionForRole(candidate.role) === 'bad' && candidate.role !== 'Kẻ fake CV'; }
function reject(state: GameState, code: TransitionRejectionCode, message: string): TransitionResult { return { ok: false, state, rejection: { code, message } }; }
function event(events: GameEvent[], type: GameEvent['type'], data: GameEvent['data']): void { events.push({ type, visibility: 'public', data }); }
