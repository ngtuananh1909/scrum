export const GOOD_ROLES = [
  'Scrum Master',
  'Project Manager',
  'Developer',
  'Business Analyst',
  'Quality Controller',
  'Technical Leader',
  'Data Analyst',
  'Thực tập sinh',
] as const;

export const BAD_ROLES = [
  'Người trễ task',
  'Client',
  'Ông sếp khó ưa',
  'Kẻ fake CV',
  'QC cẩu thả',
  'Deadline',
  'Technical Debt',
] as const;

export type GameRole = (typeof GOOD_ROLES)[number] | (typeof BAD_ROLES)[number];
export type Faction = 'good' | 'bad';
export type TeamVote = 'approve' | 'reject';
export type ExecutionVote = 'success' | 'fail';
export type SprintOutcome = 'success' | 'fail';

export type GamePhase =
  | 'roleReveal'
  | 'firstNight'
  | 'planningDiscussion'
  | 'teamSelection'
  | 'teamVoting'
  | 'teamVoteReveal'
  | 'execution'
  | 'executionReveal'
  | 'sprintResult'
  | 'assassination'
  | 'ended';

export type EndReason =
  | 'threeFailedSprints'
  | 'fourRejectedTeams'
  | 'assassinationGuess'
  | 'assassinationDeadline'
  | 'fiveSprintTiebreak';

export interface GamePlayer {
  id: string;
  name: string;
  role: GameRole;
}

export interface ChatPolicy {
  allMuted: boolean;
  mutedPlayerId: string | null;
}

export interface TeamVoteOutcome {
  approveWeight: number;
  rejectWeight: number;
  accepted: boolean;
}

export interface ExecutionReveal {
  ballots: ExecutionVote[];
  failWeight: number;
  outcome: SprintOutcome;
}

export interface SprintRecord {
  sprintNumber: number;
  teamIds: string[];
  outcome: SprintOutcome;
  failWeight: number;
  technicalDebtApplied: boolean;
}

export interface SkillUsage {
  pmOverrideUsed: boolean;
  qcRedoUsed: boolean;
  baCheckUsed: boolean;
  daCheckUsed: boolean;
  deadlineUsed: boolean;
  bossUsedForSprint: boolean;
}

export interface SprintCheckpoint {
  sprintIndex: number;
  leaderIndex: number;
  requiredTeamSize: number;
  nextTeamSizeBonus: number;
  goodWins: number;
  badWins: number;
  rejectedTeams: number;
  history: SprintRecord[];
  publicEvents?: GameEvent[];
}

/**
 * The authoritative room state. It is server-only; never return this shape to
 * a browser because it contains role assignments and unrevealed ballots.
 */
export interface GameState {
  id: string;
  players: GamePlayer[];
  phase: GamePhase;
  phaseVersion: number;
  phaseStartedAt: number;
  phaseDeadlineAt: number | null;
  teamSelectionDeadlineAt: number | null;
  revision: number;
  sprintIndex: number;
  leaderIndex: number;
  requiredTeamSize: number;
  teamIds: string[];
  teamVotes: Record<string, TeamVote>;
  executionVotes: Record<string, ExecutionVote>;
  teamVoteOutcome: TeamVoteOutcome | null;
  /** Individual team votes become public only during teamVoteReveal and later. */
  teamVoteRevealVotes: Record<string, TeamVote> | null;
  executionReveal: ExecutionReveal | null;
  rejectedTeams: number;
  goodWins: number;
  badWins: number;
  nextTeamSizeBonus: number;
  ttsFollowTargetId: string | null;
  skills: SkillUsage;
  chatPolicy: ChatPolicy;
  checkpoint: SprintCheckpoint | null;
  history: SprintRecord[];
  winner: Faction | null;
  endReason: EndReason | null;
  publicEvents: GameEvent[];
  /** Persistent, viewer-scoped BA/DA results. Never included in public projection. */
  privateEffects: PrivateEffect[];
}

export interface CommandEnvelope {
  commandId: string;
  actorId: string | null;
  expectedPhaseVersion: number;
}

export type GameCommand = CommandEnvelope & (
  | { type: 'setTtsTarget'; targetId: string }
  | { type: 'setTeam'; teamIds: string[] }
  | { type: 'finalizeTeam'; teamIds: string[] }
  | { type: 'usePmOverride'; teamIds: string[] }
  | { type: 'castTeamVote'; vote: TeamVote }
  | { type: 'resolveTeamVote' }
  | { type: 'castExecutionVote'; vote: ExecutionVote }
  | { type: 'resolveExecution' }
  | { type: 'useBossSilence'; targetId: string }
  | { type: 'useDeadlineSilence' }
  | { type: 'useBaCheck'; targetIds: [string, string] }
  | { type: 'useDaCheck'; targetId: string }
  | { type: 'useQcRedo' }
  | { type: 'guessScrumMaster'; targetId: string }
  | { type: 'react'; emoji: '🤨' | '😂' | '💀' | '🔥' | '👀' | '🤡'; targetType: 'player' | 'proposal' | 'sprintResult'; targetPlayerId?: string }
  | { type: 'expirePhase' }
);

export interface TransitionContext {
  now: number;
  /** Inject a deterministic source in tests; production supplies a CSPRNG. */
  random?: () => number;
}

export type TransitionRejectionCode =
  | 'STALE_PHASE'
  | 'UNKNOWN_ACTOR'
  | 'INVALID_PHASE'
  | 'NOT_AUTHORIZED'
  | 'INVALID_TARGET'
  | 'INVALID_TEAM'
  | 'ALREADY_VOTED'
  | 'INVALID_VOTE'
  | 'INVALID_REACTION'
  | 'SKILL_UNAVAILABLE'
  | 'ACTION_ALREADY_USED'
  | 'PHASE_EXPIRED'
  | 'NOT_EXPIRED';

export interface TransitionRejection {
  code: TransitionRejectionCode;
  message: string;
}

export type PrivateEffect =
  | { commandId: string; viewerId: string; kind: 'baCheck'; result: 'yes' | 'no' }
  | { commandId: string; viewerId: string; kind: 'daCheck'; targetId: string; vote: ExecutionVote };

export type GameEvent = {
  type: 'phaseChanged' | 'teamRejected' | 'teamAccepted' | 'sprintResolved' | 'gameEnded' | 'skillUsed' | 'reaction';
  visibility: 'public';
  data: Record<string, string | number | boolean | null>;
};

export type TransitionResult =
  | { ok: true; state: GameState; events: GameEvent[]; privateEffects: PrivateEffect[] }
  | { ok: false; state: GameState; rejection: TransitionRejection };

export interface PublicPlayer {
  id: string;
  name: string;
}

export interface PublicGameState {
  id: string;
  players: PublicPlayer[];
  phase: GamePhase;
  phaseVersion: number;
  phaseStartedAt: number;
  phaseDeadlineAt: number | null;
  teamSelectionDeadlineAt: number | null;
  revision: number;
  sprintIndex: number;
  leaderId: string | null;
  requiredTeamSize: number;
  teamIds: string[];
  teamVoteSubmittedPlayerIds: string[];
  teamVotePendingPlayerIds: string[];
  executionSubmittedCount: number;
  teamVoteOutcome: TeamVoteOutcome | null;
  teamVoteRevealVotes: Record<string, TeamVote> | null;
  executionReveal: ExecutionReveal | null;
  rejectedTeams: number;
  goodWins: number;
  badWins: number;
  chatPolicy: ChatPolicy;
  history: SprintRecord[];
  winner: Faction | null;
  endReason: EndReason | null;
  publicEvents: GameEvent[];
}

export interface ViewerPrivateState {
  ownRole: GameRole | null;
  faction: Faction | null;
  knownRoles: Array<{ playerId: string; role: GameRole }>;
  ttsFollowTargetId: string | null;
  canUseBadFactionChat: boolean;
  allowedActions: string[];
  effects: PrivateEffect[];
}

export interface EndGameProjection extends PublicGameState {
  revealedRoles: Array<{ playerId: string; role: GameRole }>;
}

export interface PrivateGameProjection {
  public: PublicGameState;
  private: ViewerPrivateState;
}
