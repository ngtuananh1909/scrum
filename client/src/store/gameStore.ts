import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';

interface Player {
  id: string;
  name: string;
  role?: string;
  isAlive: boolean;
  socketId?: string;
}

interface RoomState {
  roomId: string | null;
  playerId: string | null;
  players: Player[];
  phase: 'lobby' | 'planning' | 'teamVoting' | 'execution' | 'sprintResult' | 'ended' | null;
  currentSprint: number;
  proposedTeam: string[];
  currentPO: Player | null;
  myRole: string | null;
  isGood: boolean;
  saboteurIds: string[];
  clientId: string | null;
  goodWins: number;
  badWins: number;
  consecutiveDelays: number;
  techLeadPresent: boolean;
  qcBugged: boolean;
  pmOverrideUsed: boolean;
  dataAnalystCheckUsed: boolean;
  error: string | null;
  socket: Socket | null;
}

interface GameStore extends RoomState {
  connect: () => void;
  disconnect: () => void;
  createRoom: (roomId: string, playerName: string) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  startGame: () => void;
  proposeTeam: (playerIds: string[]) => void;
  voteTeam: (vote: 'agree' | 'reject') => void;
  voteExecution: (vote: 'success' | 'fail') => void;
  pmOverride: (playerIds: string[]) => void;
  dataAnalystCheck: (targetPlayerId: string) => void;
  saboteurGuess: (guessedSmId: string) => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  roomId: null,
  playerId: null,
  players: [],
  phase: null,
  currentSprint: 0,
  proposedTeam: [],
  currentPO: null,
  myRole: null,
  isGood: true,
  saboteurIds: [],
  clientId: null,
  goodWins: 0,
  badWins: 0,
  consecutiveDelays: 0,
  techLeadPresent: false,
  qcBugged: false,
  pmOverrideUsed: false,
  dataAnalystCheckUsed: false,
  error: null,
  socket: null,

  connect: () => {
    const socket = io('http://localhost:3001');

    socket.on('connect', () => {
      set({ playerId: socket.id || null });
    });

    socket.on('error', ({ message }: { message: string }) => {
      set({ error: message });
    });

    socket.on('roomCreated', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      set({ roomId, playerId });
    });

    socket.on('roomJoined', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      set({ roomId, playerId });
    });

    socket.on('playerJoined', ({ players }: { players: Player[] }) => {
      set({ players });
    });

    socket.on('playerLeft', ({ player }: { player: Player }) => {
      set((state) => ({
        players: state.players.filter((p) => p.id !== player.id),
      }));
    });

    socket.on('roleAssigned', ({ role, isGood }: { role: string; isGood: boolean }) => {
      set({ myRole: role, isGood });
    });

    socket.on('saboteursRevealed', ({ saboteurIds }: { saboteurIds: string[] }) => {
      set({ saboteurIds });
    });

    socket.on('clientRevealed', ({ clientId }: { clientId: string }) => {
      set({ clientId });
    });

    socket.on('gameStarted', ({ players, currentPO, currentSprint }: { players: Player[]; currentPO: Player; currentSprint: number }) => {
      set({ players, currentPO, currentSprint, phase: 'planning' });
    });

    socket.on('phaseChanged', ({ phase }: { phase: string }) => {
      set({ phase: phase as RoomState['phase'] });
    });

    socket.on('teamProposed', ({ proposedTeam }: { proposedTeam: string[] }) => {
      set({ proposedTeam });
    });

    socket.on('teamAccepted', () => {
      set({ consecutiveDelays: 0 });
    });

    socket.on('teamRejected', () => {
      set((state) => ({ consecutiveDelays: state.consecutiveDelays + 1 }));
    });

    socket.on('newPO', ({ currentPO }: { currentPO: Player }) => {
      set({ currentPO });
    });

    socket.on('sprintSuccess', ({ success, fails }: { success: number; fails: number }) => {
      set((state) => ({ goodWins: state.goodWins + 1 }));
    });

    socket.on('sprintFailed', ({ reason }: { reason: string }) => {
      set((state) => ({ badWins: state.badWins + 1 }));
    });

    socket.on('techLeadSaved', () => {
      set({ techLeadPresent: true });
    });

    socket.on('nextSprint', ({ currentSprint }: { currentSprint: number }) => {
      set({ currentSprint, proposedTeam: [] });
    });

    socket.on('gameEnded', ({ winner, reason }: { winner: string; reason?: string }) => {
      set({ phase: 'ended' });
    });

    socket.on('saboteurGuessPhase', ({ saboteurIds }: { saboteurIds: string[] }) => {
      // Handle in UI
    });

    socket.on('pmOverrideUsed', () => {
      set({ pmOverrideUsed: true });
    });

    socket.on('playerDied', ({ playerId }: { playerId: string }) => {
      set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId ? { ...p, isAlive: false } : p
        ),
      }));
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  createRoom: (roomId: string, playerName: string) => {
    const { socket } = get();
    socket?.emit('createRoom', { roomId, playerName });
  },

  joinRoom: (roomId: string, playerName: string) => {
    const { socket } = get();
    socket?.emit('joinRoom', { roomId, playerName });
  },

  startGame: () => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('startGame', { roomId });
    }
  },

  proposeTeam: (playerIds: string[]) => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('proposeTeam', { roomId, playerIds });
    }
  },

  voteTeam: (vote: 'agree' | 'reject') => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('voteTeam', { roomId, vote });
    }
  },

  voteExecution: (vote: 'success' | 'fail') => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('voteExecution', { roomId, vote });
    }
  },

  pmOverride: (playerIds: string[]) => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('pmOverride', { roomId, playerIds });
    }
  },

  dataAnalystCheck: (targetPlayerId: string) => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('dataAnalystCheck', { roomId, targetPlayerId });
    }
  },

  saboteurGuess: (guessedSmId: string) => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('saboteurGuess', { roomId, guessedSmId });
    }
  },

  clearError: () => set({ error: null }),
}));
