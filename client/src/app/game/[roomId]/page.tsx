'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatPanel } from '@/components/ChatPanel';
import { RoleRevealPopup } from '@/components/RoleRevealPopup';
import { getSprintSize, ROLES, ROLE_DESCRIPTIONS } from '@/lib/types';
import { getAvatarUrl } from '@/lib/utils';

const SPRINT_NAMES = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'];

const PHASE_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  planning: 'Sprint Planning',
  teamVoting: 'Team Voting',
  execution: 'Sprint Execution',
  sprintResult: 'Sprint Result',
  ended: 'Game Over',
};

export default function GamePage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const {
    players,
    phase,
    currentSprint,
    proposedTeam,
    currentPO,
    myRole,
    isGood,
    saboteurIds,
    goodWins,
    badWins,
    consecutiveDelays,
    proposeTeam,
    voteTeam,
    voteExecution,
    saboteurGuess,
    startGame,
    subscribeToRoom,
    unsubscribeFromRoom,
    rejoinRoom,
    ensurePlayerId,
    playerId,
    roomId: storeRoomId,
    playerName,
    messages,
    sendMessage,
    showRoleReveal,
  } = useGameStore();

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [chatTab, setChatTab] = useState<'chat' | 'logs'>('chat');
  const [chatDraft, setChatDraft] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensurePlayerId();
  }, [ensurePlayerId]);

  useEffect(() => {
    if (roomId && storeRoomId !== roomId) {
      rejoinRoom(roomId);
    }
  }, [roomId, storeRoomId, rejoinRoom]);

  useEffect(() => {
    if (storeRoomId) {
      subscribeToRoom();
      return () => unsubscribeFromRoom();
    }
  }, [storeRoomId, subscribeToRoom, unsubscribeFromRoom]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const isPO = currentPO?.id === playerId;
  const isOnTeam = proposedTeam.includes(playerId || '');
  const isSaboteur = saboteurIds.length > 0 || myRole === 'Người trễ task';
  const isCurrentPO = currentPO?.id === playerId;

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name || 'Unknown';

  const togglePlayer = (pid: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const handlePropose = () => {
    proposeTeam(selectedPlayers);
    setSelectedPlayers([]);
  };

  const handleSendChat = async () => {
    const text = chatDraft.trim();
    if (!text) return;
    await sendMessage(text);
    setChatDraft('');
  };

  // ─── Sprint Progress Bar ───
  const renderSprintBar = () => (
    <div className="flex gap-2 w-full h-2">
      {Array.from({ length: 4 }).map((_, i) => {
        if (i < goodWins) return <div key={i} className="flex-1 sprint-good rounded-full" />;
        if (i < goodWins + badWins) return <div key={i} className="flex-1 sprint-bad rounded-full" />;
        if (i === goodWins + badWins && phase !== 'ended') return <div key={i} className="flex-1 sprint-current rounded-full" />;
        return <div key={i} className="flex-1 sprint-pending rounded-full" />;
      })}
    </div>
  );

  // ─── Lobby Phase ───
  const renderLobby = () => (
    <div className="space-y-6">
      {/* Phase header */}
      <div className="glass-panel rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary mb-1">LOBBY : BACKLOG</h1>
          <p className="text-muted-foreground font-mono text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Waiting for players... ({players.length}/10)
          </p>
        </div>
        {isPO && players.length >= 5 && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {selectedRoles.length === players.length ? (
              <Button
                onClick={() => startGame(selectedRoles)}
                className="bg-primary-container text-primary-foreground hover:bg-primary/80 px-8 py-4 rounded-lg font-semibold tracking-wide shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] border border-primary/50"
              >
                <span className="material-symbols-outlined mr-2">play_arrow</span>
                START SPRINT 1
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground font-mono">
                {selectedRoles.length}/{players.length} roles selected
              </span>
            )}
          </div>
        )}
      </div>

      {/* Player grid */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border inline-block">
          Dev Team (Players)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {players.map((p) => (
            <div key={p.id} className="glass-panel rounded-lg p-4 status-strip-villager relative">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-secondary bg-surface-container shrink-0">
                  <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-foreground truncate w-24">{p.name}</p>
                  {p.id === currentPO?.id ? (
                    <span className="font-mono text-[10px] text-primary tracking-wider">HOST</span>
                  ) : (
                    <span className="font-mono text-[10px] text-secondary tracking-wider">READY</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 10 - players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="glass-panel rounded-lg p-4 border-dashed border-outline flex flex-col items-center justify-center min-h-[140px] opacity-50">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">person_add</span>
              <span className="font-mono text-xs text-outline">Waiting...</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role selection for PO */}
      {isPO && players.length >= 5 && (
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Select Roles for This Game
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...ROLES.GOOD, ...ROLES.BAD].map((role) => {
              const isSelected = selectedRoles.includes(role);
              const isGood = ROLES.GOOD.includes(role);
              return (
                <button
                  key={role}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedRoles(selectedRoles.filter(r => r !== role));
                    } else if (selectedRoles.length < players.length) {
                      setSelectedRoles([...selectedRoles, role]);
                    }
                  }}
                  disabled={!isSelected && selectedRoles.length >= players.length}
                  className={`px-3 py-2 rounded-lg text-sm font-mono transition-all border ${
                    isSelected
                      ? isGood
                        ? 'bg-secondary/20 border-secondary text-secondary'
                        : 'bg-error/20 border-error text-error'
                      : 'bg-surface-container-high border-outline hover:border-primary/50 text-muted-foreground'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {role}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Select exactly {players.length} roles (60% good, 40% bad recommended)
          </p>
        </div>
      )}
    </div>
  );

  // ─── Planning Phase ───
  const renderPlanning = () => {
    const requiredSize = getSprintSize(players.length, currentSprint);

    return (
      <div className="space-y-6">
        {isPO ? (
          <>
            {/* PO Context */}
            <div className="glass-panel p-6 rounded-xl flex items-center justify-between border-l-4 border-l-primary-container">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">You are the Product Owner</h2>
                <p className="text-sm text-muted-foreground">
                  Nominate {requiredSize} developers for Sprint {currentSprint + 1}. The team must approve your plan.
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0 ml-4">
                <span className="font-mono text-xs text-muted-foreground">Required Devs</span>
                <span className="text-2xl font-bold text-secondary">{selectedPlayers.length} / {requiredSize}</span>
              </div>
            </div>

            {/* Team nomination grid */}
            <div>
              <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4 ml-2">
                Available Roster
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {players.filter(p => p.isAlive).map((p) => {
                  const isSelected = selectedPlayers.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlayer(p.id)}
                      className={`
                        glass-panel rounded-lg p-4 flex items-start gap-4 text-left transition-all duration-200 group
                        ${p.id === playerId ? 'status-strip-po' : isSelected ? 'status-strip-nominated border-secondary/50' : 'status-strip-neutral'}
                        ${isSelected ? '' : 'hover:bg-surface-container-high'}
                      `}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-outline shrink-0 bg-surface-container">
                        <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-semibold text-sm group-hover:text-primary transition-colors ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                            {p.name}{p.id === playerId ? ' (You)' : ''}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">Engineer</span>
                      </div>
                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-secondary text-secondary-foreground' : 'border border-outline group-hover:border-primary'}`}>
                        {isSelected ? (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: 'FILL 1' }}>check</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Propose button */}
            <div className="flex justify-end">
              <Button
                onClick={handlePropose}
                disabled={selectedPlayers.length !== requiredSize}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 px-8 py-3 rounded-lg font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined mr-2">groups</span>
                PROPOSE TEAM
              </Button>
            </div>
          </>
        ) : (
          <div className="glass-panel rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container-high mx-auto mb-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary">hourglass_empty</span>
            </div>
            <p className="text-lg font-semibold text-foreground mb-2">
              Waiting for {currentPO?.name} to propose a team...
            </p>
            <p className="text-sm text-muted-foreground">
              Sprint {currentSprint + 1} planning in progress
            </p>
          </div>
        )}
      </div>
    );
  };

  // ─── TeamVoting Phase ───
  const renderTeamVoting = () => (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-6 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Team Voting</h2>
        <p className="text-muted-foreground mb-6">
          {currentPO?.name} proposed the following team for Sprint {currentSprint + 1}:
        </p>
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {proposedTeam.map((id) => (
            <div key={id} className="glass-panel rounded-lg px-4 py-3 flex items-center gap-2 status-strip-nominated">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-secondary bg-surface-container">
                <img src={getAvatarUrl(getPlayerName(id))} alt={getPlayerName(id)} className="w-full h-full object-cover" />
              </div>
              <span className="font-semibold text-sm">{getPlayerName(id)}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mb-4">Cast your vote:</p>
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => voteTeam('agree')}
            className="px-8 py-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)]"
          >
            <span className="material-symbols-outlined mr-2">check</span>
            APPROVE
          </Button>
          <Button
            onClick={() => voteTeam('reject')}
            className="px-8 py-4 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
          >
            <span className="material-symbols-outlined mr-2">close</span>
            REJECT
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Execution Phase ───
  const renderExecution = () => (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Sprint Execution</h2>
          <p className="text-muted-foreground">
            Team members vote on sprint outcome
          </p>
        </div>

        {/* Team display */}
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {proposedTeam.map((id) => {
            const isMe = id === playerId;
            return (
              <div
                key={id}
                className={`glass-panel rounded-lg px-4 py-3 flex items-center gap-2 ${isMe ? 'status-strip-nominated border-secondary/50' : 'status-strip-villager'}`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-outline bg-surface-container">
                  <img src={getAvatarUrl(getPlayerName(id))} alt={getPlayerName(id)} className="w-full h-full object-cover" />
                </div>
                <span className="font-semibold text-sm">{getPlayerName(id)}</span>
                {isMe && <span className="text-xs text-secondary font-mono ml-1">(You)</span>}
              </div>
            );
          })}
        </div>

        {/* Voting */}
        {isOnTeam ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">Cast your vote:</p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => voteExecution('success')}
                className="px-8 py-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)]"
              >
                <span className="material-symbols-outlined mr-2">check_circle</span>
                SUCCESS
              </Button>
              {!isGood && (
                <Button
                  onClick={() => voteExecution('fail')}
                  className="px-8 py-4 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
                >
                  <span className="material-symbols-outlined mr-2">bug_report</span>
                  FAIL
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <span className="material-symbols-outlined text-3xl text-muted-foreground mb-2 block">hourglass_empty</span>
            <p className="text-muted-foreground">Waiting for team to vote...</p>
          </div>
        )}
      </div>
    </div>
  );

  // ─── SprintResult Phase ───
  const renderSprintResult = () => (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-surface-container mx-auto mb-6 flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: 'FILL 1' }}>autorenew</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Sprint Complete</h2>
        <p className="text-muted-foreground font-mono">
          {goodWins > badWins ? 'Good team ahead!' : badWins > goodWins ? 'Bad team ahead!' : 'Tied!'}
          {' '}Next sprint starting...
        </p>
      </div>
    </div>
  );

  // ─── Ended Phase ───
  const renderEnded = () => (
    <div className="space-y-6">
      {/* Win banner */}
      <div className={`rounded-xl p-8 text-center ${badWins >= 2 ? 'glow-red' : 'glow-green'} glass-panel`}>
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center">
          {badWins >= 2 ? (
            <span className="material-symbols-outlined text-5xl text-error" style={{ fontVariationSettings: 'FILL 1' }}>dangerous</span>
          ) : (
            <span className="material-symbols-outlined text-5xl text-secondary" style={{ fontVariationSettings: 'FILL 1' }}>emoji_events</span>
          )}
        </div>
        <h1 className={`text-4xl font-bold mb-3 tracking-tight ${badWins >= 2 ? 'text-error' : 'text-secondary'}`}>
          {badWins >= 2 ? 'BAD GUYS WIN!' : 'GOOD GUYS WIN!'}
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          {badWins >= 2
            ? 'The saboteurs have prevailed.'
            : 'The team completed 2 sprints successfully.'}
        </p>
      </div>

      {/* Saboteur guess */}
      {goodWins >= 2 && isSaboteur && (
        <div className="glass-panel rounded-xl p-6 text-center glow-red">
          <h3 className="text-lg font-bold text-error mb-2 uppercase tracking-wide">Saboteur Round</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Guess the Scrum Master. Correct = Bad wins.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {players.filter(p => p.isAlive).map((p) => (
              <button
                key={p.id}
                onClick={() => saboteurGuess(p.id)}
                className="glass-panel rounded-lg p-3 hover:bg-surface-container-high transition-colors flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border border-error/50 bg-surface-container">
                  <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-semibold">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Role reveal */}
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-4">Role Reveal</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {players.map((p) => {
            const role = p.role || 'Unknown';
            const good = !['Người trễ task', 'QC cẩu thả'].includes(role);
            return (
              <div key={p.id} className={`rounded-lg p-3 text-center ${good ? 'status-strip-villager' : 'status-strip-werewolf'}`} style={{ backgroundColor: 'rgba(30,41,59,0.4)' }}>
                <div className="w-12 h-12 rounded-full mx-auto mb-2 overflow-hidden border border-outline bg-surface-container">
                  <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-semibold truncate">{p.name}</p>
                <p className={`text-[10px] font-mono mt-1 ${good ? 'text-secondary' : 'text-error'}`}>{role}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const isVotingPhase = phase === 'teamVoting' || phase === 'execution';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Role reveal popup */}
      {showRoleReveal && <RoleRevealPopup />}

      {/* ─── TopNavBar ─── */}
      <nav className="h-16 shrink-0 bg-surface-dim/80 backdrop-blur-xl border-b border-outline-variant flex justify-between items-center px-6 z-50">
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-tight text-primary text-lg">AGILE WEREWOLF</span>
          <div className="hidden md:flex items-center gap-6 ml-6">
            <span className="text-muted-foreground font-mono text-sm">Room ID: {roomId}</span>
            <span className="text-secondary font-bold font-mono text-sm">Sprint {currentSprint + 1}/4</span>
            <span className="text-muted-foreground font-mono text-sm">Rejects: {consecutiveDelays}/4</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-surface-container-high text-muted-foreground hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
          <button className="p-2 rounded-full hover:bg-surface-container-high text-muted-foreground hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-xl">help</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ─── Left SideNav ─── */}
        <aside className="hidden md:flex flex-col w-80 shrink-0 h-full overflow-hidden bg-surface-container-low/60 backdrop-blur-lg border-r border-outline-variant z-40">
          {/* User info */}
          <div className="p-6 border-b border-outline-variant">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary bg-surface-container shrink-0">
                <img src={getAvatarUrl(playerName || 'Player')} alt={playerName || ''} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">{playerName}</div>
                {myRole && (
                  <span className={`text-xs font-mono ${isGood ? 'text-secondary' : 'text-error'}`}>
                    {myRole}
                  </span>
                )}
              </div>
            </div>
            {phase && phase !== 'ended' && (
              <div className="mt-3">
                <Badge variant="outline" className="text-xs border-primary/40 text-primary font-mono">
                  {PHASE_LABELS[phase] || phase}
                </Badge>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="p-6 border-b border-outline-variant space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Good Wins</span>
              <span className="font-bold text-secondary">{goodWins}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Bad Wins</span>
              <span className="font-bold text-error">{badWins}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Delays</span>
              <span className="font-bold text-muted-foreground">{consecutiveDelays}</span>
            </div>
          </div>

          {/* Sprint bar */}
          <div className="p-6 border-b border-outline-variant">
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2 block">Sprint Progress</span>
            {renderSprintBar()}
            <div className="flex justify-between mt-2">
              <span className="text-xs text-secondary font-mono">Good {goodWins}/2</span>
              <span className="text-xs text-error font-mono">Bad {badWins}/2</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 py-4">
            <button className="flex items-center gap-4 px-6 py-3 w-full text-secondary border-l-2 border-secondary bg-secondary/10 transition-colors font-mono text-xs tracking-wider uppercase">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: 'FILL 1' }}>dashboard</span>
              Board
            </button>
            <button
              onClick={() => setChatTab('chat')}
              className={`flex items-center gap-4 px-6 py-3 w-full transition-colors font-mono text-xs tracking-wider uppercase ${chatTab === 'chat' ? 'text-secondary border-l-2 border-secondary bg-secondary/10' : 'text-muted-foreground hover:text-foreground hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-xl">forum</span>
              Chat
            </button>
            <button
              onClick={() => setChatTab('logs')}
              className={`flex items-center gap-4 px-6 py-3 w-full transition-colors font-mono text-xs tracking-wider uppercase ${chatTab === 'logs' ? 'text-secondary border-l-2 border-secondary bg-secondary/10' : 'text-muted-foreground hover:text-foreground hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-xl">history</span>
              Logs
            </button>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-outline-variant space-y-1">
            <button className="flex items-center gap-3 px-4 py-2 w-full text-muted-foreground hover:text-foreground hover:bg-surface-container-high transition-colors rounded-lg text-sm font-mono">
              <span className="material-symbols-outlined text-xl">account_circle</span>
              Profile
            </button>
            <button className="flex items-center gap-3 px-4 py-2 w-full text-error hover:bg-error/10 transition-colors rounded-lg text-sm font-mono">
              <span className="material-symbols-outlined text-xl">logout</span>
              Leave
            </button>
          </div>
        </aside>

        {/* ─── Main Canvas ─── */}
        <main className="flex-1 overflow-y-auto relative p-6 z-10">
          {/* Sprint progress at top */}
          {phase && phase !== 'ended' && (
            <div className="mb-6 max-w-2xl mx-auto">
              {renderSprintBar()}
            </div>
          )}

          {/* Phase content */}
          <div className="max-w-4xl mx-auto">
            {phase === 'lobby' && renderLobby()}
            {phase === 'planning' && renderPlanning()}
            {phase === 'teamVoting' && renderTeamVoting()}
            {phase === 'execution' && renderExecution()}
            {phase === 'sprintResult' && renderSprintResult()}
            {phase === 'ended' && renderEnded()}
            {!phase && (
              <div className="glass-panel rounded-xl p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-muted-foreground mb-4 block animate-spin">progress_activity</span>
                <p className="text-muted-foreground">Connecting to room...</p>
              </div>
            )}
          </div>
        </main>

        {/* ─── Right Sidebar (Chat) ─── */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 h-full overflow-hidden bg-surface-container-low/60 backdrop-blur-lg border-l border-outline-variant z-40">
          {/* Chat tabs */}
          <div className="flex border-b border-outline-variant shrink-0">
            <button
              onClick={() => setChatTab('chat')}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-mono uppercase tracking-wider transition-colors ${chatTab === 'chat' ? 'text-secondary border-b-2 border-secondary bg-secondary/10' : 'text-muted-foreground hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-lg">forum</span>
              Chat
            </button>
            <button
              onClick={() => setChatTab('logs')}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-mono uppercase tracking-wider transition-colors ${chatTab === 'logs' ? 'text-secondary border-b-2 border-secondary bg-secondary/10' : 'text-muted-foreground hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-lg">history</span>
              Logs
            </button>
          </div>

          {/* Chat content */}
          {chatTab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center italic mt-8">No messages yet</p>
                )}
                {messages.map((m) => {
                  const isSelf = m.player_name === playerName;
                  return (
                    <div key={m.id} className={`flex flex-col gap-1 ${isSelf ? 'items-end' : 'items-start'}`}>
                      <span className={`text-[11px] font-mono ${isSelf ? 'text-primary' : 'text-muted-foreground'}`}>
                        {m.player_name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                        isSelf
                          ? 'bg-primary-container text-primary-foreground rounded-br-none'
                          : 'bg-surface-container-high text-foreground rounded-bl-none'
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div className="p-4 border-t border-outline-variant shrink-0">
                <div className="relative">
                  <input
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder="Send message..."
                    maxLength={500}
                    className="w-full bg-surface-container border border-outline rounded-lg py-2 pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleSendChat}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">send</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs text-muted-foreground text-center font-mono mt-4">
                Game logs will appear here during active gameplay.
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ─── Bottom Action Bar (for voting phases) ─── */}
      {isVotingPhase && (
        <div className="shrink-0 bg-surface-container-low/90 backdrop-blur-xl border-t border-outline-variant p-4 z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground font-mono hidden sm:block">
              {phase === 'teamVoting' ? 'Cast your vote on the proposed team...' : 'Team: vote on sprint outcome...'}
            </span>
            <div className="flex gap-3">
              {phase === 'teamVoting' ? (
                <>
                  <Button
                    onClick={() => voteTeam('agree')}
                    className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)]"
                  >
                    <span className="material-symbols-outlined mr-2">check</span>
                    APPROVE
                  </Button>
                  <Button
                    onClick={() => voteTeam('reject')}
                    className="px-6 py-3 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
                  >
                    <span className="material-symbols-outlined mr-2">close</span>
                    REJECT
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => voteExecution('success')}
                    className="px-6 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)]"
                  >
                    <span className="material-symbols-outlined mr-2">check_circle</span>
                    SUCCESS
                  </Button>
                  {isOnTeam && !isGood && (
                    <Button
                      onClick={() => voteExecution('fail')}
                      className="px-6 py-3 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
                    >
                      <span className="material-symbols-outlined mr-2">bug_report</span>
                      FAIL
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
