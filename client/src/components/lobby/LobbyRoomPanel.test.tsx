// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LobbyRoomPanel, type LobbyLobbyPlayer, type LobbyRoomPanelProps } from './LobbyRoomPanel';

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

afterEach(cleanup);

const players: LobbyLobbyPlayer[] = [
  { id: 'host', name: 'Minh', ready: true, presence: 'online', isHost: true },
  { id: 'guest', name: 'An', ready: false, presence: 'online' },
];

function renderLobby(overrides: Partial<LobbyRoomPanelProps> = {}) {
  const props: LobbyRoomPanelProps = {
    roomId: 'ABC123',
    players,
    currentPlayerId: 'host',
    isHost: true,
    isReady: true,
    isLocked: false,
    communicationMode: 'remote',
    phase: 'lobby',
    ...overrides,
  };
  return render(<LobbyRoomPanel {...props} />);
}

describe('LobbyRoomPanel', () => {
  it('shows Vietnamese room info and toggles the current player ready state', async () => {
    const onReadyChange = vi.fn();
    renderLobby({ onReadyChange });

    expect(screen.getByText('Mã phòng')).toBeTruthy();
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.queryByText('Mất kết nối')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chưa sẵn sàng' }));

    await waitFor(() => expect(onReadyChange).toHaveBeenCalledWith(false));
  });

  it('asks for confirmation before kicking a player', async () => {
    const onKick = vi.fn();
    renderLobby({ onKick });

    fireEvent.click(screen.getByRole('button', { name: 'Mời rời phòng' }));
    expect(screen.getByText('Mời An rời phòng?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(onKick).toHaveBeenCalledWith('guest'));
  });

  it('allows the host to change the communication presentation mode', async () => {
    const onCommunicationModeChange = vi.fn();
    renderLobby({ onCommunicationModeChange });

    fireEvent.click(screen.getByRole('button', { name: 'Chơi trực tiếp' }));
    await waitFor(() => expect(onCommunicationModeChange).toHaveBeenCalledWith('inPerson'));
  });

  it('requires five returning players before the host can start a rematch', () => {
    renderLobby({
      phase: 'ended',
      rematch: { proposedBy: 'host', readyPlayerIds: ['host', 'guest', 'p3', 'p4'] },
      onRematchOptIn: vi.fn(),
      onStartRematch: vi.fn(),
    });

    expect(screen.getByText('4/5 người đã sẵn sàng. Cần ít nhất 5 người để bắt đầu.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bắt đầu ván mới' }).hasAttribute('disabled')).toBe(true);
  });
});
