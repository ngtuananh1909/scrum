import { describe, expect, it } from 'vitest';
import {
  customRoleSelectionError,
  roleConfigFromRoles,
  rolesFromRoleConfig,
} from './roleSelection';
import type { GameRole } from '@/game/types';

describe('custom lobby role selection', () => {
  it('round-trips selected roles through the existing role config shape', () => {
    const roles: GameRole[] = ['Scrum Master', 'Developer', 'Developer', 'Người trễ task', 'Deadline'];

    expect(rolesFromRoleConfig(roleConfigFromRoles(roles))).toEqual(roles);
  });

  it('accepts exactly the ceiling 60 percent good roles for five players', () => {
    const roles: GameRole[] = ['Scrum Master', 'Developer', 'Developer', 'Người trễ task', 'Deadline'];

    expect(customRoleSelectionError(roles, 5)).toBeNull();
  });

  it('accepts the ceiling 60 percent good roles for seven players', () => {
    const roles: GameRole[] = [
      'Scrum Master', 'Business Analyst', 'Developer', 'Project Manager', 'Quality Controller',
      'Người trễ task', 'Client',
    ];

    expect(customRoleSelectionError(roles, 7)).toBeNull();
  });

  it('requires exactly one Scrum Master and one Người trễ task', () => {
    const duplicateSm: GameRole[] = ['Scrum Master', 'Scrum Master', 'Developer', 'Người trễ task', 'Deadline'];
    const duplicateSaboteur: GameRole[] = ['Scrum Master', 'Developer', 'Developer', 'Người trễ task', 'Người trễ task'];

    expect(customRoleSelectionError(duplicateSm, 5)).toBe('Cần đúng 1 Scrum Master.');
    expect(customRoleSelectionError(duplicateSaboteur, 5)).toBe('Cần đúng 1 Người trễ task.');
  });

  it('rejects faction counts that do not match the 60/40 split', () => {
    const roles: GameRole[] = ['Scrum Master', 'Business Analyst', 'Developer', 'Project Manager', 'Người trễ task'];

    expect(customRoleSelectionError(roles, 5)).toContain('3 vai phe tốt và 2 vai phe xấu');
  });

  it('rejects duplicate roles other than Developer', () => {
    const roles: GameRole[] = ['Scrum Master', 'Project Manager', 'Business Analyst', 'Người trễ task', 'Deadline'];
    const duplicatedNonMultiRole: GameRole[] = ['Scrum Master', 'Project Manager', 'Project Manager', 'Người trễ task', 'Deadline'];

    expect(customRoleSelectionError(roles, 5)).toBeNull();
    expect(customRoleSelectionError(duplicatedNonMultiRole, 5)).toBe('Chỉ có Developer được chọn nhiều hơn một người.');
  });
});
