// Game Constants
export const SPRINT_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3],
  6: [2, 3, 4, 3],
  7: [2, 3, 3, 4],
  8: [3, 4, 4, 5],
  9: [3, 4, 4, 5],
  10: [3, 4, 5, 6]
};

export const REQUIRES_DOUBLE_FAIL = [7, 8, 9, 10];

export const ROLES = {
  GOOD: ['Scrum Master', 'Project Manager', 'Developer', 'Business Analyst', 'Tech Lead', 'Data Analyst'],
  BAD: ['Người trễ task', 'QC cẩu thả']
};

export type Phase = 'lobby' | 'planning' | 'teamVoting' | 'execution' | 'sprintResult' | 'ended';
export type Vote = 'agree' | 'reject' | 'success' | 'fail';
export type PlayerRole = typeof ROLES.GOOD[number] | typeof ROLES.BAD[number];

export interface Player {
  id: string;
  name: string;
  role?: PlayerRole;
  isAlive: boolean;
  socketId?: string;
}

export interface Room {
  id: string;
  players: Player[];
  phase: Phase;
  currentPO: number; // index in players
  currentSprint: number; // 0-4
  proposedTeam: string[]; // player ids
  votes: Record<string, Vote>; // playerId -> vote for team voting
  executionVotes: Record<string, Vote>; // playerId -> vote for execution
  consecutiveDelays: number;
  goodWins: number;
  badWins: number;
  saboteurGuess: string | null;
  pmOverrideUsed: boolean;
  dataAnalystCheckUsed: boolean;
  techLeadPresent: boolean;
  qcBugged: boolean;
  lastUpdated: number;
}

export interface GameAction {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ChatMessage {
  id: number;
  room_id: string;
  player_id: string;
  player_name: string;
  text: string;
  created_at: string;
}

// Helper functions
export function getSprintSize(playerCount: number, sprintIndex: number): number {
  return SPRINT_SIZES[playerCount]?.[sprintIndex] || 3;
}

export function requiresDoubleFail(playerCount: number, sprintIndex: number): boolean {
  return REQUIRES_DOUBLE_FAIL.includes(playerCount) && sprintIndex === 2;
}

export function isGoodRole(role: string): boolean {
  return ROLES.GOOD.includes(role as never);
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function assignRoles(players: Player[]): Player[] {
  const playerCount = players.length;
  const goodCount = Math.floor(playerCount * 0.6);
  const badCount = playerCount - goodCount;

  const goodRoles = shuffleArray([...ROLES.GOOD]).slice(0, goodCount);
  const badRolesPool: string[] = [];
  while (badRolesPool.length < badCount) {
    badRolesPool.push(...ROLES.BAD);
  }
  const badRoles = shuffleArray(badRolesPool).slice(0, badCount);

  const allRoles = [...goodRoles, ...badRoles];
  const shuffledRoles = shuffleArray(allRoles);

  return players.map((player, index) => ({
    ...player,
    role: shuffledRoles[index] as PlayerRole
  }));
}
