import { describe, expect, it } from 'vitest';
import { createCommandRequest, mergeRoomMessages, useGameStore, type RoomMessage } from './gameStore';
import { createGameState, projectPrivateState, projectState, type GameRole } from '@/game';

describe('browser command adapter', () => {
  it('builds a versioned command without accepting a client actor identity', () => {
    const command = createCommandRequest(12, 'castTeamVote', { vote: 'approve' });

    expect(command.commandId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(command.expectedPhaseVersion).toBe(12);
    expect(command.type).toBe('castTeamVote');
    expect(command.vote).toBe('approve');
    expect(command).not.toHaveProperty('actorId');
    expect(command).not.toHaveProperty('playerId');
  });
});

describe('room message reconciliation', () => {
  it('deduplicates Realtime and polling messages by server sequence', () => {
    const first: RoomMessage = {
      sequence: 2,
      roomId: 'ROOM-1',
      audience: 'public',
      senderPlayerId: 'seat-1',
      text: 'second',
      createdAt: '2026-09-28T12:00:02.000Z',
    };
    const second: RoomMessage = { ...first, sequence: 1, text: 'first' };

    expect(mergeRoomMessages([first], [second, first])).toEqual([second, first]);
  });
});

describe('role reveal after separate public and private updates', () => {
  it('opens when the private role arrives late, stays closed after acknowledgement, and reopens for a new version', () => {
    useGameStore.getState().leaveRoom();
    const roles: GameRole[] = ['Scrum Master', 'Project Manager', 'Developer', 'Người trễ task', 'QC cẩu thả'];
    const game = createGameState({
      id: 'REVEAL',
      players: roles.map((role, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}`, role })),
      leaderId: 'p1',
      now: 0,
    });
    const seat = { id: 'p1', displayName: 'Player 1', ready: true, isSpectator: false };
    const room = { ...projectState(game), hostPlayerId: 'p1', settings: { communicationMode: 'inPerson' as const } };
    const privateView = projectPrivateState(game, 'p1').private;

    useGameStore.getState().setRoomFromResponse({ room, player: seat, private: null, serverNow: 0 });
    expect(useGameStore.getState().showRoleReveal).toBe(false);

    useGameStore.getState().setRoomFromResponse({ room, player: seat, private: privateView, serverNow: 0 });
    expect(useGameStore.getState().showRoleReveal).toBe(true);

    useGameStore.getState().closeRoleReveal();
    useGameStore.getState().setRoomFromResponse({ room, player: seat, private: privateView, serverNow: 0 });
    expect(useGameStore.getState().showRoleReveal).toBe(false);

    const nextRoom = { ...projectState({ ...game, phaseVersion: 1, revision: 1 }), hostPlayerId: 'p1' };
    useGameStore.getState().setRoomFromResponse({ room: nextRoom, player: seat, private: privateView, serverNow: 0 });
    expect(useGameStore.getState().showRoleReveal).toBe(true);
    useGameStore.getState().leaveRoom();
  });
});

describe('host permissions after the game starts', () => {
  it('keeps the host identity in the public game view for rematch controls', () => {
    useGameStore.getState().leaveRoom();
    const roles: GameRole[] = ['Scrum Master', 'Project Manager', 'Developer', 'Người trễ task', 'QC cẩu thả'];
    const game = createGameState({
      id: 'HOSTED',
      players: roles.map((role, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}`, role })),
      leaderId: 'p1', now: 0,
    });
    const room = { ...projectState(game), hostPlayerId: 'p1', settings: { communicationMode: 'inPerson' as const } };
    useGameStore.getState().setRoomFromResponse({
      room,
      player: { id: 'p1', displayName: 'Player 1', ready: false, isSpectator: false },
      private: projectPrivateState(game, 'p1').private,
      serverNow: 0,
    });
    expect(useGameStore.getState().isHost).toBe(true);
    expect(useGameStore.getState().roomSettings?.communicationMode).toBe('inPerson');
    useGameStore.getState().leaveRoom();
  });
});
