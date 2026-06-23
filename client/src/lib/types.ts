// Game Constants

// SPRINT_SIZES per PDF: 4 sprints total, varies by player count.
export const SPRINT_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3],
  6: [2, 3, 4, 3],
  7: [2, 3, 3, 4],
  8: [3, 4, 4, 5],
  9: [3, 4, 4, 5],
  10: [3, 4, 5, 6]
};

export const REQUIRES_DOUBLE_FAIL = [7, 8, 9, 10];

// Full PDF role set: 8 good + 7 bad. Multi-instance: Developer, Người trễ task.
export const ROLES = {
  GOOD: [
    'Scrum Master',
    'Project Manager',
    'Developer',
    'Business Analyst',
    'Quality Controller',
    'Technical Leader',
    'Data Analyst',
    'Thực tập sinh',
  ],
  BAD: [
    'Người trễ task',
    'Client',
    'Ông sếp khó ưa',
    'Kẻ fake CV',
    'QC cẩu thả',
    'Deadline',
    'Technical Debt',
  ],
} as const;

export type PlayerRole =
  | typeof ROLES.GOOD[number]
  | typeof ROLES.BAD[number];

export const MULTI_INSTANCE_ROLES: PlayerRole[] = ['Developer', 'Người trễ task'];

export const ROLE_DESCRIPTIONS: Record<PlayerRole, string> = {
  'Scrum Master': 'Người dẫn dắt team. Bí mật biết danh tính phe Phá Dự Án ngay từ đầu. Nếu Người trễ task đoán đúng bạn cuối game, phe xấu thắng.',
  'Project Manager': 'Có quyền chiếm chỉ định nhóm Sprint (1 lần/game). Khi dùng, bỏ qua biểu quyết, đi thẳng vào thực thi.',
  'Developer': 'Lá phiếu biểu quyết quan trọng. Phải vote SUCCESS khi đi Sprint.',
  'Business Analyst': 'Kiểm tra 2 người (1 lần/game). Quản trò trả Yes nếu ≥1 thuộc phe xấu, ngược lại No.',
  'Quality Controller': 'Yêu cầu làm lại Sprint (1 lần/game). Hủy kết quả Sprint vừa công bố, lập kế hoạch lại từ đầu.',
  'Technical Leader': 'Gánh team. Nếu trong nhóm Sprint có TL và chỉ có 1 phiếu Fail, phiếu đó tự đổi thành Success.',
  'Data Analyst': 'Phân tích phiếu (1 lần/game, từ Sprint 2). Chọn 1 người đã đi Sprint trước để biết họ vote Hoàn thành hay Cháy deadline.',
  'Thực tập sinh': 'Đầu game chọn 1 người để theo sát. Từ Sprint 2, phiếu biểu quyết duyệt nhóm của người đó được nhân đôi.',

  'Người trễ task': 'Vote Cháy deadline khi đi Sprint. Cuối game, nếu phe tốt thắng, được 1 lần chỉ điểm Scrum Master để lật kèo.',
  'Client': 'Biết danh tính Business Analyst ngay từ đầu game. Phối hợp tống khứ hoặc đánh lạc hướng.',
  'Ông sếp khó ưa': 'Mỗi Sprint chọn 1 người, người đó bị cấm chat & biểu quyết trong vòng Planning của Sprint.',
  'Kẻ fake CV': 'Nếu BA hoặc SM kiểm tra, hệ thống trả kết quả "Scrum Team" (lừa).',
  'QC cẩu thả': 'Khi đi Sprint và vote Cháy deadline, phiếu của bạn tính là 2 phiếu Fail.',
  'Deadline': 'Áp lực tối đa (1 lần/game): cấm chat của TẤT CẢ thành viên trong Planning của Sprint đó.',
  'Technical Debt': 'Nếu bạn tham gia Sprint hiện tại, Sprint tiếp theo bắt buộc cộng thêm +1 nhân sự.',
};

export type Phase =
  | 'lobby'
  | 'nightZero'
  | 'planning'
  | 'teamVoting'
  | 'execution'
  | 'sprintResult'
  | 'ended';

export type Vote = 'agree' | 'reject' | 'success' | 'fail';

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
  currentSprint: number; // 0-3 (4 sprints max)
  proposedTeam: string[]; // player ids
  votes: Record<string, Vote>; // playerId -> vote for team voting
  executionVotes: Record<string, Vote>; // playerId -> vote for execution
  consecutiveDelays: number;
  goodWins: number;
  badWins: number;
  saboteurGuess: string | null;

  // One-shot skill flags
  pmOverrideUsed: boolean;
  dataAnalystCheckUsed: boolean;
  businessAnalystCheckUsed: boolean;
  qcRedoUsed: boolean;

  // Per-sprint flags — reset at start of each new sprint
  sepSilencedPlayerId: string | null;
  deadlineSilenced: boolean;
  techDebtActive: boolean; // applies +1 to current sprint's team size

  // Passive / persisted state
  techLeadPresent: boolean; // computed at team approval
  ttsFollowTargetId: string | null;

  // Snapshot of previous sprint — used by Data Analyst check
  prevSprintTeam: string[];
  prevExecutionVotes: Record<string, Vote>;
  prevSprintIndex: number; // sprint number that prev* refer to (-1 if none yet)

  // Legacy — kept as no-op for backward compat with in-flight rooms
  qcBugged?: boolean;

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

// ===== Role config (lobby selection) =====

export interface RoleConfig {
  // counts[role] = number of players assigned this role. Multi-instance roles
  // (Developer, Người trễ task) can be > 1; others 0 or 1.
  counts: Partial<Record<PlayerRole, number>>;
}

export function isMultiInstance(role: PlayerRole): boolean {
  return MULTI_INSTANCE_ROLES.includes(role);
}

export function totalSelected(cfg: RoleConfig): number {
  return Object.values(cfg.counts).reduce((sum, n) => sum + (n || 0), 0);
}

export function canStart(cfg: RoleConfig, playerCount: number): boolean {
  return totalSelected(cfg) === playerCount && playerCount >= 5;
}

// Flatten RoleConfig into a list of role strings (one per player).
export function expandRoleConfig(cfg: RoleConfig): string[] {
  const out: string[] = [];
  for (const [role, n] of Object.entries(cfg.counts)) {
    for (let i = 0; i < (n || 0); i++) out.push(role);
  }
  return out;
}

// ===== Helper functions =====

export function getSprintSize(
  playerCount: number,
  sprintIndex: number,
  techDebtActive = false
): number {
  const base = SPRINT_SIZES[playerCount]?.[sprintIndex] ?? 3;
  return techDebtActive ? base + 1 : base;
}

export function requiresDoubleFail(playerCount: number, sprintIndex: number): boolean {
  return REQUIRES_DOUBLE_FAIL.includes(playerCount) && sprintIndex === 2;
}

export function isGoodRole(role: string): boolean {
  return (ROLES.GOOD as readonly string[]).includes(role);
}

export function isBadRole(role: string): boolean {
  return (ROLES.BAD as readonly string[]).includes(role);
}

// A player is silenced when Deadline activated this sprint OR Sếp targeted them.
export function isSilenced(room: Pick<Room, 'deadlineSilenced' | 'sepSilencedPlayerId'>, playerId: string): boolean {
  return Boolean(room.deadlineSilenced) || room.sepSilencedPlayerId === playerId;
}

// TTS double-vote multiplier. Active from Sprint 2 onwards (currentSprint >= 1).
// On Sprint 1 (currentSprint === 0) returns 1× even for the followed player.
export function ttsMultiplier(
  room: Pick<Room, 'currentSprint' | 'ttsFollowTargetId'>,
  voterId: string
): number {
  if ((room.currentSprint ?? 0) < 1) return 1;
  return room.ttsFollowTargetId === voterId ? 2 : 1;
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Default 60/40 role pool when host doesn't pick.
// Non-multi roles drawn first (no duplicates), remaining slots filled with multi-instance roles.
export function defaultRolePool(playerCount: number): string[] {
  const goodCount = Math.ceil(playerCount * 0.6);
  const badCount = playerCount - goodCount;

  const nonMultiGood = ROLES.GOOD.filter((r) => !isMultiInstance(r));
  const nonMultiBad = ROLES.BAD.filter((r) => !isMultiInstance(r));

  const good = shuffleArray([...nonMultiGood]).slice(0, Math.min(goodCount, nonMultiGood.length));
  while (good.length < goodCount) good.push('Developer');

  const bad = shuffleArray([...nonMultiBad]).slice(0, Math.min(badCount, nonMultiBad.length));
  while (bad.length < badCount) bad.push('Người trễ task');

  return [...good, ...bad];
}

export function assignRoles(players: Player[]): Player[] {
  const pool = shuffleArray(defaultRolePool(players.length));
  return players.map((p, i) => ({ ...p, role: pool[i] as PlayerRole }));
}

export function assignSelectedRoles(players: Player[], selectedRoles: string[]): Player[] {
  const shuffledPlayers = shuffleArray(players);
  const shuffledRoles = shuffleArray([...selectedRoles]);
  return shuffledPlayers.map((player, index) => ({
    ...player,
    role: shuffledRoles[index] as PlayerRole,
  }));
}
