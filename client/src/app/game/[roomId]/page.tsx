'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoleRevealPopup } from '@/components/RoleRevealPopup';
import { NightZeroOverlay } from '@/components/NightZeroOverlay';
import { SkillFab } from '@/components/SkillFab';
import { SkillResultToast } from '@/components/SkillResultToast';
import { RoleConfigCounter } from '@/components/RoleConfigCounter';
import { MobileDrawer } from '@/components/MobileDrawer';
import { getSprintSize, ROLE_DESCRIPTIONS, type PlayerRole } from '@/lib/types';
import { getAvatarUrl } from '@/lib/utils';

const PHASE_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  nightZero: 'Night Zero',
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
    techDebtActive,
    deadlineSilenced,
    sepSilencedPlayerId,
    isSilenced,
    pmOverrideUsed,
    ttsFollowTargetId,
    proposeTeam,
    voteTeam,
    voteExecution,
    advanceToPlanning,
    saboteurGuess,
    startGame,
    subscribeToRoom,
    unsubscribeFromRoom,
    rejoinRoom,
    hydrateFromCache,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Mount: ensure UUID, hydrate from cache (instant render), then fire rejoin POST.
  useEffect(() => {
    ensurePlayerId();
  }, [ensurePlayerId]);

  useEffect(() => {
    if (roomId && storeRoomId !== roomId) {
      // Instant hydration from sessionStorage — no white flash on reload.
      hydrateFromCache(roomId);
      // Live refresh in background; cache stays visible until response lands.
      rejoinRoom(roomId);
    }
  }, [roomId, storeRoomId, hydrateFromCache, rejoinRoom]);

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
    if (!text || isSilenced) return;
    await sendMessage(text);
    setChatDraft('');
  };

  // ─── Sprint Progress Bar ───
  const renderSprintBar = () => (
    <div className="flex gap-2 w-full h-2">
      {Array.from({ length: 4 }).map((_, i) => {
        if (i < goodWins) return <div key={i} className="flex-1 sprint-good rounded-full" />;
        if (i < goodWins + badWins) return <div key={i} className="flex-1 sprint-bad rounded-full" />;
        if (i === goodWins + badWins && phase !== 'ended')
          return <div key={i} className="flex-1 sprint-current rounded-full" />;
        return <div key={i} className="flex-1 sprint-pending rounded-full" />;
      })}
    </div>
  );

  // ─── Lobby Phase ───
  const renderLobby = () => (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary mb-1">
            LOBBY : BACKLOG
          </h1>
          <p className="text-muted-foreground font-mono text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Đang chờ người chơi... ({players.length}/10)
          </p>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Room: <span className="text-primary">{roomId}</span>
        </div>
      </div>

      <div>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 pb-2 border-b border-border inline-block">
          Dev Team (Players)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {players.map((p) => (
            <div key={p.id} className="glass-panel rounded-lg p-3 sm:p-4 status-strip-villager relative">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-secondary bg-surface-container shrink-0">
                  <img
                    src={getAvatarUrl(p.name)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-foreground truncate w-20 sm:w-24">
                    {p.name}
                  </p>
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
            <div
              key={`empty-${i}`}
              className="glass-panel rounded-lg p-3 sm:p-4 border-dashed border-outline flex flex-col items-center justify-center min-h-[110px] sm:min-h-[140px] opacity-50"
            >
              <span className="material-symbols-outlined text-3xl sm:text-4xl text-outline mb-2">
                person_add
              </span>
              <span className="font-mono text-xs text-outline">Waiting...</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role config — host only when >=5 players */}
      {isPO && players.length >= 5 && (
        <RoleConfigCounter
          onStart={(selected) => {
            if (selected.length === 0) {
              // empty array signals server to use default 60/40 random pool
              startGame();
            } else {
              startGame(selected);
            }
          }}
        />
      )}
      {isPO && players.length < 5 && (
        <p className="text-xs text-muted-foreground text-center italic">
          Cần ít nhất 5 người chơi để bắt đầu.
        </p>
      )}
    </div>
  );

  // ─── Planning Phase ───
  const renderPlanning = () => {
    const requiredSize = getSprintSize(players.length, currentSprint, techDebtActive);

    return (
      <div className="space-y-6">
        {techDebtActive && (
          <div className="glass-panel rounded-xl p-3 border border-error/40 bg-error/5">
            <p className="text-xs text-error font-mono">
              ⚠ Technical Debt: Sprint này phải có {requiredSize} người (cộng thêm +1).
            </p>
          </div>
        )}
        {deadlineSilenced && (
          <div className="glass-panel rounded-xl p-3 border border-error/40 bg-error/5">
            <p className="text-xs text-error font-mono">
              ⚠ Áp lực tối đa: Tất cả thành viên bị cấm thảo luận trong Sprint này.
            </p>
          </div>
        )}
        {sepSilencedPlayerId && (
          <div className="glass-panel rounded-xl p-3 border border-error/40 bg-error/5">
            <p className="text-xs text-error font-mono">
              🔇 {getPlayerName(sepSilencedPlayerId)} đã bị Sếp khó ưa khóa miệng trong Sprint này.
            </p>
          </div>
        )}

        {isPO ? (
          <>
            <div className="glass-panel p-4 sm:p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-l-4 border-l-primary-container">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
                  Bạn là Product Owner
                </h2>
                <p className="text-sm text-muted-foreground">
                  Chọn {requiredSize} người vào nhóm Sprint {currentSprint + 1}. Nhóm cần được biểu
                  quyết duyệt.
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-mono text-xs text-muted-foreground">Đã chọn</span>
                <span className="text-2xl font-bold text-secondary">
                  {selectedPlayers.length} / {requiredSize}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3 ml-2">
                Danh sách team
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {players
                  .filter((p) => p.isAlive)
                  .map((p) => {
                    const isSelected = selectedPlayers.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePlayer(p.id)}
                        className={`glass-panel rounded-lg p-4 flex items-start gap-4 text-left transition-all duration-200 group ${
                          p.id === playerId
                            ? 'status-strip-po'
                            : isSelected
                            ? 'status-strip-nominated border-secondary/50'
                            : 'status-strip-neutral'
                        } ${isSelected ? '' : 'hover:bg-surface-container-high'}`}
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-outline shrink-0 bg-surface-container">
                          <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-sm text-foreground">
                              {p.name}
                              {p.id === playerId ? ' (You)' : ''}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {ttsFollowTargetId === p.id ? '👁 TTS theo sát' : 'Engineer'}
                          </span>
                        </div>
                        <div
                          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-secondary text-secondary-foreground'
                              : 'border border-outline group-hover:border-primary'
                          }`}
                        >
                          {isSelected ? (
                            <span
                              className="material-symbols-outlined text-sm"
                              style={{ fontVariationSettings: 'FILL 1' }}
                            >
                              check
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handlePropose}
                disabled={selectedPlayers.length !== requiredSize}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 px-8 py-3 rounded-lg font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined mr-2">groups</span>
                ĐỀ XUẤT NHÓM
              </Button>
            </div>
            {myRole === 'Project Manager' && !pmOverrideUsed && (
              <p className="text-xs text-muted-foreground italic text-center">
                💡 Bạn là PM — có thể dùng nút FAB &ldquo;PM Override&rdquo; góc dưới phải để chiếm quyền chỉ định.
              </p>
            )}
          </>
        ) : (
          <div className="glass-panel rounded-xl p-6 sm:p-8 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-container-high mx-auto mb-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary">
                hourglass_empty
              </span>
            </div>
            <p className="text-base sm:text-lg font-semibold text-foreground mb-2">
              Chờ {currentPO?.name} đề xuất nhóm...
            </p>
            <p className="text-sm text-muted-foreground">
              Planning Sprint {currentSprint + 1}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ─── TeamVoting Phase ───
  const renderTeamVoting = () => {
    const meVoted = !!useGameStore.getState().players.find((p) => p.id === playerId);
    void meVoted;
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-xl p-4 sm:p-6 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Biểu quyết duyệt nhóm</h2>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            {currentPO?.name} đề xuất nhóm cho Sprint {currentSprint + 1}:
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-6">
            {proposedTeam.map((id) => (
              <div
                key={id}
                className="glass-panel rounded-lg px-3 py-2 flex items-center gap-2 status-strip-nominated"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-secondary bg-surface-container">
                  <img
                    src={getAvatarUrl(getPlayerName(id))}
                    alt={getPlayerName(id)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-semibold text-xs sm:text-sm">{getPlayerName(id)}</span>
              </div>
            ))}
          </div>
          {isSilenced ? (
            <p className="text-sm text-error italic">
              Bạn bị cấm biểu quyết trong Sprint này.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">Bỏ phiếu của bạn:</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => voteTeam('agree')}
                  className="px-8 py-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)]"
                >
                  <span className="material-symbols-outlined mr-2">thumb_up</span>
                  ĐỒNG Ý
                </Button>
                <Button
                  onClick={() => voteTeam('reject')}
                  className="px-8 py-4 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
                >
                  <span className="material-symbols-outlined mr-2">thumb_down</span>
                  TỪ CHỐI
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ─── Execution Phase ───
  const renderExecution = () => (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-4 sm:p-6">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Thực thi Sprint</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Nhóm bỏ phiếu kín về kết quả Sprint
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-6">
          {proposedTeam.map((id) => {
            const isMe = id === playerId;
            return (
              <div
                key={id}
                className={`glass-panel rounded-lg px-3 py-2 flex items-center gap-2 ${
                  isMe ? 'status-strip-nominated border-secondary/50' : 'status-strip-villager'
                }`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-outline bg-surface-container">
                  <img
                    src={getAvatarUrl(getPlayerName(id))}
                    alt={getPlayerName(id)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-semibold text-xs sm:text-sm">{getPlayerName(id)}</span>
                {isMe && <span className="text-[10px] text-secondary font-mono ml-1">(You)</span>}
              </div>
            );
          })}
        </div>

        {isOnTeam ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">Bỏ phiếu của bạn:</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => voteExecution('success')}
                className="px-8 py-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide shadow-[0_0_15px_rgba(74,225,118,0.2)]"
              >
                <span className="material-symbols-outlined mr-2">check_circle</span>
                HOÀN THÀNH
              </Button>
              {!isGood && (
                <Button
                  onClick={() => voteExecution('fail')}
                  className="px-8 py-4 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
                >
                  <span className="material-symbols-outlined mr-2">local_fire_department</span>
                  CHÁY DEADLINE
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <span className="material-symbols-outlined text-3xl text-muted-foreground mb-2 block">
              hourglass_empty
            </span>
            <p className="text-muted-foreground">Chờ nhóm bỏ phiếu...</p>
          </div>
        )}
      </div>
    </div>
  );

  // ─── SprintResult Phase ───
  const renderSprintResult = () => {
    // currentSprint was incremented already; sprint just completed is currentSprint - 1.
    const justFinished = currentSprint - 1;
    const sprintLabel = `Sprint ${Math.max(1, justFinished + 1)}`;
    // Detect outcome by comparing wins delta: cannot determine from state alone reliably,
    // but display latest counts.
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-xl p-6 sm:p-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-container mx-auto mb-4 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-3xl sm:text-4xl text-primary"
              style={{ fontVariationSettings: 'FILL 1' }}
            >
              fact_check
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            {sprintLabel} đã hoàn tất
          </h2>
          <p className="text-muted-foreground font-mono text-sm mb-2">
            Tỉ số: <span className="text-secondary">Tốt {goodWins}</span> /{' '}
            <span className="text-error">Xấu {badWins}</span>
          </p>
          {myRole === 'Quality Controller' && (
            <p className="text-xs text-muted-foreground italic mt-2">
              💡 Bạn là QC — có thể dùng nút FAB &ldquo;QC Redo&rdquo; để yêu cầu làm lại Sprint này.
            </p>
          )}
          <Button onClick={advanceToPlanning} className="mt-4 px-6 py-3">
            <span className="material-symbols-outlined mr-2">arrow_forward</span>
            Tiếp tục Sprint kế tiếp
          </Button>
        </div>
      </div>
    );
  };

  // ─── Ended Phase ───
  const renderEnded = () => (
    <div className="space-y-6">
      <div
        className={`rounded-xl p-6 sm:p-8 text-center ${
          badWins >= 2 ? 'glow-red' : 'glow-green'
        } glass-panel`}
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
          {badWins >= 2 ? (
            <span
              className="material-symbols-outlined text-4xl sm:text-5xl text-error"
              style={{ fontVariationSettings: 'FILL 1' }}
            >
              dangerous
            </span>
          ) : (
            <span
              className="material-symbols-outlined text-4xl sm:text-5xl text-secondary"
              style={{ fontVariationSettings: 'FILL 1' }}
            >
              emoji_events
            </span>
          )}
        </div>
        <h1
          className={`text-3xl sm:text-4xl font-bold mb-3 tracking-tight ${
            badWins >= 2 ? 'text-error' : 'text-secondary'
          }`}
        >
          {badWins >= 2 ? 'PHE PHÁ DỰ ÁN THẮNG!' : 'SCRUM TEAM THẮNG!'}
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          {badWins >= 2 ? 'Dự án thất bại.' : 'Dự án được release thành công.'}
        </p>
      </div>

      {/* Saboteur guess UI — only when good has 3 wins (final flip chance) */}
      {goodWins >= 3 && badWins < 2 && isSaboteur && (
        <div className="glass-panel rounded-xl p-4 sm:p-6 text-center glow-red">
          <h3 className="text-base sm:text-lg font-bold text-error mb-2 uppercase tracking-wide">
            Vòng lật kèo: Chỉ điểm Scrum Master
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-6">
            Đoán đúng Scrum Master → phe xấu lật kèo thắng. Đoán sai → Scrum Team chính thức thắng.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {players
              .filter((p) => p.isAlive && p.id !== playerId)
              .map((p) => (
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

      <div className="glass-panel rounded-xl p-4 sm:p-6">
        <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-4">
          Role Reveal
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {players.map((p) => {
            const role = (p.role as PlayerRole) || 'Developer';
            const good = ![
              'Người trễ task',
              'Client',
              'Ông sếp khó ưa',
              'Kẻ fake CV',
              'QC cẩu thả',
              'Deadline',
              'Technical Debt',
            ].includes(role);
            return (
              <div
                key={p.id}
                className={`rounded-lg p-3 text-center ${
                  good ? 'status-strip-villager' : 'status-strip-werewolf'
                }`}
                style={{ backgroundColor: 'rgba(30,41,59,0.4)' }}
              >
                <div className="w-12 h-12 rounded-full mx-auto mb-2 overflow-hidden border border-outline bg-surface-container">
                  <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-semibold truncate">{p.name}</p>
                <p className={`text-[10px] font-mono mt-1 ${good ? 'text-secondary' : 'text-error'}`}>
                  {role}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Sidebar nav content (used in left desktop sidebar + mobile menu drawer) ───
  const renderSidebarBody = () => (
    <>
      <div className="p-4 sm:p-6 border-b border-outline-variant">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary bg-surface-container shrink-0">
            <img
              src={getAvatarUrl(playerName || 'Player')}
              alt={playerName || ''}
              className="w-full h-full object-cover"
            />
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
            {isSilenced && (
              <Badge variant="outline" className="text-xs border-error/40 text-error font-mono ml-2">
                🔇 Silenced
              </Badge>
            )}
          </div>
        )}
        {myRole && ROLE_DESCRIPTIONS[myRole as PlayerRole] && (
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            {ROLE_DESCRIPTIONS[myRole as PlayerRole]}
          </p>
        )}
      </div>

      <div className="p-4 sm:p-6 border-b border-outline-variant space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Good Wins
          </span>
          <span className="font-bold text-secondary">{goodWins}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Bad Wins
          </span>
          <span className="font-bold text-error">{badWins}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Delays
          </span>
          <span className="font-bold text-muted-foreground">{consecutiveDelays}</span>
        </div>
      </div>

      <div className="p-4 sm:p-6 border-b border-outline-variant">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2 block">
          Sprint Progress
        </span>
        {renderSprintBar()}
        <div className="flex justify-between mt-2">
          <span className="text-xs text-secondary font-mono">Good {goodWins}/3</span>
          <span className="text-xs text-error font-mono">Bad {badWins}/2</span>
        </div>
      </div>
    </>
  );

  // ─── Chat body (used in right desktop sidebar + mobile chat drawer) ───
  const renderChatBody = () => (
    <>
      <div className="flex border-b border-outline-variant shrink-0">
        <button
          onClick={() => setChatTab('chat')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-mono uppercase tracking-wider transition-colors ${
            chatTab === 'chat'
              ? 'text-secondary border-b-2 border-secondary bg-secondary/10'
              : 'text-muted-foreground hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-lg">forum</span>
          Chat
        </button>
        <button
          onClick={() => setChatTab('logs')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-mono uppercase tracking-wider transition-colors ${
            chatTab === 'logs'
              ? 'text-secondary border-b-2 border-secondary bg-secondary/10'
              : 'text-muted-foreground hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-lg">history</span>
          Logs
        </button>
      </div>

      {chatTab === 'chat' ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center italic mt-8">No messages yet</p>
            )}
            {messages.map((m) => {
              const isSelf = m.player_name === playerName;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-1 ${isSelf ? 'items-end' : 'items-start'}`}
                >
                  <span
                    className={`text-[11px] font-mono ${
                      isSelf ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {m.player_name} ·{' '}
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                      isSelf
                        ? 'bg-primary-container text-primary-foreground rounded-br-none'
                        : 'bg-surface-container-high text-foreground rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 sm:p-4 border-t border-outline-variant shrink-0">
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
                placeholder={isSilenced ? 'Bạn bị cấm thảo luận...' : 'Gửi tin nhắn...'}
                maxLength={500}
                disabled={isSilenced}
                className="w-full bg-surface-container border border-outline rounded-lg py-2 pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendChat}
                disabled={isSilenced}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 disabled:opacity-40"
                aria-label="Send"
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
    </>
  );

  const isVotingPhase = phase === 'teamVoting' || phase === 'execution';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {showRoleReveal && <RoleRevealPopup />}
      <NightZeroOverlay />
      <SkillResultToast />

      {/* ─── TopNavBar ─── */}
      <nav className="h-14 sm:h-16 shrink-0 bg-surface-dim/80 backdrop-blur-xl border-b border-outline-variant flex justify-between items-center px-3 sm:px-6 z-30 gap-2">
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden p-2 rounded-lg hover:bg-surface-container-high text-muted-foreground"
          aria-label="Menu"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <span className="font-bold tracking-tight text-primary text-sm sm:text-lg truncate">
            AGILE WEREWOLF
          </span>
          <div className="hidden md:flex items-center gap-6 ml-6">
            <span className="text-muted-foreground font-mono text-sm">Room: {roomId}</span>
            <span className="text-secondary font-bold font-mono text-sm">
              Sprint {currentSprint + 1}/4
            </span>
            <span className="text-muted-foreground font-mono text-sm">
              Delays: {consecutiveDelays}/4
            </span>
          </div>
          {/* Mobile compact stats */}
          <div className="md:hidden flex items-center gap-2 text-xs font-mono">
            <span className="text-secondary">S{currentSprint + 1}/4</span>
            <span className="text-muted-foreground">D{consecutiveDelays}/4</span>
          </div>
        </div>

        <button
          onClick={() => setChatOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-surface-container-high text-muted-foreground relative"
          aria-label="Chat"
        >
          <span className="material-symbols-outlined text-xl">forum</span>
          {messages.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ─── Left desktop sidebar ─── */}
        <aside className="hidden md:flex flex-col w-72 lg:w-80 shrink-0 h-full overflow-hidden bg-surface-container-low/60 backdrop-blur-lg border-r border-outline-variant z-20">
          {renderSidebarBody()}
        </aside>

        {/* ─── Main canvas ─── */}
        <main className="flex-1 overflow-y-auto relative p-3 sm:p-6 z-10">
          {phase && phase !== 'ended' && phase !== 'nightZero' && (
            <div className="mb-4 sm:mb-6 max-w-2xl mx-auto">{renderSprintBar()}</div>
          )}

          <div className="max-w-4xl mx-auto pb-32">
            {phase === 'lobby' && renderLobby()}
            {phase === 'planning' && renderPlanning()}
            {phase === 'teamVoting' && renderTeamVoting()}
            {phase === 'execution' && renderExecution()}
            {phase === 'sprintResult' && renderSprintResult()}
            {phase === 'ended' && renderEnded()}
            {phase === 'nightZero' && (
              <div className="glass-panel rounded-xl p-6 sm:p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-primary mb-3 block">
                  bedtime
                </span>
                <p className="text-muted-foreground">Giờ Tan Ca Đầu Tiên...</p>
              </div>
            )}
            {!phase && (
              <div className="glass-panel rounded-xl p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-muted-foreground mb-4 block animate-spin">
                  progress_activity
                </span>
                <p className="text-muted-foreground">Đang kết nối phòng...</p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Nếu bị treo quá lâu, hãy{' '}
                  <Link href="/" className="text-primary underline">
                    về trang chủ
                  </Link>{' '}
                  và join lại.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* ─── Right desktop chat sidebar ─── */}
        <aside className="hidden lg:flex flex-col w-80 shrink-0 h-full overflow-hidden bg-surface-container-low/60 backdrop-blur-lg border-l border-outline-variant z-20">
          {renderChatBody()}
        </aside>
      </div>

      {/* ─── Mobile drawers ─── */}
      <MobileDrawer open={menuOpen} onOpenChange={setMenuOpen} side="left" title="Menu">
        {renderSidebarBody()}
      </MobileDrawer>
      <MobileDrawer open={chatOpen} onOpenChange={setChatOpen} side="bottom" title="Chat">
        <div className="flex flex-col h-[70vh]">{renderChatBody()}</div>
      </MobileDrawer>

      {/* ─── Floating skill buttons ─── */}
      <SkillFab />

      {/* ─── Bottom voting bar ─── */}
      {isVotingPhase && (
        <div className="shrink-0 bg-surface-container-low/90 backdrop-blur-xl border-t border-outline-variant p-3 sm:p-4 z-30">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-mono hidden sm:block">
              {phase === 'teamVoting'
                ? 'Bỏ phiếu duyệt nhóm...'
                : 'Bỏ phiếu kín kết quả Sprint...'}
            </span>
            {!isSilenced && (
              <div className="flex gap-2 sm:gap-3 justify-stretch sm:justify-end">
                {phase === 'teamVoting' ? (
                  <>
                    <Button
                      onClick={() => voteTeam('agree')}
                      className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide"
                    >
                      <span className="material-symbols-outlined mr-1 sm:mr-2">thumb_up</span>
                      DUYỆT
                    </Button>
                    <Button
                      onClick={() => voteTeam('reject')}
                      className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
                    >
                      <span className="material-symbols-outlined mr-1 sm:mr-2">thumb_down</span>
                      TỪ CHỐI
                    </Button>
                  </>
                ) : (
                  isOnTeam && (
                    <>
                      <Button
                        onClick={() => voteExecution('success')}
                        className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold tracking-wide"
                      >
                        <span className="material-symbols-outlined mr-1 sm:mr-2">check_circle</span>
                        HOÀN THÀNH
                      </Button>
                      {!isGood && (
                        <Button
                          onClick={() => voteExecution('fail')}
                          className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 rounded-lg border border-error text-error hover:bg-error/10 font-semibold tracking-wide"
                        >
                          <span className="material-symbols-outlined mr-1 sm:mr-2">
                            local_fire_department
                          </span>
                          CHÁY DEADLINE
                        </Button>
                      )}
                    </>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
