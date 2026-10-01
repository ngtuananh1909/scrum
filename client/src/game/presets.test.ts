import { describe, expect, test } from 'vitest';

import { isRoleSetValid, previewPreset } from './presets';

describe('role presets', () => {
  test('keeps every deterministic preview legal and reproducible', () => {
    const first = previewPreset({ mode: 'advanced', playerCount: 8, seed: 12 });
    const second = previewPreset({ mode: 'advanced', playerCount: 8, seed: 12 });

    expect(first).toEqual(second);
    expect(isRoleSetValid(first, 8)).toBe(true);
    expect(first.filter((role) => role === 'Scrum Master')).toHaveLength(1);
    expect(first.filter((role) => role === 'Người trễ task')).toHaveLength(1);
  });

  test('includes Business Analyst whenever a Client or fake CV is selected', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const roles = previewPreset({ mode: 'chaos', playerCount: 10, seed });
      if (roles.includes('Client') || roles.includes('Kẻ fake CV')) {
        expect(roles).toContain('Business Analyst');
      }
    }
  });

  test('keeps Beginner and Classic previews fixed across seeds', () => {
    for (const mode of ['beginner', 'classic'] as const) {
      const first = previewPreset({ mode, playerCount: 5, seed: 1 });
      const second = previewPreset({ mode, playerCount: 5, seed: 987 });

      expect(first).toEqual(second);
      expect(first).toEqual(mode === 'beginner'
        ? ['Scrum Master', 'Developer', 'Business Analyst', 'Người trễ task', 'Deadline']
        : ['Scrum Master', 'Business Analyst', 'Developer', 'Người trễ task', 'Client']);
    }
  });

  test('varies Advanced and Chaos previews by seed while keeping every role set legal', () => {
    for (const mode of ['advanced', 'chaos'] as const) {
      const first = previewPreset({ mode, playerCount: 8, seed: 1 });
      const second = previewPreset({ mode, playerCount: 8, seed: 2 });

      expect(first).not.toEqual(second);
      expect(isRoleSetValid(first, 8)).toBe(true);
      expect(isRoleSetValid(second, 8)).toBe(true);
    }
  });

  test('rejects a custom set that omits the sole Scrum Master', () => {
    expect(isRoleSetValid([
      'Developer', 'Developer', 'Business Analyst', 'Người trễ task', 'Client',
    ], 5)).toBe(false);
  });

  test('rejects unknown roles instead of treating arbitrary strings as sabotage roles', () => {
    expect(isRoleSetValid([
      'Scrum Master', 'Developer', 'Business Analyst', 'Người trễ task', 'Mystery Role',
    ] as never, 5)).toBe(false);
  });

  test('requires exactly one Scrum Master and exactly one task-delayer', () => {
    expect(isRoleSetValid([
      'Scrum Master', 'Developer', 'Business Analyst', 'Client', 'Deadline',
    ], 5)).toBe(false);
    expect(isRoleSetValid([
      'Scrum Master', 'Developer', 'Business Analyst', 'Người trễ task', 'Người trễ task',
    ], 5)).toBe(false);
  });
});
