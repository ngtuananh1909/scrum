import { BAD_ROLES, GOOD_ROLES, type GameRole } from './types';

export type PresetMode = 'beginner' | 'classic' | 'advanced' | 'chaos' | 'custom';

const BEGINNER_GOOD: readonly GameRole[] = [
  'Scrum Master', 'Developer', 'Business Analyst', 'Project Manager', 'Quality Controller', 'Technical Leader',
];
const BEGINNER_BAD: readonly GameRole[] = [
  'Người trễ task', 'Deadline', 'Technical Debt', 'Ông sếp khó ưa',
];
const CLASSIC_GOOD: readonly GameRole[] = [
  'Scrum Master', 'Business Analyst', 'Developer', 'Project Manager', 'Technical Leader', 'Quality Controller',
];
const CLASSIC_BAD: readonly GameRole[] = [
  'Người trễ task', 'Client', 'Kẻ fake CV', 'Deadline',
];
const ADVANCED_GOOD: readonly GameRole[] = [
  'Business Analyst', 'Data Analyst', 'Thực tập sinh', 'Technical Leader', 'Project Manager', 'Quality Controller', 'Developer',
];
const ADVANCED_BAD: readonly GameRole[] = [
  'Client', 'Kẻ fake CV', 'QC cẩu thả', 'Deadline',
];

export interface PresetPreviewOptions {
  mode: Exclude<PresetMode, 'custom'>;
  playerCount: number;
  /** Stable room seed. Change it only when the host explicitly rerolls. */
  seed: number;
}

export function factionForRole(role: GameRole): 'good' | 'bad' {
  return (GOOD_ROLES as readonly string[]).includes(role) ? 'good' : 'bad';
}

export function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function sample<T>(items: readonly T[], count: number, random: () => number): T[] {
  const remaining = [...items];
  const result: T[] = [];
  while (result.length < count && remaining.length > 0) {
    result.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  }
  return result;
}

function roleCounts(playerCount: number): { good: number; bad: number } {
  if (!Number.isInteger(playerCount) || playerCount < 5 || playerCount > 10) {
    throw new Error('Player count must be between 5 and 10');
  }
  const good = Math.ceil(playerCount * 0.6);
  return { good, bad: playerCount - good };
}

function ensureMeaningfulInformation(good: GameRole[], bad: GameRole[]): GameRole[] {
  if (!bad.includes('Client') && !bad.includes('Kẻ fake CV')) return good;
  if (good.includes('Business Analyst')) return good;
  const replaceIndex = good.findIndex((role) => role !== 'Scrum Master');
  if (replaceIndex >= 0) good[replaceIndex] = 'Business Analyst';
  return good;
}

/** Returns a legal deterministic preview. The server assigns these selected roles at Start. */
export function previewPreset(options: PresetPreviewOptions): GameRole[] {
  const { good: goodCount, bad: badCount } = roleCounts(options.playerCount);
  if (options.mode === 'beginner') return [...BEGINNER_GOOD.slice(0, goodCount), ...BEGINNER_BAD.slice(0, badCount)];
  if (options.mode === 'classic') return [...CLASSIC_GOOD.slice(0, goodCount), ...CLASSIC_BAD.slice(0, badCount)];

  const goodPool = options.mode === 'advanced'
    ? ADVANCED_GOOD
    : GOOD_ROLES.filter((role) => role !== 'Scrum Master');
  const badPool = options.mode === 'advanced'
    ? ADVANCED_BAD
    : BAD_ROLES.filter((role) => role !== 'Người trễ task');
  const random = createSeededRandom(options.seed);
  const bad = ['Người trễ task', ...sample(badPool, badCount - 1, random)] as GameRole[];
  const good = ensureMeaningfulInformation(
    ['Scrum Master', ...sample(goodPool, goodCount - 1, random)] as GameRole[],
    bad,
  );
  return [...good, ...bad];
}

export function isRoleSetValid(roles: readonly GameRole[], playerCount = roles.length): boolean {
  try {
    const counts = roleCounts(playerCount);
    const knownRoles: readonly string[] = [...GOOD_ROLES, ...BAD_ROLES];
    return roles.length === playerCount
      && roles.every((role) => knownRoles.includes(role))
      && roles.filter((role) => role === 'Scrum Master').length === 1
      && roles.filter((role) => role === 'Người trễ task').length === 1
      && roles.filter((role) => factionForRole(role) === 'good').length === counts.good
      && roles.filter((role) => factionForRole(role) === 'bad').length === counts.bad;
  } catch {
    return false;
  }
}
