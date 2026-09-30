// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleConfigCounter } from './RoleConfigCounter';
import { useGameStore } from '@/store/gameStore';
import type { GameRole } from '@/game/types';

afterEach(() => {
  cleanup();
  useGameStore.setState({ players: [], roleConfig: { counts: {} }, publicState: null, rolePreset: null, error: null });
});

beforeEach(() => {
  useGameStore.setState({
    players: Array.from({ length: 5 }, (_, index) => ({ id: `p${index}`, name: `Player ${index}`, ready: false, presence: 'online' as const, isSpectator: false })),
    roleConfig: { counts: {} },
    rolePreset: 'beginner',
    error: null,
    isHost: true,
  });
});

const beginnerRoles: GameRole[] = ['Scrum Master', 'Developer', 'Business Analyst', 'Người trễ task', 'Deadline'];

describe('RoleConfigCounter', () => {
  it('shows the server preview and starts without sending role identities back', () => {
    const onStart = vi.fn();
    render(<RoleConfigCounter onStart={onStart} rolePreview={{ preset: 'beginner', roles: beginnerRoles }} />);

    expect(screen.getByText('Scrum Master')).toBeTruthy();
    expect(screen.getByText('Người trễ task')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ván' }));

    expect(onStart).toHaveBeenCalledWith([]);
  });

  it('does not include spectator seats in role-count and start validation', () => {
    const onStart = vi.fn();
    useGameStore.setState((state) => ({
      players: [...state.players, { id: 'viewer', name: 'Viewer', ready: false, presence: 'online' as const, isSpectator: true }],
    }));
    render(<RoleConfigCounter onStart={onStart} rolePreview={{ preset: 'beginner', roles: beginnerRoles }} />);

    const start = screen.getByRole('button', { name: 'Bắt đầu ván' });
    expect(start.hasAttribute('disabled')).toBe(false);
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledWith([]);
  });

  it('saves a selected preset through the lobby callback', async () => {
    const onSelectPreset = vi.fn().mockResolvedValue(undefined);
    render(
      <RoleConfigCounter
        onStart={vi.fn()}
        rolePreview={{ preset: 'beginner', roles: beginnerRoles }}
        onSelectPreset={onSelectPreset}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Hỗn loạn/ }));
    await waitFor(() => expect(onSelectPreset).toHaveBeenCalledWith('chaos', undefined));
  });

  it('only offers reroll for randomized presets and calls the server action', async () => {
    const onRerollPreset = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <RoleConfigCounter onStart={vi.fn()} rolePreview={{ preset: 'classic', roles: beginnerRoles }} onRerollPreset={onRerollPreset} />,
    );
    expect(screen.queryByRole('button', { name: 'Đổi đội hình' })).toBeNull();

    rerender(<RoleConfigCounter onStart={vi.fn()} rolePreview={{ preset: 'chaos', roles: beginnerRoles }} onRerollPreset={onRerollPreset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi đội hình' }));
    await waitFor(() => expect(onRerollPreset).toHaveBeenCalledTimes(1));
  });
});
