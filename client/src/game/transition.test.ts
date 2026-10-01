import { describe, expect, test } from 'vitest';

import {
  createGameState,
  projectPrivateState,
  projectState,
  transition,
  type GameCommand,
  type GameRole,
  type GameState,
  type TransitionResult,
} from './index';

const roles: GameRole[] = [
  'Scrum Master',
  'Project Manager',
  'Thực tập sinh',
  'Người trễ task',
  'QC cẩu thả',
];

function readyState(): GameState {
  return createGameState({
    id: 'room-1',
    players: roles.map((role, index) => ({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`,
      role,
    })),
    leaderId: 'p1',
    now: 0,
  });
}

function command<T extends GameCommand['type']>(type: T, body: Record<string, unknown> = {}): Extract<GameCommand, { type: T }> {
  return { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 0, type, ...body } as Extract<GameCommand, { type: T }>;
}

function stateOf(result: TransitionResult): GameState {
  if (!result.ok) throw new Error(`${result.rejection.code}: ${result.rejection.message}`);
  return result.state;
}

describe('transition', () => {
  test('moves through role reveal and requires the intern target before planning', () => {
    const initial = readyState();
    const revealed = transition(initial, command('expirePhase', { actorId: null }), { now: 30_000 });
    expect(revealed.ok).toBe(true);
    if (!revealed.ok) return;
    expect(revealed.state.phase).toBe('firstNight');

    const timedOut = transition(
      revealed.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 1, type: 'expirePhase' },
      { now: 50_000, random: () => 0 },
    );
    expect(timedOut.ok).toBe(true);
    if (!timedOut.ok) return;
    expect(timedOut.state.phase).toBe('planningDiscussion');
    expect(timedOut.state.ttsFollowTargetId).toBe('p1');

    const selfTarget = transition(
      revealed.state,
      { commandId: crypto.randomUUID(), actorId: 'p3', expectedPhaseVersion: 1, type: 'setTtsTarget', targetId: 'p3' },
      { now: 30_001 },
    );
    expect(selfTarget.ok).toBe(false);
    if (!selfTarget.ok) expect(selfTarget.rejection.code).toBe('INVALID_TARGET');

    const selected = transition(
      revealed.state,
      { commandId: crypto.randomUUID(), actorId: 'p3', expectedPhaseVersion: 1, type: 'setTtsTarget', targetId: 'p2' },
      { now: 30_001 },
    );
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.state.phase).toBe('firstNight');
    expect(selected.state.ttsFollowTargetId).toBe('p2');
    expect(projectPrivateState(selected.state, 'p3').private.ttsFollowTargetId).toBe('p2');
    expect(projectPrivateState(selected.state, 'p1').private.ttsFollowTargetId).toBeNull();
    expect(projectState(selected.state)).not.toHaveProperty('ttsFollowTargetId');
    const locked = transition(
      selected.state,
      { commandId: crypto.randomUUID(), actorId: 'p3', expectedPhaseVersion: 1, type: 'setTtsTarget', targetId: 'p1' },
      { now: 30_002 },
    );
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.rejection.code).toBe('ACTION_ALREADY_USED');
    const planning = transition(
      selected.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: selected.state.phaseVersion, type: 'expirePhase' },
      { now: 50_000 },
    );
    expect(planning.ok).toBe(true);
    if (!planning.ok) return;
    expect(planning.state.phase).toBe('planningDiscussion');
    const selection = transition(
      planning.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: planning.state.phaseVersion, type: 'expirePhase' },
      { now: 230_000 },
    );
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.state.phase).toBe('teamSelection');
    expect(selection.state.teamSelectionDeadlineAt).toBe(275_000);
  });

  test('turns missing team votes into rejections and ends after four rejected teams', () => {
    let state = readyState();
    state = stateOf(transition(state, { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 0, type: 'expirePhase' }, { now: 30_000 }));
    state = stateOf(transition(state, { commandId: crypto.randomUUID(), actorId: 'p3', expectedPhaseVersion: 1, type: 'setTtsTarget', targetId: 'p2' }, { now: 30_001 }));
    state = stateOf(transition(state, { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 1, type: 'expirePhase' }, { now: 50_000 }));

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      state = stateOf(transition(
        state,
        { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: state.phaseVersion, type: 'expirePhase' },
        { now: state.phaseDeadlineAt! },
      ));
      const leaderId = state.players[state.leaderIndex].id;
      const proposed = transition(
        state,
        { commandId: crypto.randomUUID(), actorId: leaderId, expectedPhaseVersion: state.phaseVersion, type: 'finalizeTeam', teamIds: ['p1', 'p2'] },
        { now: state.phaseStartedAt + 1 },
      );
      expect(proposed.ok).toBe(true);
      if (!proposed.ok) return;
      const expired = transition(
        proposed.state,
        { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: proposed.state.phaseVersion, type: 'expirePhase' },
        { now: proposed.state.phaseDeadlineAt! },
      );
      expect(expired.ok).toBe(true);
      if (!expired.ok) return;
      const revealed = transition(
        expired.state,
        { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: expired.state.phaseVersion, type: 'expirePhase' },
        { now: expired.state.phaseDeadlineAt! },
      );
      expect(revealed.ok).toBe(true);
      if (!revealed.ok) return;
      state = revealed.state;
    }
    expect(state.phase).toBe('ended');
    expect(state.winner).toBe('bad');
    expect(state.endReason).toBe('fourRejectedTeams');
  });

  test('doubles the followed player only from sprint two onward', () => {
    const state = {
      ...readyState(),
      phase: 'teamVoting' as const,
      phaseVersion: 4,
      phaseDeadlineAt: 1,
      sprintIndex: 1,
      teamIds: ['p1', 'p2'],
      ttsFollowTargetId: 'p2',
      teamVotes: { p1: 'approve' as const, p2: 'approve' as const, p3: 'reject' as const, p4: 'reject' as const, p5: 'reject' as const },
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 4, type: 'resolveTeamVote' },
      { now: 1 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('teamVoteReveal');
    expect(result.state.teamVoteOutcome).toEqual({ approveWeight: 3, rejectWeight: 3, accepted: false });
    expect(result.state.phaseDeadlineAt).toBe(3_001);

    const tooEarly = transition(
      result.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: result.state.phaseVersion, type: 'expirePhase' },
      { now: 3_000 },
    );
    expect(tooEarly.ok).toBe(false);
    if (!tooEarly.ok) expect(tooEarly.rejection.code).toBe('NOT_EXPIRED');

    const afterReveal = transition(
      result.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: result.state.phaseVersion, type: 'expirePhase' },
      { now: 3_001 },
    );
    expect(afterReveal.ok).toBe(true);
    if (afterReveal.ok) expect(afterReveal.state.phase).toBe('planningDiscussion');
  });

  test('applies QC double-fail before Technical Leader can save exactly one fail', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'execution',
      phaseVersion: 4,
      phaseDeadlineAt: 1,
      sprintIndex: 0,
      teamIds: ['p2', 'p5'],
      executionVotes: { p2: 'fail', p5: 'fail' },
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 4, type: 'resolveExecution' },
      { now: 1, random: () => 0.5 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('executionReveal');
    expect(result.state.executionReveal?.outcome).toBe('fail');
    expect(result.state.executionReveal?.failWeight).toBe(3);
  });

  test('sends three successful sprints to assassination and awards good on deadline', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'executionReveal',
      phaseVersion: 9,
      phaseDeadlineAt: 4_000,
      goodWins: 2,
      executionReveal: { ballots: ['success', 'success'], failWeight: 0, outcome: 'success' },
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 9, type: 'expirePhase' },
      { now: 4_000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('sprintResult');
    const afterQcWindow = transition(
      result.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: result.state.phaseVersion, type: 'expirePhase' },
      { now: result.state.phaseDeadlineAt! },
    );
    expect(afterQcWindow.ok).toBe(true);
    if (!afterQcWindow.ok) return;
    expect(afterQcWindow.state.phase).toBe('assassination');

    const ended = transition(
      afterQcWindow.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: afterQcWindow.state.phaseVersion, type: 'expirePhase' },
      { now: afterQcWindow.state.phaseDeadlineAt! },
    );
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.winner).toBe('good');
    expect(ended.state.endReason).toBe('assassinationDeadline');
  });

  test('allows only the task-delayer to guess after the third good success', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'executionReveal',
      phaseVersion: 9,
      phaseDeadlineAt: 4_000,
      goodWins: 2,
      executionReveal: { ballots: ['success', 'success'], failWeight: 0, outcome: 'success' },
    };
    const resultWindow = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 9, type: 'expirePhase' },
      { now: 4_000 },
    );
    expect(resultWindow.ok).toBe(true);
    if (!resultWindow.ok) return;
    expect(resultWindow.state.phase).toBe('sprintResult');
    const entered = transition(
      resultWindow.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: resultWindow.state.phaseVersion, type: 'expirePhase' },
      { now: resultWindow.state.phaseDeadlineAt! },
    );
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;
    expect(entered.state.phase).toBe('assassination');
    expect(entered.state.goodWins).toBe(3);

    const goodSideGuess = transition(
      entered.state,
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: entered.state.phaseVersion, type: 'guessScrumMaster', targetId: 'p2' },
      { now: entered.state.phaseStartedAt + 1 },
    );
    expect(goodSideGuess.ok).toBe(false);
    if (!goodSideGuess.ok) expect(goodSideGuess.rejection.code).toBe('NOT_AUTHORIZED');

    const taskDelayerGuess = transition(
      entered.state,
      { commandId: crypto.randomUUID(), actorId: 'p4', expectedPhaseVersion: entered.state.phaseVersion, type: 'guessScrumMaster', targetId: 'p2' },
      { now: entered.state.phaseStartedAt + 2 },
    );
    expect(taskDelayerGuess.ok).toBe(true);
    if (!taskDelayerGuess.ok) return;
    expect(taskDelayerGuess.state.phase).toBe('ended');
    expect(taskDelayerGuess.state.winner).toBe('good');
    expect(taskDelayerGuess.state.endReason).toBe('assassinationGuess');
  });

  test('enters a fifth tiebreak sprint after a 2-2 fourth sprint and repeats sprint four base size', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'sprintResult',
      phaseVersion: 8,
      phaseDeadlineAt: 20_000,
      sprintIndex: 4,
      goodWins: 2,
      badWins: 2,
      nextTeamSizeBonus: 1,
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 8, type: 'expirePhase' },
      { now: 20_000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('planningDiscussion');
    expect(result.state.sprintIndex).toBe(4);
    expect(result.state.requiredTeamSize).toBe(4);
    const selection = transition(
      result.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: result.state.phaseVersion, type: 'expirePhase' },
      { now: 200_000 },
    );
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.state.phase).toBe('teamSelection');
    expect(selection.state.requiredTeamSize).toBe(4);
  });

  test('rejects player votes that arrive after the voting deadline', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'teamVoting',
      phaseVersion: 3,
      phaseDeadlineAt: 1,
      teamIds: ['p1', 'p2'],
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 3, type: 'castTeamVote', vote: 'approve' },
      { now: 1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('PHASE_EXPIRED');
    expect(state.teamVotes).toEqual({});
  });

  test('persists BA check results for that player while hiding them from others', () => {
    const state = createGameState({
      id: 'private-effects',
      leaderId: 'sm',
      now: 0,
      players: [
        { id: 'sm', name: 'SM', role: 'Scrum Master' },
        { id: 'ba', name: 'BA', role: 'Business Analyst' },
        { id: 'dev', name: 'Dev', role: 'Developer' },
        { id: 'task', name: 'Task', role: 'Người trễ task' },
        { id: 'fake', name: 'Fake', role: 'Kẻ fake CV' },
      ],
    });
    const nightState: GameState = {
      ...state,
      phase: 'firstNight',
      phaseVersion: 1,
      phaseDeadlineAt: 20_000,
    };
    const result = transition(
      nightState,
      { commandId: 'ba-check-1', actorId: 'ba', expectedPhaseVersion: 1, type: 'useBaCheck', targetIds: ['task', 'dev'] },
      { now: 10_000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.privateEffects).toEqual([
      { commandId: 'ba-check-1', viewerId: 'ba', kind: 'baCheck', result: 'yes' },
    ]);
    expect(projectPrivateState(result.state, 'ba').private.effects).toEqual(result.state.privateEffects);
    expect(projectPrivateState(result.state, 'sm').private.effects).toEqual([]);
    expect(result.events).toEqual([]);
    expect(JSON.stringify(result.events)).not.toContain('task');
    expect(JSON.stringify(result.events)).not.toContain('yes');
  });

  test('lets the PO save an incomplete team draft but not finalize it', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'teamSelection',
      phaseVersion: 3,
      phaseDeadlineAt: 45_000,
      teamSelectionDeadlineAt: 45_000,
    };
    const draft = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 3, type: 'setTeam', teamIds: ['p2'] },
      { now: 1 },
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(draft.state.teamIds).toEqual(['p2']);

    const finalized = transition(
      draft.state,
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 3, type: 'finalizeTeam', teamIds: ['p2'] },
      { now: 2 },
    );
    expect(finalized.ok).toBe(false);
    if (!finalized.ok) expect(finalized.rejection.code).toBe('INVALID_TEAM');
  });

  test('selects a random valid team when the 45-second PO window expires', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'teamSelection',
      phaseVersion: 3,
      phaseDeadlineAt: 45_000,
      teamSelectionDeadlineAt: 45_000,
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 3, type: 'expirePhase' },
      { now: 45_000, random: () => 0 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('teamVoting');
    expect(result.state.teamIds).toHaveLength(2);
    expect(new Set(result.state.teamIds).size).toBe(2);
    expect(result.state.teamIds.every((id) => result.state.players.some((player) => player.id === id))).toBe(true);
  });

  test('ends for the bad side after three failed sprints', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'executionReveal',
      phaseVersion: 6,
      phaseDeadlineAt: 1,
      sprintIndex: 2,
      badWins: 2,
      executionReveal: { ballots: ['fail'], failWeight: 1, outcome: 'fail' },
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 6, type: 'expirePhase' },
      { now: 1 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('sprintResult');
    expect(result.state.winner).toBeNull();
    const afterWindow = transition(
      result.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: result.state.phaseVersion, type: 'expirePhase' },
      { now: result.state.phaseDeadlineAt! },
    );
    expect(afterWindow.ok).toBe(true);
    if (!afterWindow.ok) return;
    expect(afterWindow.state.phase).toBe('ended');
    expect(afterWindow.state.winner).toBe('bad');
    expect(afterWindow.state.endReason).toBe('threeFailedSprints');
  });

  test('keeps the QC redo window after a third good Sprint before assassination', () => {
    const initial = createGameState({
      id: 'qc-final', leaderId: 'sm', now: 0,
      players: [
        { id: 'sm', name: 'SM', role: 'Scrum Master' },
        { id: 'qc', name: 'QC', role: 'Quality Controller' },
        { id: 'dev', name: 'Developer', role: 'Developer' },
        { id: 'task', name: 'Task', role: 'Người trễ task' },
        { id: 'client', name: 'Client', role: 'Client' },
      ],
    });
    const state: GameState = {
      ...initial,
      phase: 'executionReveal', phaseVersion: 6, phaseDeadlineAt: 1,
      sprintIndex: 2, goodWins: 2,
      executionReveal: { ballots: ['success'], failWeight: 0, outcome: 'success' },
      checkpoint: {
        sprintIndex: 2, leaderIndex: 0, requiredTeamSize: 2, nextTeamSizeBonus: 0,
        goodWins: 2, badWins: 0, rejectedTeams: 0, history: [],
      },
    };
    const result = transition(state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 6, type: 'expirePhase' },
      { now: 1 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('sprintResult');
    expect(result.state.goodWins).toBe(3);
    expect(result.state.winner).toBeNull();

    const redo = transition(result.state,
      { commandId: crypto.randomUUID(), actorId: 'qc', expectedPhaseVersion: result.state.phaseVersion, type: 'useQcRedo' },
      { now: 2 },
    );
    expect(redo.ok).toBe(true);
    if (redo.ok) {
      expect(redo.state.phase).toBe('planningDiscussion');
      expect(redo.state.goodWins).toBe(2);
      expect(redo.state.winner).toBeNull();
    }

    const afterWindow = transition(result.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: result.state.phaseVersion, type: 'expirePhase' },
      { now: result.state.phaseDeadlineAt! },
    );
    expect(afterWindow.ok).toBe(true);
    if (afterWindow.ok) expect(afterWindow.state.phase).toBe('assassination');
  });

  test('rejects stale commands before changing state', () => {
    const state = readyState();
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 1, type: 'setTtsTarget', targetId: 'p2' },
      { now: 0 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('STALE_PHASE');
    expect(state.phase).toBe('roleReveal');
    expect(state.ttsFollowTargetId).toBeNull();
  });

  test('lets the task-delayer guess only among Scrum Team members', () => {
    const state: GameState = {
      ...readyState(),
      phase: 'assassination',
      phaseVersion: 7,
      phaseDeadlineAt: 60_000,
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: 'p4', expectedPhaseVersion: 7, type: 'guessScrumMaster', targetId: 'p5' },
      { now: 1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('INVALID_TARGET');
    expect(state.phase).toBe('assassination');
  });

  test('QC redo restores the saved start-of-sprint checkpoint and consumes the skill', () => {
    const initial = createGameState({
      id: 'qc-room',
      leaderId: 'sm',
      now: 0,
      players: [
        { id: 'sm', name: 'SM', role: 'Scrum Master' },
        { id: 'qc', name: 'QC', role: 'Quality Controller' },
        { id: 'tts', name: 'TTS', role: 'Thực tập sinh' },
        { id: 'task', name: 'Task', role: 'Người trễ task' },
        { id: 'client', name: 'Client', role: 'Client' },
      ],
    });
    const state: GameState = {
      ...initial,
      phase: 'sprintResult',
      phaseVersion: 7,
      phaseDeadlineAt: 20_000,
      sprintIndex: 1,
      goodWins: 1,
      history: [{ sprintNumber: 1, teamIds: ['sm', 'task'], outcome: 'success', failWeight: 0, technicalDebtApplied: false }],
      publicEvents: [{ type: 'sprintResolved', visibility: 'public', data: { outcome: 'success', goodWins: 1, badWins: 0 } }],
      checkpoint: {
        sprintIndex: 0,
        leaderIndex: 0,
        requiredTeamSize: 2,
        nextTeamSizeBonus: 0,
        goodWins: 0,
        badWins: 0,
        rejectedTeams: 0,
        history: [],
        publicEvents: [],
      },
    };
    const result = transition(
      state,
      { commandId: crypto.randomUUID(), actorId: 'qc', expectedPhaseVersion: 7, type: 'useQcRedo' },
      { now: 1 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('planningDiscussion');
    expect(result.state.sprintIndex).toBe(0);
    expect(result.state.goodWins).toBe(0);
    expect(result.state.history).toEqual([]);
    expect(result.state.publicEvents.some((event) => event.type === 'sprintResolved')).toBe(false);
    expect(result.state.skills.qcRedoUsed).toBe(true);
  });

  test('publishes a rate-limit-ready reaction without changing the phase and blocks silenced senders', () => {
    const state: GameState = {
      ...readyState(), phase: 'teamVoting', phaseVersion: 4, phaseDeadlineAt: 30_000,
      teamIds: ['p1', 'p2'],
    };
    const reaction = {
      commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 4,
      type: 'react', emoji: '🔥', targetType: 'proposal',
    } as unknown as GameCommand;
    const result = transition(state, reaction, { now: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phaseVersion).toBe(4);
    expect(result.state.publicEvents.at(-1)).toEqual({
      type: 'reaction', visibility: 'public',
      data: { actorPlayerId: 'p1', emoji: '🔥', targetType: 'proposal', targetPlayerId: null },
    });

    const silenced = transition(
      { ...state, chatPolicy: { allMuted: false, mutedPlayerId: 'p1' } },
      reaction,
      { now: 1 },
    );
    expect(silenced.ok).toBe(false);
  });

  test('requires two Fail weight in a seven-player Sprint 3, even when Technical Leader is present', () => {
    const roles: GameRole[] = [
      'Scrum Master', 'Developer', 'Technical Leader', 'Business Analyst', 'Quality Controller',
      'Người trễ task', 'QC cẩu thả',
    ];
    const initial = createGameState({
      id: 'double-fail', leaderId: 'p1', now: 0,
      players: roles.map((role, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, role })),
    });
    const base: GameState = {
      ...initial, phase: 'execution', phaseVersion: 4, phaseDeadlineAt: 1,
      sprintIndex: 2, requiredTeamSize: 3,
    };
    const oneFail = transition({ ...base, teamIds: ['p6', 'p3', 'p2'], executionVotes: { p6: 'fail', p3: 'success', p2: 'success' } },
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 4, type: 'resolveExecution' },
      { now: 1, random: () => 0.5 });
    expect(oneFail.ok).toBe(true);
    if (oneFail.ok) {
      expect(oneFail.state.executionReveal?.failWeight).toBe(1);
      expect(oneFail.state.executionReveal?.outcome).toBe('success');
    }
    const doubledFail = transition({ ...base, teamIds: ['p7', 'p3', 'p2'], executionVotes: { p7: 'fail', p3: 'success', p2: 'success' } },
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 4, type: 'resolveExecution' },
      { now: 1, random: () => 0.5 });
    expect(doubledFail.ok).toBe(true);
    if (doubledFail.ok) {
      expect(doubledFail.state.executionReveal?.failWeight).toBe(2);
      expect(doubledFail.state.executionReveal?.outcome).toBe('fail');
    }
  });

  test('carries Technical Debt into the next team size and lets PM skip approval before PO selection', () => {
    const debtRoles: GameRole[] = ['Scrum Master', 'Developer', 'Business Analyst', 'Người trễ task', 'Technical Debt'];
    const initial = createGameState({
      id: 'debt', leaderId: 'p1', now: 0,
      players: debtRoles.map((role, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, role })),
    });
    const result = transition({ ...initial, phase: 'executionReveal', phaseVersion: 4, phaseDeadlineAt: 1,
      teamIds: ['p1', 'p5'], executionReveal: { ballots: ['success', 'success'], failWeight: 0, outcome: 'success' } },
    { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: 4, type: 'expirePhase' }, { now: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.nextTeamSizeBonus).toBe(1);
    const next = transition(result.state,
      { commandId: crypto.randomUUID(), actorId: null, expectedPhaseVersion: result.state.phaseVersion, type: 'expirePhase' },
      { now: result.state.phaseDeadlineAt! });
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.state.requiredTeamSize).toBe(4);

    const pmRoles: GameRole[] = ['Scrum Master', 'Project Manager', 'Developer', 'Người trễ task', 'Client'];
    const pmState = createGameState({
      id: 'pm', leaderId: 'p1', now: 0,
      players: pmRoles.map((role, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, role })),
    });
    const override = transition({ ...pmState, phase: 'planningDiscussion', phaseVersion: 2, phaseDeadlineAt: 180_000 },
      { commandId: crypto.randomUUID(), actorId: 'p2', expectedPhaseVersion: 2, type: 'usePmOverride', teamIds: ['p2', 'p4'] },
      { now: 1 });
    expect(override.ok).toBe(true);
    if (override.ok) {
      expect(override.state.phase).toBe('execution');
      expect(override.state.skills.pmOverrideUsed).toBe(true);
      expect(override.state.teamVotes).toEqual({});
    }
  });

  test('Fake CV deceives the BA check without exposing either private result publicly', () => {
    const roles: GameRole[] = ['Scrum Master', 'Business Analyst', 'Developer', 'Người trễ task', 'Kẻ fake CV'];
    const initial = createGameState({
      id: 'fake-cv', leaderId: 'p1', now: 0,
      players: roles.map((role, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, role })),
    });
    const state: GameState = { ...initial, phase: 'planningDiscussion', phaseVersion: 2, phaseDeadlineAt: 180_000 };
    const hiddenBad = transition(state,
      { commandId: crypto.randomUUID(), actorId: 'p2', expectedPhaseVersion: 2, type: 'useBaCheck', targetIds: ['p3', 'p5'] },
      { now: 1 });
    expect(hiddenBad.ok).toBe(true);
    if (hiddenBad.ok) {
      expect(hiddenBad.privateEffects[0]).toMatchObject({ viewerId: 'p2', result: 'no' });
      expect(JSON.stringify(projectState(hiddenBad.state))).not.toContain('"result":"no"');
    }
    const realBad = transition(state,
      { commandId: crypto.randomUUID(), actorId: 'p2', expectedPhaseVersion: 2, type: 'useBaCheck', targetIds: ['p3', 'p4'] },
      { now: 1 });
    expect(realBad.ok).toBe(true);
    if (realBad.ok) expect(realBad.privateEffects[0]).toMatchObject({ viewerId: 'p2', result: 'yes' });
  });

  test('Boss silence blocks discussion reactions but does not remove team-vote eligibility', () => {
    const roles: GameRole[] = ['Scrum Master', 'Business Analyst', 'Developer', 'Người trễ task', 'Ông sếp khó ưa'];
    const initial = createGameState({
      id: 'boss', leaderId: 'p1', now: 0,
      players: roles.map((role, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, role })),
    });
    const discussion: GameState = { ...initial, phase: 'planningDiscussion', phaseVersion: 2, phaseDeadlineAt: 180_000 };
    const muted = transition(discussion,
      { commandId: crypto.randomUUID(), actorId: 'p5', expectedPhaseVersion: 2, type: 'useBossSilence', targetId: 'p1' },
      { now: 1 });
    expect(muted.ok).toBe(true);
    if (!muted.ok) return;
    expect(muted.state.chatPolicy.mutedPlayerId).toBe('p1');
    const reaction = transition(muted.state,
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 2, type: 'react', emoji: '👀', targetType: 'player', targetPlayerId: 'p5' },
      { now: 2 });
    expect(reaction.ok).toBe(false);
    const ballot = transition({ ...muted.state, phase: 'teamVoting', phaseVersion: 3, phaseDeadlineAt: 30_000, teamIds: ['p1', 'p2'] },
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 3, type: 'castTeamVote', vote: 'approve' },
      { now: 2 });
    expect(ballot.ok).toBe(true);
  });

  test('Data Analyst learns one historical execution vote privately during the result window', () => {
    const roles: GameRole[] = ['Scrum Master', 'Data Analyst', 'Developer', 'Người trễ task', 'Client'];
    const initial = createGameState({
      id: 'analyst', leaderId: 'p1', now: 0,
      players: roles.map((role, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, role })),
    });
    const state: GameState = {
      ...initial, phase: 'sprintResult', phaseVersion: 6, phaseDeadlineAt: 20_000,
      sprintIndex: 1, teamIds: ['p3', 'p4'], executionVotes: { p3: 'success', p4: 'fail' },
    };
    const result = transition(state,
      { commandId: crypto.randomUUID(), actorId: 'p2', expectedPhaseVersion: 6, type: 'useDaCheck', targetId: 'p4' },
      { now: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.privateEffects[0]).toMatchObject({ viewerId: 'p2', kind: 'daCheck', targetId: 'p4', vote: 'fail' });
    expect(projectPrivateState(result.state, 'p2').private.effects).toContainEqual(result.privateEffects[0]);
    expect(projectPrivateState(result.state, 'p1').private.effects).toEqual([]);
    expect(JSON.stringify(projectState(result.state))).not.toContain('"targetId":"p4"');
    const repeated = transition(result.state,
      { commandId: crypto.randomUUID(), actorId: 'p2', expectedPhaseVersion: 6, type: 'useDaCheck', targetId: 'p3' },
      { now: 2 });
    expect(repeated.ok).toBe(false);
  });

  test('Deadline silences discussion once but never removes voting rights', () => {
    const roles: GameRole[] = ['Scrum Master', 'Developer', 'Business Analyst', 'Người trễ task', 'Deadline'];
    const initial = createGameState({
      id: 'deadline', leaderId: 'p1', now: 0,
      players: roles.map((role, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, role })),
    });
    const state: GameState = { ...initial, phase: 'planningDiscussion', phaseVersion: 2, phaseDeadlineAt: 180_000 };
    const muted = transition(state,
      { commandId: crypto.randomUUID(), actorId: 'p5', expectedPhaseVersion: 2, type: 'useDeadlineSilence' },
      { now: 1 });
    expect(muted.ok).toBe(true);
    if (!muted.ok) return;
    expect(muted.state.chatPolicy.allMuted).toBe(true);
    const again = transition(muted.state,
      { commandId: crypto.randomUUID(), actorId: 'p5', expectedPhaseVersion: 2, type: 'useDeadlineSilence' },
      { now: 2 });
    expect(again.ok).toBe(false);
    const ballot = transition({ ...muted.state, phase: 'teamVoting', phaseVersion: 3, phaseDeadlineAt: 30_000, teamIds: ['p1', 'p2'] },
      { commandId: crypto.randomUUID(), actorId: 'p1', expectedPhaseVersion: 3, type: 'castTeamVote', vote: 'approve' },
      { now: 2 });
    expect(ballot.ok).toBe(true);
  });
});
