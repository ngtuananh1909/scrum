import type { RoleConfig, PlayerRole } from '@/lib/types';
import { isRoleSetValid } from '@/game/presets';
import type { GameRole } from '@/game/types';

export const CUSTOM_ROLE_OPTIONS = [
  'Scrum Master',
  'Project Manager',
  'Developer',
  'Business Analyst',
  'Quality Controller',
  'Technical Leader',
  'Data Analyst',
  'Thực tập sinh',
  'Người trễ task',
  'Client',
  'Ông sếp khó ưa',
  'Kẻ fake CV',
  'QC cẩu thả',
  'Deadline',
  'Technical Debt',
] as const satisfies readonly PlayerRole[];

export function roleConfigFromRoles(roles: readonly GameRole[]): RoleConfig {
  const counts: Partial<Record<PlayerRole, number>> = {};
  for (const role of roles) counts[role] = (counts[role] ?? 0) + 1;
  return { counts };
}

export function rolesFromRoleConfig(config: RoleConfig): GameRole[] {
  const roles: GameRole[] = [];
  for (const [role, count] of Object.entries(config.counts)) {
    for (let index = 0; index < (count ?? 0); index += 1) roles.push(role as GameRole);
  }
  return roles;
}

export function customRoleSelectionError(roles: readonly GameRole[], playerCount: number): string | null {
  if (playerCount < 5 || playerCount > 10) return 'Cần từ 5 đến 10 người chơi.';
  if (roles.length !== playerCount) return `Hãy chọn đủ ${playerCount} vai trò.`;

  const counts = new Map<GameRole, number>();
  for (const role of roles) counts.set(role, (counts.get(role) ?? 0) + 1);
  if ((counts.get('Scrum Master') ?? 0) !== 1) return 'Cần đúng 1 Scrum Master.';
  if ((counts.get('Người trễ task') ?? 0) !== 1) return 'Cần đúng 1 Người trễ task.';
  if ([...counts.entries()].some(([role, count]) => count > 1 && role !== 'Developer')) {
    return 'Chỉ có Developer được chọn nhiều hơn một người.';
  }

  if (!isRoleSetValid(roles, playerCount)) {
    return `Cần đúng ${Math.ceil(playerCount * 0.6)} vai phe tốt và ${playerCount - Math.ceil(playerCount * 0.6)} vai phe xấu.`;
  }
  return null;
}
