// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndGameProjection, PublicGameState } from '@/game/types';
import { useGameStore } from '@/store/gameStore';

vi.mock('next/navigation', () => ({
  useParams: () => ({ roomId: 'ROOM' }),
  useRouter: () => ({ push: vi.fn() }),
}));

import GamePage from '@/app/game/[roomId]/page';

function selectionState(): PublicGameState & { hostPlayerId: string } {
  return {
    id: 'ROOM',
    hostPlayerId: 'p1',
    players: [
      { id: 'p1', name: 'An' },
      { id: 'p2', name: 'Bình' },
      { id: 'p3', name: 'Chi' },
      { id: 'p4', name: 'Dũng' },
      { id: 'p5', name: 'Hà' },
    ],
    phase: 'teamSelection',
    phaseVersion: 4,
    phaseStartedAt: 10_000,
    phaseDeadlineAt: 55_000,
    teamSelectionDeadlineAt: 55_000,
    revision: 4,
    sprintIndex: 0,
    leaderId: 'p1',
    requiredTeamSize: 2,
    teamIds: [],
    teamVoteSubmittedPlayerIds: [],
    teamVotePendingPlayerIds: [],
    executionSubmittedCount: 0,
    teamVoteOutcome: null,
    teamVoteRevealVotes: null,
    executionReveal: null,
    rejectedTeams: 0,
    goodWins: 0,
    badWins: 0,
    chatPolicy: { allMuted: false, mutedPlayerId: null },
    history: [],
    winner: null,
    endReason: null,
    publicEvents: [],
  };
}

describe('GamePage team selection', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    const initial = useGameStore.getState();
    useGameStore.setState({
      ...initial,
      roomId: 'ROOM',
      publicState: selectionState(),
      privateState: {
        ownRole: 'Developer',
        faction: 'good',
        knownRoles: [],
        ttsFollowTargetId: null,
        canUseBadFactionChat: false,
        allowedActions: ['setTeam', 'finalizeTeam'],
        effects: [],
      },
      endReveal: null,
      playerId: 'p1',
      playerName: 'An',
      playerReady: true,
      isSpectator: false,
      isHost: true,
      players: selectionState().players,
      phase: 'teamSelection',
      phaseVersion: 4,
      currentSprint: 0,
      requiredTeamSize: 2,
      proposedTeam: [],
      currentPO: { id: 'p1', name: 'An' },
      myRole: 'Developer',
      faction: 'good',
      isGood: true,
      allowedActions: ['setTeam', 'finalizeTeam'],
      phaseStartedAt: 10_000,
      phaseDeadlineAt: 55_000,
      poSelectDeadlineAt: 55_000,
      phaseRemainingMs: 45_000,
      error: null,
      rejoinRoom: vi.fn().mockResolvedValue(undefined),
      subscribeToRoom: vi.fn(),
      unsubscribeFromRoom: vi.fn(),
      fetchEndReveal: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('lets the PO select the required number of players and finalize the team', async () => {
    const user = userEvent.setup();
    const finalize = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ proposeTeam: finalize });

    render(<GamePage />);

    expect(screen.getByText('Sprint 1 · Chọn đội')).toBeTruthy();
    expect(screen.getByText('Chọn đúng 2 người')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Bình/ }));
    await user.click(screen.getByRole('button', { name: 'Chọn Chi' }));
    await user.click(screen.getByRole('button', { name: 'Chốt đội hình' }));

    expect(finalize).toHaveBeenCalledWith(['p2', 'p3']);
  });

  it('shows and sends to private faction chat only for an eligible player', async () => {
    const user = userEvent.setup();
    const sendPublic = vi.fn().mockResolvedValue(undefined);
    const sendBad = vi.fn().mockResolvedValue(undefined);
    const viewerPrivate = useGameStore.getState().privateState!;
    useGameStore.setState({
      privateState: { ...viewerPrivate, ownRole: 'Client', faction: 'bad', canUseBadFactionChat: true },
      canUseBadFactionChat: true,
      sendMessage: sendPublic,
      sendBadMessage: sendBad,
    });

    render(<GamePage />);
    await user.click(screen.getAllByRole('button', { name: 'Chat riêng' })[0]);
    await user.type(screen.getAllByRole('textbox', { name: 'Nhắn riêng cho phe Phá Dự Án' })[0], 'Trao đổi riêng');
    await user.click(screen.getAllByRole('button', { name: 'Gửi tin nhắn' })[0]);

    expect(sendBad).toHaveBeenCalledWith('Trao đổi riêng');
    expect(sendPublic).not.toHaveBeenCalled();
  });

  it('does not render the bad-faction chat tab for a good viewer', () => {
    render(<GamePage />);
    expect(screen.queryByRole('button', { name: 'Chat riêng' })).toBeNull();
  });

  it('keeps PM takeover directly reachable during PO team selection', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      privateState: state.privateState ? {
        ...state.privateState,
        ownRole: 'Project Manager',
        allowedActions: ['usePmOverride'],
      } : null,
      myRole: 'Project Manager',
      allowedActions: ['usePmOverride'],
    });
    render(<GamePage />);
    expect(screen.getByRole('button', { name: 'Chiếm quyền chỉ định' })).toBeTruthy();
  });

  it('keeps other players roles hidden until the explicit end reveal arrives', async () => {
    const ended = { ...selectionState(), phase: 'ended' as const, phaseVersion: 5, phaseDeadlineAt: null, teamSelectionDeadlineAt: null, winner: 'good' as const, endReason: 'assassinationDeadline' as const, goodWins: 3 };
    useGameStore.setState({ publicState: ended, phase: 'ended', endReveal: null, isSpectator: false });

    render(<GamePage />);

    expect(screen.getByText('Mở vai trò cả đội')).toBeTruthy();
    expect(screen.queryByText('Scrum Master')).toBeNull();
    expect(screen.queryByText('Người trễ task')).toBeNull();

    const explicitReveal: EndGameProjection = {
      ...ended,
      revealedRoles: [
        { playerId: 'p1', role: 'Scrum Master' },
        { playerId: 'p2', role: 'Người trễ task' },
        { playerId: 'p3', role: 'Developer' },
        { playerId: 'p4', role: 'Developer' },
        { playerId: 'p5', role: 'Developer' },
      ],
    };
    await act(async () => { useGameStore.setState({ endReveal: explicitReveal }); });

    expect(screen.getByText('Scrum Master')).toBeTruthy();
    expect(screen.getByText('Người trễ task')).toBeTruthy();
  });
});
