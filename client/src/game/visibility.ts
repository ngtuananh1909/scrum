import { factionForRole } from './presets';
import type { EndGameProjection, GameState, PrivateEffect, PrivateGameProjection, PublicGameState } from './types';

export function projectState(state: GameState): PublicGameState {
  return {
    id: state.id,
    players: state.players.map(({ id, name }) => ({ id, name })),
    phase: state.phase,
    phaseVersion: state.phaseVersion,
    phaseStartedAt: state.phaseStartedAt,
    phaseDeadlineAt: state.phaseDeadlineAt,
    teamSelectionDeadlineAt: state.teamSelectionDeadlineAt,
    revision: state.revision,
    sprintIndex: state.sprintIndex,
    leaderId: state.players[state.leaderIndex]?.id ?? null,
    requiredTeamSize: state.requiredTeamSize,
    teamIds: [...state.teamIds],
    teamVoteSubmittedPlayerIds: Object.keys(state.teamVotes),
    teamVotePendingPlayerIds: state.phase === 'teamVoting'
      ? state.players.filter((player) => !state.teamVotes[player.id]).map((player) => player.id)
      : [],
    executionSubmittedCount: Object.keys(state.executionVotes).length,
    teamVoteOutcome: state.teamVoteOutcome ? { ...state.teamVoteOutcome } : null,
    teamVoteRevealVotes: state.teamVoteRevealVotes ? { ...state.teamVoteRevealVotes } : null,
    executionReveal: state.executionReveal
      ? { ...state.executionReveal, ballots: [...state.executionReveal.ballots] }
      : null,
    rejectedTeams: state.rejectedTeams,
    goodWins: state.goodWins,
    badWins: state.badWins,
    chatPolicy: { ...state.chatPolicy },
    history: state.history.map((record) => ({ ...record, teamIds: [...record.teamIds] })),
    winner: state.winner,
    endReason: state.endReason,
    publicEvents: state.publicEvents.map((event) => ({ ...event, data: { ...event.data } })),
  };
}

export function projectPrivateState(
  state: GameState,
  viewerId: string,
  effects?: readonly PrivateEffect[],
): PrivateGameProjection {
  const viewer = state.players.find((player) => player.id === viewerId);
  const ownRole = viewer?.role ?? null;
  const knownRoles: Array<{ playerId: string; role: NonNullable<typeof ownRole> }> = [];

  if (ownRole === 'Scrum Master') {
    const task = state.players.find((player) => player.role === 'Người trễ task');
    if (task) knownRoles.push({ playerId: task.id, role: task.role });
  }
  if (ownRole === 'Client') {
    const ba = state.players.find((player) => player.role === 'Business Analyst');
    if (ba) knownRoles.push({ playerId: ba.id, role: ba.role });
  }
  if (state.phase === 'assassination' && ownRole && factionForRole(ownRole) === 'bad') {
    for (const player of state.players) {
      if (player.id !== viewerId && factionForRole(player.role) === 'bad') {
        knownRoles.push({ playerId: player.id, role: player.role });
      }
    }
  }

  return {
    public: projectState(state),
    private: {
      ownRole,
      faction: ownRole ? factionForRole(ownRole) : null,
      knownRoles,
      ttsFollowTargetId: ownRole === 'Thực tập sinh' ? state.ttsFollowTargetId : null,
      canUseBadFactionChat: Boolean(ownRole && factionForRole(ownRole) === 'bad' && state.phase !== 'ended'),
      allowedActions: allowedActions(state, viewerId),
      effects: (effects ?? state.privateEffects ?? [])
        .filter((effect) => effect.viewerId === viewerId)
        .map((effect) => ({ ...effect })),
    },
  };
}

/** Call only from the deliberate end-game reveal endpoint, never active sync. */
export function projectEndedState(state: GameState): EndGameProjection | null {
  if (state.phase !== 'ended') return null;
  return {
    ...projectState(state),
    revealedRoles: state.players.map((player) => ({ playerId: player.id, role: player.role })),
  };
}

function allowedActions(state: GameState, viewerId: string): string[] {
  const viewer = state.players.find((player) => player.id === viewerId);
  if (!viewer) return [];
  const actions: string[] = [];
  if (state.phase === 'firstNight' && viewer.role === 'Thực tập sinh' && !state.ttsFollowTargetId) actions.push('setTtsTarget');
  if (state.phase === 'teamSelection' && state.players[state.leaderIndex]?.id === viewerId) actions.push('setTeam', 'finalizeTeam');
  if ((state.phase === 'planningDiscussion' || state.phase === 'teamSelection') && viewer.role === 'Project Manager' && !state.skills.pmOverrideUsed) actions.push('usePmOverride');
  if (state.phase === 'planningDiscussion' && viewer.role === 'Ông sếp khó ưa' && !state.skills.bossUsedForSprint) actions.push('useBossSilence');
  if (state.phase === 'planningDiscussion' && viewer.role === 'Deadline' && !state.skills.deadlineUsed) actions.push('useDeadlineSilence');
  if ((state.phase === 'firstNight' || state.phase === 'planningDiscussion') && viewer.role === 'Business Analyst' && !state.skills.baCheckUsed) actions.push('useBaCheck');
  if (state.phase === 'sprintResult' && viewer.role === 'Data Analyst' && !state.skills.daCheckUsed) actions.push('useDaCheck');
  if (state.phase === 'sprintResult' && viewer.role === 'Quality Controller' && !state.skills.qcRedoUsed) actions.push('useQcRedo');
  if (state.phase === 'teamVoting') actions.push('castTeamVote');
  if (state.phase === 'execution' && state.teamIds.includes(viewerId)) actions.push('castExecutionVote');
  if (state.phase === 'assassination' && viewer.role === 'Người trễ task') actions.push('guessScrumMaster');
  if (state.phase !== 'ended' && state.phase !== 'roleReveal' && state.phase !== 'firstNight'
    && !state.chatPolicy.allMuted && state.chatPolicy.mutedPlayerId !== viewerId) actions.push('react');
  return actions;
}
