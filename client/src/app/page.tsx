'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Lobby() {
  return (
    <Suspense fallback={null}>
      <LobbyInner />
    </Suspense>
  );
}

function LobbyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [prefilledRoom, setPrefilledRoom] = useState(false);

  const {
    createRoom,
    joinRoom,
    roomId: storeRoomId,
    players,
    error,
    clearError,
    ensurePlayerId,
  } = useGameStore();

  useEffect(() => {
    ensurePlayerId();
  }, [ensurePlayerId]);

  // Auto-fill room code from ?room= query param (shared-link landing).
  useEffect(() => {
    const r = searchParams.get('room');
    if (r && !prefilledRoom) {
      setRoomId(r.toUpperCase());
      setPrefilledRoom(true);
    }
  }, [searchParams, prefilledRoom]);

  useEffect(() => {
    if (storeRoomId && players.length > 0) {
      router.push(`/game/${storeRoomId}`);
    }
  }, [storeRoomId, players, router]);

  const handleCreate = async () => {
    if (!roomId.trim() || !playerName.trim()) return;
    setIsCreating(true);
    await createRoom(roomId.trim(), playerName.trim());
    setIsCreating(false);
  };

  const handleJoin = async () => {
    if (!roomId.trim() || !playerName.trim()) return;
    setIsJoining(true);
    await joinRoom(roomId.trim(), playerName.trim());
    setIsJoining(false);
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Background radial gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(99,102,241,0.08),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(74,225,118,0.05),transparent_40%)]" />
      </div>

      {/* Main card */}
      <div className="relative w-full max-w-md">
        <div className="glass-panel rounded-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="/brand/logo-wordmark.svg"
              alt="Say Agile One More Time"
              className="h-12 mx-auto mb-2 dark:invert-0"
            />
            <p className="text-sm text-muted-foreground font-mono">
              Real-time social deduction
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-error-container border border-error/30 text-error text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-error hover:text-error/80 ml-2">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            {/* Player name */}
            <div className="space-y-2">
              <label
                htmlFor="player-name"
                className="text-xs font-semibold tracking-widest uppercase text-muted-foreground"
              >
                Your Name
              </label>
              <Input
                id="player-name"
                name="playerName"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                className="h-11 font-sans"
              />
            </div>

            {/* Room code */}
            <div className="space-y-2">
              <label
                htmlFor="room-code"
                className="text-xs font-semibold tracking-widest uppercase text-muted-foreground"
              >
                Room Code
              </label>
              <div className="flex gap-2">
                <Input
                  id="room-code"
                  name="roomCode"
                  placeholder="Enter room code"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  maxLength={20}
                  className="h-11 font-mono text-base tracking-widest"
                />
                <Button
                  variant="outline"
                  onClick={generateRoomId}
                  className="h-11 px-4 shrink-0"
                >
                  <span className="material-symbols-outlined text-xl">autorenew</span>
                </Button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold tracking-wide"
                onClick={handleCreate}
                disabled={!roomId.trim() || !playerName.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <span className="material-symbols-outlined text-xl mr-2 animate-spin">progress_activity</span>
                    Creating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl mr-2">add</span>
                    Create Room
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 font-semibold tracking-wide border-primary/40 text-primary hover:bg-primary/10"
                onClick={handleJoin}
                disabled={!roomId.trim() || !playerName.trim() || isJoining}
              >
                {isJoining ? (
                  <>
                    <span className="material-symbols-outlined text-xl mr-2 animate-spin">progress_activity</span>
                    Joining...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl mr-2">login</span>
                    Join
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Rules hint */}
          <div className="mt-8 pt-6 border-t border-border text-center space-y-1">
            <p className="text-xs text-muted-foreground font-mono">
              5–10 players · Good vs Bad
            </p>
            <p className="text-xs text-muted-foreground">
              Good: complete 4 sprints · Bad: fail 2 sprints, 4 delays, or guess the SM
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
