import { expect, test } from 'vitest';

import { createGameState, projectEndedState, projectPrivateState, projectState, type GameState } from './index';

test('keeps roles, private targets and execution ballots out of the normal public projection', () => {
  const state: GameState = {
    ...createGameState({
      id: 'room-visibility',
      leaderId: 'sm',
      now: 0,
      players: [
        { id: 'sm', name: 'SM', role: 'Scrum Master' },
        { id: 'pm', name: 'PM', role: 'Project Manager' },
        { id: 'tts', name: 'TTS', role: 'Thực tập sinh' },
        { id: 'task', name: 'Task', role: 'Người trễ task' },
        { id: 'qc', name: 'QC', role: 'QC cẩu thả' },
      ],
    }),
    phase: 'execution',
    teamIds: ['pm', 'qc'],
    ttsFollowTargetId: 'pm',
    executionVotes: { pm: 'success', qc: 'fail' },
  };

  const publicState = projectState(state);
  expect(publicState.players[0]).toEqual({ id: 'sm', name: 'SM' });
  expect(publicState).not.toHaveProperty('executionVotes');
  expect(publicState).not.toHaveProperty('ttsFollowTargetId');
  expect(projectPrivateState(state, 'tts').private.ttsFollowTargetId).toBe('pm');
  expect(projectPrivateState(state, 'pm').private.ttsFollowTargetId).toBeNull();
  expect(projectEndedState(state)).toBeNull();
});

test('shows who has voted during team approval without exposing choices before reveal', () => {
  const state: GameState = {
    ...createGameState({
      id: 'team-vote-visibility',
      leaderId: 'sm',
      now: 0,
      players: [
        { id: 'sm', name: 'SM', role: 'Scrum Master' },
        { id: 'pm', name: 'PM', role: 'Project Manager' },
        { id: 'tts', name: 'TTS', role: 'Thực tập sinh' },
        { id: 'task', name: 'Task', role: 'Người trễ task' },
        { id: 'qc', name: 'QC', role: 'QC cẩu thả' },
      ],
    }),
    phase: 'teamVoting',
    teamVotes: { sm: 'approve', task: 'reject' },
  };

  const publicState = projectState(state);
  expect(publicState.teamVoteSubmittedPlayerIds).toEqual(['sm', 'task']);
  expect(publicState.teamVotePendingPlayerIds).toEqual(['pm', 'tts', 'qc']);
  expect(publicState).not.toHaveProperty('teamVotes');
  expect(publicState.teamVoteRevealVotes).toBeNull();
});

test('publishes individual team approval choices together only in the shared reveal phase', () => {
  const state: GameState = {
    ...createGameState({
      id: 'team-vote-reveal',
      leaderId: 'sm',
      now: 0,
      players: [
        { id: 'sm', name: 'SM', role: 'Scrum Master' },
        { id: 'pm', name: 'PM', role: 'Project Manager' },
        { id: 'tts', name: 'TTS', role: 'Thực tập sinh' },
        { id: 'task', name: 'Task', role: 'Người trễ task' },
        { id: 'qc', name: 'QC', role: 'QC cẩu thả' },
      ],
    }),
    phase: 'teamVoteReveal',
    teamVotes: { sm: 'approve', pm: 'reject', tts: 'approve', task: 'reject', qc: 'approve' },
    teamVoteRevealVotes: { sm: 'approve', pm: 'reject', tts: 'approve', task: 'reject', qc: 'approve' },
    teamVoteOutcome: { approveWeight: 3, rejectWeight: 2, accepted: true },
  };

  expect(projectState(state).teamVoteRevealVotes).toEqual({
    sm: 'approve', pm: 'reject', tts: 'approve', task: 'reject', qc: 'approve',
  });
});

test('reveals all role assignments only after the game has ended', () => {
  const state: GameState = {
    ...createGameState({
      id: 'ended-reveal',
      leaderId: 'sm',
      now: 0,
      players: [
        { id: 'sm', name: 'SM', role: 'Scrum Master' },
        { id: 'pm', name: 'PM', role: 'Project Manager' },
        { id: 'tts', name: 'TTS', role: 'Thực tập sinh' },
        { id: 'task', name: 'Task', role: 'Người trễ task' },
        { id: 'qc', name: 'QC', role: 'QC cẩu thả' },
      ],
    }),
    phase: 'ended',
    winner: 'good',
    endReason: 'assassinationDeadline',
  };

  expect(projectEndedState(state)?.revealedRoles).toEqual([
    { playerId: 'sm', role: 'Scrum Master' },
    { playerId: 'pm', role: 'Project Manager' },
    { playerId: 'tts', role: 'Thực tập sinh' },
    { playerId: 'task', role: 'Người trễ task' },
    { playerId: 'qc', role: 'QC cẩu thả' },
  ]);
});
