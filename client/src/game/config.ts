import type { GamePhase } from './types';

export const GAME_CONFIG = {
  phaseDurationsMs: {
    roleReveal: 30_000,
    firstNight: 20_000,
    planningDiscussion: 180_000,
    teamSelection: 45_000,
    teamVoting: 30_000,
    teamVoteReveal: 3_000,
    execution: 30_000,
    executionReveal: 4_000,
    sprintResult: 20_000,
    assassination: 60_000,
  },
  sprintSizes: {
    5: [2, 3, 2, 3],
    6: [2, 3, 4, 3],
    7: [2, 3, 3, 4],
    8: [3, 4, 4, 5],
    9: [3, 4, 4, 5],
    10: [3, 4, 5, 6],
  },
  badWinFailedSprints: 3,
  badWinRejectedTeams: 4,
  goodWinsForAssassination: 3,
} as const;

export function phaseDuration(phase: Exclude<GamePhase, 'ended'>): number {
  return GAME_CONFIG.phaseDurationsMs[phase];
}

export function baseSprintTeamSize(playerCount: number, sprintIndex: number): number {
  const sizes = GAME_CONFIG.sprintSizes[playerCount as keyof typeof GAME_CONFIG.sprintSizes];
  if (!sizes) throw new Error(`Unsupported player count: ${playerCount}`);
  return sizes[Math.min(sprintIndex, sizes.length - 1)];
}

export function requiredTeamSize(playerCount: number, sprintIndex: number, bonus: number): number {
  return Math.min(playerCount, baseSprintTeamSize(playerCount, sprintIndex) + bonus);
}

export function requiresTwoFails(playerCount: number, sprintIndex: number): boolean {
  return playerCount >= 7 && sprintIndex === 2;
}
