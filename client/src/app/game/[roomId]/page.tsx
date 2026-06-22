'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const SPRINT_NAMES = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5'];

export default function GamePage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const {
    players, phase, currentSprint, proposedTeam, currentPO, myRole, isGood,
    saboteurIds, goodWins, badWins, consecutiveDelays, pmOverrideUsed,
    proposeTeam, voteTeam, voteExecution, pmOverride, saboteurGuess,
    startGame, connect, disconnect, playerId, socket
  } = useGameStore();

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (socket) {
      socket.emit('joinRoom', { roomId, playerName: 'Player' });
    }
  }, [socket, roomId]);

  const isPO = currentPO?.id === playerId;
  const isOnTeam = proposedTeam.includes(playerId || '');
  const isSaboteur = saboteurIds.length > 0;

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handlePropose = () => {
    proposeTeam(selectedPlayers);
    setSelectedPlayers([]);
  };

  const getSprintStatus = (sprint: number) => {
    if (sprint < currentSprint) {
      return goodWins > badWins ? 'success' : 'fail';
    }
    return 'pending';
  };

  const renderLobby = () => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4">Waiting for Players</h2>
      <p className="text-slate-500 mb-4">Share room code: <span className="font-mono font-bold">{roomId}</span></p>
      <div className="mb-4">
        <p className="font-medium">Players ({players.length}/10):</p>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {players.map(p => (
            <Badge key={p.id} variant="outline">{p.name}</Badge>
          ))}
        </div>
      </div>
      {isPO && players.length >= 5 && (
        <Button onClick={() => startGame()}>Start Game</Button>
      )}
      {players.length < 5 && (
        <p className="text-slate-500">Need at least 5 players to start</p>
      )}
    </div>
  );

  const renderPlanning = () => (
    <div>
      <h2 className="text-xl font-bold mb-2">Planning Phase</h2>
      <p className="text-slate-500 mb-4">Current PO: <span className="font-bold">{currentPO?.name}</span></p>

      {isPO ? (
        <div>
          <p className="mb-2">Select team members for Sprint {currentSprint + 1}:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {players.filter(p => p.isAlive).map(p => (
              <Button
                key={p.id}
                variant={selectedPlayers.includes(p.id) ? 'default' : 'outline'}
                size="sm"
                onClick={() => togglePlayer(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
          <Button onClick={handlePropose} disabled={selectedPlayers.length === 0}>
            Propose Team
          </Button>
        </div>
      ) : (
        <p>Waiting for {currentPO?.name} to propose a team...</p>
      )}

      {players.some(p => p.role === 'Project Manager') && !pmOverrideUsed && (
        <div className="mt-4 p-4 bg-amber-100 rounded">
          <p className="text-amber-800">PM can override once!</p>
        </div>
      )}
    </div>
  );

  const renderTeamVoting = () => (
    <div>
      <h2 className="text-xl font-bold mb-2">Team Voting</h2>
      <p className="mb-4">Proposed team:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {proposedTeam.map(id => (
          <Badge key={id} variant="secondary">{getPlayerName(id)}</Badge>
        ))}
      </div>
      <div className="flex gap-4">
        <Button onClick={() => voteTeam('agree')} variant="default">Agree</Button>
        <Button onClick={() => voteTeam('reject')} variant="destructive">Reject</Button>
      </div>
    </div>
  );

  const renderExecution = () => (
    <div>
      <h2 className="text-xl font-bold mb-2">Execution Phase</h2>
      <p className="mb-4">Team members vote:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {proposedTeam.map(id => (
          <Badge key={id} variant={id === playerId ? 'default' : 'outline'}>
            {getPlayerName(id)}
          </Badge>
        ))}
      </div>
      {isOnTeam ? (
        <div className="flex gap-4">
          <Button onClick={() => voteExecution('success')} variant="default">Success</Button>
          {!isGood && <Button onClick={() => voteExecution('fail')} variant="destructive">Fail</Button>}
        </div>
      ) : (
        <p>Waiting for team to vote...</p>
      )}
    </div>
  );

  const renderEnded = () => (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-4">Game Over</h2>
      <p className="text-xl">
        {(goodWins >= 3 && !isSaboteur) || (badWins >= 3 && isSaboteur)
          ? '🎉 Good Guys Win!'
          : '😈 Bad Guys Win!'}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Say Agile One More Time</h1>
          <p className="text-slate-400">Room: {roomId}</p>
        </div>

        {/* Sprint Tracker */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Sprints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {SPRINT_NAMES.map((name, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold
                    ${i < currentSprint ? (goodWins > badWins ? 'bg-green-500' : 'bg-red-500') :
                      i === currentSprint ? 'bg-blue-500' : 'bg-slate-300'}`}>
                    {i + 1}
                  </div>
                  <span className="text-xs mt-1">{name}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-sm">
              <span className="text-green-600">Good Wins: {goodWins}</span>
              <span className="text-red-600">Bad Wins: {badWins}</span>
              <span className="text-amber-600">Delays: {consecutiveDelays}</span>
            </div>
          </CardContent>
        </Card>

        {/* Role Card */}
        {myRole && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Your Role</p>
                  <p className="text-xl font-bold">{myRole}</p>
                </div>
                <Badge variant={isGood ? 'default' : 'destructive'}>
                  {isGood ? 'Good Guy' : 'Bad Guy'}
                </Badge>
              </div>
              {isSaboteur && (
                <p className="text-sm text-slate-500 mt-2">
                  Other saboteurs: {saboteurIds.filter(id => id !== playerId).map(id => getPlayerName(id)).join(', ') || 'None'}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Players */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {players.map(p => (
                <div
                  key={p.id}
                  className={`p-2 rounded text-center ${
                    proposedTeam.includes(p.id) ? 'bg-blue-100 border-2 border-blue-500' : ''
                  } ${!p.isAlive ? 'opacity-50' : ''}`}
                >
                  <p className="font-medium truncate">{p.name}</p>
                  {p.id === currentPO?.id && <Badge size="sm">PO</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Phase Content */}
        <Card>
          <CardContent className="p-6">
            {phase === 'lobby' && renderLobby()}
            {phase === 'planning' && renderPlanning()}
            {phase === 'teamVoting' && renderTeamVoting()}
            {phase === 'execution' && renderExecution()}
            {phase === 'ended' && renderEnded()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
