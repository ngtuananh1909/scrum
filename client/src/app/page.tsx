'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Lobby() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const { createRoom, joinRoom, roomId: storeRoomId, players, error, clearError } = useGameStore();

  useEffect(() => {
    if (storeRoomId && players.length > 0) {
      router.push(`/game/${storeRoomId}`);
    }
  }, [storeRoomId, players, router]);

  const handleCreate = () => {
    if (!roomId.trim() || !playerName.trim()) return;
    setIsCreating(true);
    createRoom(roomId.trim(), playerName.trim());
  };

  const handleJoin = () => {
    if (!roomId.trim() || !playerName.trim()) return;
    setIsJoining(true);
    joinRoom(roomId.trim(), playerName.trim());
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Say Agile One More Time
          </CardTitle>
          <p className="text-slate-500 mt-2">A real-time multiplayer social deduction game</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>{error}</p>
              <button onClick={clearError} className="text-sm underline mt-1">Dismiss</button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <Input
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Room Code</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter room code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={6}
                className="font-mono text-lg tracking-wider"
              />
              <Button variant="outline" onClick={generateRoomId}>
                Generate
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={!roomId.trim() || !playerName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleJoin}
              disabled={!roomId.trim() || !playerName.trim() || isJoining}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </Button>
          </div>

          <div className="text-center text-sm text-slate-500">
            <p>5-10 players required</p>
            <p className="mt-1">Good guys win by completing 3 sprints</p>
            <p>Bad guys win by failing 3 sprints or delaying 4 times</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
