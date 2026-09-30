'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useGameStore, type LobbyPublicState, type RoomMessage } from '@/store/gameStore';
import type { GameEvent, GamePhase, PublicGameState } from '@/game/types';
import { factionForRole } from '@/game/presets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LobbyRoomPanel } from '@/components/lobby/LobbyRoomPanel';
import { RoleConfigCounter } from '@/components/RoleConfigCounter';
import { RoleRevealPopup } from '@/components/RoleRevealPopup';
import { SkillPanel } from '@/components/SkillFab';
import { SkillResultToast } from '@/components/SkillResultToast';
import { MobileDrawer } from '@/components/MobileDrawer';
import { SprintHistory } from '@/components/SprintHistory';
import { ThemeToggle } from '@/components/ThemeToggle';
import { VoteFeedback } from '@/components/VoteFeedback';
import { ConnectionStatus, type GameConnectionState, GamePhaseHeader } from '@/components/game/GamePhaseHeader';
import { ContextActionBar } from '@/components/game/ContextActionBar';
import { TeamVoteBoard } from '@/components/game/TeamVoteBoard';
import { ExecutionReveal } from '@/components/game/ExecutionReveal';
import { EndGameRecap } from '@/components/game/EndGameRecap';
import { RoleGuidance } from '@/components/game/RoleGuidance';
import { GameSoundToggle } from '@/components/game/GameSoundToggle';
import { ReactionBar } from '@/components/game/ReactionBar';
import { getAvatarUrl } from '@/lib/utils';

type ChatTab = 'public' | 'bad' | 'activity' | 'skills';

const PHASE_TEXT: Record<GamePhase, { label: string; title: string; instruction: string }> = {
  roleReveal: {
    label: 'Vai trò bí mật',
    title: 'Ghi nhớ vai trò của bạn',
    instruction: 'Vai trò chỉ hiển thị trên thiết bị của bạn. Hãy đọc hướng dẫn trước khi bắt đầu.',
  },
  firstNight: {
    label: 'Giờ tan ca đầu tiên',
    title: 'Mỗi vai trò có thông tin riêng',
    instruction: 'Một số vai trò cần dùng kỹ năng trước khi vào Sprint Planning.',
  },
  planningDiscussion: {
    label: 'Thảo luận Planning',
    title: 'Cả phòng cùng bàn kế hoạch',
    instruction: 'Thảo luận trong 180 giây. Sau đó PO sẽ có riêng 45 giây để chọn đội Sprint.',
  },
  teamSelection: {
    label: 'PO chọn đội',
    title: 'Chọn đội Sprint',
    instruction: 'Chỉ PO mới chốt được đội. Chọn đúng số người trước khi hết giờ.',
  },
  teamVoting: {
    label: 'Biểu quyết đội',
    title: 'Phiếu đang được niêm phong',
    instruction: 'Chọn đồng ý hoặc từ chối. Mỗi người chỉ nhìn thấy trạng thái đã bỏ phiếu, chưa thấy lựa chọn của ai.',
  },
  teamVoteReveal: {
    label: 'Mở phiếu đội',
    title: 'Kết quả biểu quyết nhóm',
    instruction: 'Mọi lựa chọn được mở cùng lúc trong thời gian ngắn.',
  },
  execution: {
    label: 'Thực thi Sprint',
    title: 'Bỏ phiếu kín về kết quả',
    instruction: 'Chỉ người trong đội Sprint mới bỏ phiếu. Lá phiếu sẽ được xáo trước khi công bố.',
  },
  executionReveal: {
    label: 'Lật phiếu ẩn danh',
    title: 'Các lá phiếu đã được xáo',
    instruction: 'Kết quả hiện ra mà không gắn lá phiếu với người chơi.',
  },
  sprintResult: {
    label: 'Kết quả Sprint',
    title: 'Cùng xem lại Sprint vừa rồi',
    instruction: 'Một số vai trò có thể dùng kỹ năng trong cửa sổ kết quả trước Planning tiếp theo.',
  },
  assassination: {
    label: 'Cơ hội lật kèo',
    title: 'Phe Phá Dự Án có 60 giây',
    instruction: 'Người trễ task có thể chỉ điểm Scrum Master. Nếu không đoán trong thời gian này, Phe Scrum thắng.',
  },
  ended: {
    label: 'Ván đã kết thúc',
    title: 'Cùng xem lại diễn biến',
    instruction: 'Kết quả và vai trò được mở sau khi ván kết thúc.',
  },
};

function connectionView(status: string | undefined): GameConnectionState {
  if (status === 'online' || status === 'connected') return 'connected';
  if (status === 'reconnecting') return 'reconnecting';
  if (status === 'offline') return 'offline';
  return 'connecting';
}

function eventText(event: GameEvent): string {
  switch (event.type) {
    case 'phaseChanged': {
      const phase = event.data.phase;
      return typeof phase === 'string' && phase in PHASE_TEXT
        ? `Chuyển sang: ${PHASE_TEXT[phase as GamePhase].label}.`
        : 'Giai đoạn chơi đã thay đổi.';
    }
    case 'teamRejected':
      return 'Nhóm bị từ chối.';
    case 'teamAccepted':
      return 'Nhóm được duyệt.';
    case 'sprintResolved':
      return event.data.outcome === 'success' ? 'Sprint thành công.' : 'Sprint thất bại.';
    case 'gameEnded':
      return 'Ván chơi đã kết thúc.';
    case 'skillUsed':
      return 'Một kỹ năng đã được sử dụng.';
    case 'reaction':
      return `${event.data.emoji ?? '✨'} · Một người chơi đã bày tỏ cảm xúc.`;
  }
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function GamePage() {
  const params = useParams();
  const roomId = String(params.roomId ?? '');
  const router = useRouter();
  const store = useGameStore();
  const {
    publicState,
    privateState,
    endReveal,
    playerId,
    playerName,
    isHost,
    isSpectator,
    playerReady,
    connectionStatus,
    authStatus,
    messages,
    badMessages,
    canUseBadFactionChat,
    gameLog,
    sprintHistory,
    phaseRemainingMs,
    phaseDeadlineAt,
    phaseStartedAt,
    voteAck,
    error,
  } = store;

  const lobby = publicState?.phase === 'lobby' ? publicState as LobbyPublicState : null;
  const game = publicState && publicState.phase !== 'lobby' ? publicState as PublicGameState : null;
  const phase = publicState?.phase ?? store.phase;
  const inPersonMode = store.roomSettings?.communicationMode === 'inPerson';
  const players = publicState?.players ?? store.players;
  const allowedActions = privateState?.allowedActions ?? store.allowedActions;
  const role = privateState?.ownRole ?? store.myRole;
  const faction = privateState?.faction ?? store.faction;
  const knownRoles = privateState?.knownRoles ?? store.knownRoles;
  const isSilenced = Boolean(
    game?.chatPolicy.allMuted || (playerId && game?.chatPolicy.mutedPlayerId === playerId),
  );

  const [teamDraft, setTeamDraft] = useState<{ phaseVersion: number; ids: string[] }>({ phaseVersion: -1, ids: [] });
  const [chatTab, setChatTab] = useState<ChatTab>('public');
  const [chatDraft, setChatDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const [endRevealError, setEndRevealError] = useState('');
  const chatListRef = useRef<HTMLDivElement>(null);
  const gamePhaseVersion = game?.phaseVersion ?? null;
  const currentRoomId = store.roomId;
  const rejoinRoom = store.rejoinRoom;
  const subscribeToRoom = store.subscribeToRoom;
  const unsubscribeFromRoom = store.unsubscribeFromRoom;
  const fetchEndReveal = store.fetchEndReveal;

  // Route params are the room identity. The store owns browser auth and seat recovery.
  useEffect(() => {
    if (roomId && currentRoomId !== roomId) void rejoinRoom(roomId);
  }, [roomId, currentRoomId, rejoinRoom]);

  useEffect(() => {
    if (!roomId || currentRoomId !== roomId) return;
    subscribeToRoom();
    return () => unsubscribeFromRoom();
  }, [roomId, currentRoomId, subscribeToRoom, unsubscribeFromRoom]);

  useEffect(() => {
    if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatTab, messages.length, badMessages.length, gameLog.length]);

  useEffect(() => {
    if (phase !== 'ended' || gamePhaseVersion == null || endReveal) return;
    let active = true;
    void fetchEndReveal()
      .then(() => {
        if (active && !useGameStore.getState().endReveal) {
          setEndRevealError('Chưa tải được bảng vai trò. Hãy thử lại.');
        }
      })
      .catch(() => {
        if (active) setEndRevealError('Chưa tải được bảng vai trò. Hãy thử lại.');
      });
    return () => { active = false; };
  }, [phase, gamePhaseVersion, endReveal, fetchEndReveal]);

  const connection = connectionView(connectionStatus);
  const sprintIndex = game?.sprintIndex ?? 0;
  const completedSprints = game?.history.length ?? sprintHistory.length;
  const totalSprints = sprintIndex >= 4 || (game?.history.some((record) => record.sprintNumber === 5) ?? false) ? 5 : 4;
  const sprintNumber = phase === 'sprintResult' || phase === 'assassination' || phase === 'ended'
    ? Math.max(1, completedSprints)
    : Math.min(totalSprints, sprintIndex + 1);
  const requiredTeamSize = game?.requiredTeamSize ?? store.requiredTeamSize;
  const teamIds = game?.teamIds ?? store.proposedTeam;
  const teamVoteSubmittedIds = game?.teamVoteSubmittedPlayerIds ?? store.teamVoteSubmittedPlayerIds;
  const currentPlayer = players.find((player) => player.id === playerId);
  const leader = game?.leaderId ? players.find((player) => player.id === game.leaderId) : null;
  const isCurrentPo = Boolean(game?.leaderId && playerId === game.leaderId);
  const canSelectTeam = phase === 'teamSelection' && allowedActions.includes('setTeam');
  const canFinalizeTeam = canSelectTeam && allowedActions.includes('finalizeTeam');
  const teamVoteSubmitted = Boolean(playerId && teamVoteSubmittedIds.includes(playerId));
  const canVoteTeam = phase === 'teamVoting' && allowedActions.includes('castTeamVote') && !teamVoteSubmitted;
  const isOnTeam = Boolean(playerId && teamIds.includes(playerId));
  const canVoteExecution = phase === 'execution' && allowedActions.includes('castExecutionVote') && voteAck?.phase !== 'execution';
  const canGuess = phase === 'assassination' && allowedActions.includes('guessScrumMaster');
  const badChatEnabled = Boolean(privateState?.canUseBadFactionChat ?? canUseBadFactionChat);
  const activeChatTab = chatTab === 'bad' && !badChatEnabled ? 'public' : chatTab;
  const selectedPlayers = teamDraft.phaseVersion === (game?.phaseVersion ?? -1) ? teamDraft.ids : [];
  const endRevealLoading = phase === 'ended' && !endReveal && !endRevealError;

  const phaseMeta = phase && phase !== 'lobby' ? PHASE_TEXT[phase] : null;
  const instruction = phase === 'teamSelection' && sprintIndex >= 4
    ? 'Tỉ số đang hòa 2–2. Đây là Sprint 5 phân định kết quả; số người trong đội lặp lại Sprint 4.'
    : phaseMeta?.instruction ?? '';
  const timerTotalMs = phaseDeadlineAt != null && phaseStartedAt != null
    ? Math.max(1, phaseDeadlineAt - phaseStartedAt)
    : null;
  const timerLabel = phase === 'planningDiscussion'
    ? 'Thảo luận'
    : phase === 'teamSelection'
      ? 'PO chọn đội'
      : phase === 'teamVoting'
        ? 'Bỏ phiếu'
        : phase === 'teamVoteReveal'
          ? 'Mở phiếu'
          : phase === 'execution'
            ? 'Bỏ phiếu kín'
            : phase === 'executionReveal'
              ? 'Lật phiếu'
              : phase === 'assassination'
                ? 'Lật kèo'
                : phase === 'firstNight'
                  ? 'Giờ tan ca'
                  : phase === 'roleReveal'
                    ? 'Ghi nhớ vai trò'
                    : 'Còn lại';

  const toggleTeamPlayer = (targetId: string) => {
    if (!canSelectTeam) return;
    setTeamDraft((draft) => {
      const selected = draft.phaseVersion === (game?.phaseVersion ?? -1) ? draft.ids : [];
      if (selected.includes(targetId)) return { phaseVersion: game?.phaseVersion ?? -1, ids: selected.filter((id) => id !== targetId) };
      if (selected.length >= requiredTeamSize) return { phaseVersion: game?.phaseVersion ?? -1, ids: [...selected.slice(1), targetId] };
      return { phaseVersion: game?.phaseVersion ?? -1, ids: [...selected, targetId] };
    });
  };

  const finalizeTeam = async () => {
    if (!canFinalizeTeam || selectedPlayers.length !== requiredTeamSize) return;
    await store.proposeTeam(selectedPlayers);
    setTeamDraft({ phaseVersion: game?.phaseVersion ?? -1, ids: [] });
  };

  const openChat = (tab: ChatTab) => {
    setChatTab(tab);
    setChatOpen(true);
  };

  const handleSendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text || isSilenced || isSpectator) return;
    if (activeChatTab === 'bad') await store.sendBadMessage(text);
    else await store.sendMessage(text);
    setChatDraft('');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Vào phòng Agile', text: `Mã phòng ${roomId}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareToast('Đã sao chép lời mời.');
      }
    } catch {
      setShareToast(url);
    }
  };

  const leave = () => {
    store.leaveRoom();
    router.push('/');
  };

  const retryEndReveal = async () => {
    setEndRevealError('');
    try {
      await fetchEndReveal();
      if (!useGameStore.getState().endReveal) setEndRevealError('Chưa tải được bảng vai trò. Hãy thử lại.');
    } catch {
      setEndRevealError('Chưa tải được bảng vai trò. Hãy thử lại.');
    }
  };

  const openSkills = () => openChat('skills');
  const messageSource: RoomMessage[] = activeChatTab === 'bad' ? badMessages : messages;
  const eventSource = game?.publicEvents ?? gameLog;
  const gamePlayers = game?.players ?? [];
  const revealRoleById = new Map(endReveal?.revealedRoles.map(({ playerId: revealedPlayerId, role: revealedRole }) => [revealedPlayerId, revealedRole]) ?? []);
  const recapPlayers = (endReveal?.players ?? []).map((player) => ({
    id: player.id,
    name: player.name,
    role: revealRoleById.get(player.id) ?? null,
  }));
  const revealedBadPlayerIds = new Set(
    knownRoles.filter(({ role: knownRole }) => factionForRole(knownRole) === 'bad').map(({ playerId: knownId }) => knownId),
  );
  const guessCandidates = gamePlayers.filter((player) => player.id !== playerId && !revealedBadPlayerIds.has(player.id));

  const renderChat = () => (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Tin nhắn và hoạt động">
      <div role="group" aria-label="Nội dung phòng" className="flex gap-1 overflow-x-auto border-b border-outline-variant p-2">
        <ChatTabButton active={activeChatTab === 'public'} onClick={() => setChatTab('public')}>Chat</ChatTabButton>
        {badChatEnabled && <ChatTabButton active={activeChatTab === 'bad'} onClick={() => setChatTab('bad')}>Chat riêng</ChatTabButton>}
        <ChatTabButton active={activeChatTab === 'activity'} onClick={() => setChatTab('activity')}>Diễn biến</ChatTabButton>
        <ChatTabButton active={activeChatTab === 'skills'} onClick={() => setChatTab('skills')}>Kỹ năng</ChatTabButton>
      </div>

      {game && allowedActions.includes('react') && !isSpectator && (
        <ReactionBar
          players={game.players}
          proposalAvailable={game.teamIds.length > 0}
          resultAvailable={game.history.length > 0}
          onReact={(emoji, targetType, targetPlayerId) => void store.sendReaction(emoji, targetType, targetPlayerId)}
        />
      )}

      {activeChatTab === 'skills' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3"><SkillPanel /></div>
      ) : activeChatTab === 'activity' ? (
        <div ref={chatListRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
          {eventSource.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant p-4 text-center text-xs text-muted-foreground">Sự kiện sẽ xuất hiện tại đây khi ván bắt đầu.</p>
          ) : eventSource.map((event, index) => (
            <div key={`${event.type}-${index}`} className="flex gap-2 rounded-xl border border-outline-variant bg-surface-container/40 p-3">
              <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">{event.type === 'sprintResolved' ? 'flag' : event.type === 'teamRejected' || event.type === 'teamAccepted' ? 'how_to_vote' : 'info'}</span>
              <p className="text-xs leading-relaxed text-foreground">{eventText(event)}</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          {inPersonMode && activeChatTab === 'public' && (
            <p className="border-b border-outline-variant px-3 py-2 text-xs text-muted-foreground">Chế độ chơi trực tiếp: hãy trò chuyện cùng nhau; chat vẫn sẵn sàng khi cần.</p>
          )}
          <div ref={chatListRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite" aria-label={activeChatTab === 'bad' ? 'Tin nhắn riêng phe Phá Dự Án' : 'Tin nhắn công khai'}>
            {messageSource.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant px-4 py-8 text-center">
                <span className="material-symbols-outlined text-2xl text-muted-foreground" aria-hidden="true">forum</span>
                <p className="mt-2 text-sm text-foreground">Chưa có tin nhắn</p>
                <p className="mt-1 text-xs text-muted-foreground">Bắt đầu cuộc trò chuyện tại đây.</p>
              </div>
            ) : messageSource.map((message) => {
              const sender = players.find((player) => player.id === message.senderPlayerId)?.name ?? 'Người chơi';
              const isOwn = message.senderPlayerId === playerId;
              return (
                <article key={message.sequence} className={`max-w-[92%] rounded-2xl border px-3 py-2 ${isOwn ? 'ml-auto border-primary/30 bg-primary/10' : 'border-outline-variant bg-surface-container/50'}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-xs font-semibold text-foreground">{isOwn ? 'Bạn' : sender}</p>
                    <time className="shrink-0 text-[10px] text-muted-foreground" dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{message.text}</p>
                </article>
              );
            })}
          </div>
          {isSilenced && <p className="border-t border-error/20 bg-error/5 px-3 py-2 text-xs text-error">Chat đang bị khóa trong giai đoạn này.</p>}
          <form onSubmit={handleSendChat} className="flex gap-2 border-t border-outline-variant p-3">
            <input
              type="text"
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              maxLength={500}
              disabled={isSilenced || isSpectator}
              aria-label={activeChatTab === 'bad' ? 'Nhắn riêng cho phe Phá Dự Án' : 'Nhắn cho cả phòng'}
              placeholder={isSilenced ? 'Chat đang bị khóa' : 'Viết tin nhắn…'}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
            />
            <Button type="submit" className="min-h-11 shrink-0 px-3" disabled={!chatDraft.trim() || isSilenced || isSpectator} aria-label="Gửi tin nhắn">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">send</span>
            </Button>
          </form>
        </>
      )}
    </section>
  );

  const renderSidebar = () => (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-outline-variant p-4">
        <img src={getAvatarUrl(playerName || 'Player')} alt="" className="h-11 w-11 rounded-full border border-outline-variant object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{playerName || currentPlayer?.name || 'Người chơi'}</p>
          {role && <p className={`mt-0.5 truncate text-xs ${faction === 'bad' ? 'text-error' : 'text-secondary'}`}>{role}</p>}
        </div>
        <ConnectionStatus status={connection} />
      </div>

      <div className="space-y-3 p-3">
        <RoleGuidance role={privateState?.ownRole ?? null} faction={privateState?.faction ?? null} knownRoles={privateState?.knownRoles ?? []} players={gamePlayers} />
        {game && (
          <div className="rounded-2xl border border-outline-variant bg-surface-container/40 p-4">
            <h2 className="text-sm font-semibold text-foreground">Bảng Sprint</h2>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Đội Scrum · cần 3 thắng</span><span className="font-mono font-semibold text-secondary">{game.goodWins}/3</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Phe Phá Dự Án · cần 3 thất bại</span><span className="font-mono font-semibold text-error">{game.badWins}/3</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3 text-xs text-muted-foreground">
              <span>Nhóm bị từ chối</span><span className="font-mono">{game.rejectedTeams}/4</span>
            </div>
          </div>
        )}
        <SprintHistory />
        <div className="rounded-2xl border border-outline-variant bg-surface-container/30 p-3">
          <p className="text-xs font-medium text-foreground">Phòng {roomId}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Mời đồng đội qua nút chia sẻ ở phía trên.</p>
          <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => void handleShare()}>
            <span className="material-symbols-outlined mr-2 text-base" aria-hidden="true">ios_share</span>
            Chia sẻ lời mời
          </Button>
        </div>
      </div>
    </div>
  );

  const renderPhase = () => {
    if (!publicState) {
      return (
        <div className="glass-panel rounded-2xl p-6 text-center sm:p-8" role="status">
          <span className="material-symbols-outlined text-3xl text-primary" aria-hidden="true">sync</span>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Đang kết nối phòng</h2>
          <p className="mt-1 text-sm text-muted-foreground">Đang khôi phục chỗ ngồi và đồng bộ trạng thái.</p>
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-outline px-4 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Về trang chủ</Link>
        </div>
      );
    }

    if (lobby) {
      const lobbyPlayers = lobby.players.map((player) => ({ ...player, isHost: player.id === lobby.hostPlayerId }));
      const activePlayerCount = lobby.players.filter((player) => !player.isSpectator).length;
      return (
        <div className="space-y-5">
          <LobbyRoomPanel
            roomId={roomId}
            players={lobbyPlayers}
            currentPlayerId={playerId || ''}
            isHost={isHost || playerId === lobby.hostPlayerId}
            isReady={playerReady}
            isLocked={lobby.locked}
            communicationMode={lobby.settings.communicationMode}
            phase="lobby"
            onReadyChange={store.setReady}
            onLockChange={store.setRoomLocked}
            onKick={store.kickPlayer}
            onTransferHost={store.transferHost}
            onCommunicationModeChange={(communicationMode) => store.setRoomSettings({ communicationMode })}
          />
          {activePlayerCount >= 5 && (isHost || playerId === lobby.hostPlayerId) ? (
            <RoleConfigCounter
              onStart={() => void store.startGame()}
              rolePreview={lobby.rolePreview}
              isHost={isHost || playerId === lobby.hostPlayerId}
              isBusy={authStatus === 'authenticating'}
              serverError={error}
              onSelectPreset={(preset, roles) => store.setRolePreset(preset, roles)}
              onRerollPreset={store.rerollRolePreset}
            />
          ) : activePlayerCount < 5 ? (
            <p className="rounded-xl border border-outline-variant bg-surface-container/40 p-3 text-center text-sm text-muted-foreground">Cần ít nhất 5 người chơi để bắt đầu.</p>
          ) : null}
        </div>
      );
    }

    if (!game || !phaseMeta) return null;

    if (phase === 'planningDiscussion') {
      return (
        <section className="glass-panel rounded-2xl p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl text-primary" aria-hidden="true">forum</span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Thảo luận trước khi chọn đội</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Tất cả người chơi có 180 giây để trao đổi. Khi đồng hồ kết thúc, PO mới bước vào lượt chọn đội 45 giây.</p>
              {game.chatPolicy.allMuted && <p className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">Phòng đang im lặng trong Planning.</p>}
              {game.chatPolicy.mutedPlayerId && <p className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">Một người chơi đang bị khóa chat trong Planning.</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">PO hiện tại: {leader?.name ?? 'Đang cập nhật'}</Badge>
            <Badge variant="outline">Đội cần {requiredTeamSize} người</Badge>
          </div>
        </section>
      );
    }

    if (phase === 'teamSelection') {
      return (
        <section className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Chọn đúng {requiredTeamSize} người</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isCurrentPo ? 'Chạm vào từng người để thêm hoặc bỏ khỏi đội.' : `Đang chờ PO ${leader?.name ?? ''} chọn đội.`}
                </p>
              </div>
              <span className="rounded-full border border-outline-variant bg-surface-container/60 px-3 py-1.5 font-mono text-sm text-foreground">{selectedPlayers.length}/{requiredTeamSize}</span>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Chọn người vào đội Sprint">
            {game.players.map((player) => {
              const selected = selectedPlayers.includes(player.id);
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    aria-label={`Chọn ${player.name}`}
                    aria-pressed={selected}
                    disabled={!canSelectTeam}
                    onClick={() => toggleTeamPlayer(player.id)}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70 ${selected ? 'border-secondary/50 bg-secondary/10' : 'glass-panel hover:bg-surface-container-high'}`}
                  >
                    <img src={getAvatarUrl(player.name)} alt="" className="h-10 w-10 rounded-full border border-outline-variant object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{player.name}{player.id === playerId ? ' · Bạn' : ''}</span>
                      {player.id === game.leaderId && <span className="text-xs text-primary">Product Owner</span>}
                    </span>
                    <span className={`material-symbols-outlined ${selected ? 'text-secondary' : 'text-muted-foreground'}`} aria-hidden="true">{selected ? 'check_circle' : 'radio_button_unchecked'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!isCurrentPo && <p className="text-center text-xs text-muted-foreground">Bạn có thể trao đổi với cả phòng trong chat khi chat đang mở.</p>}
        </section>
      );
    }

    if (phase === 'teamVoting') {
      const proposedNames = game.teamIds.map((id) => game.players.find((player) => player.id === id)).filter((player): player is PublicGameState['players'][number] => Boolean(player));
      return (
        <div className="space-y-4">
          <section className="glass-panel rounded-2xl p-4 sm:p-5">
            <h2 className="text-base font-semibold text-foreground">Đội được đề xuất cho Sprint {sprintNumber}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {proposedNames.map((player) => <Badge key={player.id} variant="outline" className="px-3 py-1.5">{player.name}</Badge>)}
            </div>
          </section>
          <TeamVoteBoard state={{
            kind: 'voting',
            players: game.players,
            eligibleIds: game.players.map((player) => player.id),
            submittedIds: game.teamVoteSubmittedPlayerIds,
            pendingIds: game.teamVotePendingPlayerIds,
            viewerId: playerId,
          }} />
        </div>
      );
    }

    if (phase === 'teamVoteReveal') {
      return <TeamVoteBoard state={{
        kind: 'reveal',
        players: game.players,
        choices: game.teamVoteRevealVotes ?? {},
        accepted: game.teamVoteOutcome?.accepted ?? false,
        approveWeight: game.teamVoteOutcome?.approveWeight ?? 0,
        rejectWeight: game.teamVoteOutcome?.rejectWeight ?? 0,
      }} />;
    }

    if (phase === 'execution') {
      const team = game.teamIds.map((id) => game.players.find((player) => player.id === id)).filter((player): player is PublicGameState['players'][number] => Boolean(player));
      return (
        <section className="glass-panel rounded-2xl p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Đội thực thi Sprint</h2>
              <p className="mt-1 text-sm text-muted-foreground">Phiếu kín chỉ đến từ người có mặt trong đội.</p>
            </div>
            <span className="rounded-full border border-outline-variant bg-surface-container/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">{game.executionSubmittedCount}/{team.length} đã bỏ phiếu</span>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Thành viên đội Sprint">
            {team.map((player) => (
              <li key={player.id} className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 ${player.id === playerId ? 'border-primary/40 bg-primary/5' : 'border-outline-variant bg-surface-container/40'}`}>
                <img src={getAvatarUrl(player.name)} alt="" className="h-9 w-9 rounded-full border border-outline-variant object-cover" />
                <span className="text-sm font-medium text-foreground">{player.name}{player.id === playerId ? ' · Bạn' : ''}</span>
              </li>
            ))}
          </ul>
          {!isOnTeam && <p className="mt-4 rounded-xl border border-outline-variant p-3 text-sm text-muted-foreground">Bạn không nằm trong đội Sprint này. Hãy chờ kết quả chung.</p>}
        </section>
      );
    }

    if (phase === 'executionReveal') {
      return game.executionReveal
        ? <ExecutionReveal {...game.executionReveal} />
        : <div className="glass-panel rounded-2xl p-6 text-center text-sm text-muted-foreground" role="status">Đang xáo và mở các lá phiếu ẩn danh…</div>;
    }

    if (phase === 'sprintResult') {
      const lastSprint = game.history[game.history.length - 1];
      return (
        <section className="glass-panel rounded-2xl p-5 sm:p-7">
          <p className="text-xs text-muted-foreground">Sprint {lastSprint?.sprintNumber ?? sprintNumber}</p>
          <h2 className={`mt-1 text-2xl font-bold ${lastSprint?.outcome === 'success' ? 'text-secondary' : 'text-error'}`}>
            {lastSprint?.outcome === 'success' ? 'Sprint thành công' : 'Sprint thất bại'}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">Tỉ số hiện tại: <span className="font-mono text-secondary">Scrum {game.goodWins}</span> – <span className="font-mono text-error">Phá Dự Án {game.badWins}</span></p>
          {lastSprint && <p className="mt-2 text-sm text-muted-foreground">Đội có {lastSprint.teamIds.length} người · trọng số phiếu thất bại {lastSprint.failWeight}.</p>}
          {allowedActions.some((action) => action === 'useQcRedo' || action === 'useDaCheck') && (
            <Button type="button" className="mt-5 min-h-11" onClick={openSkills}>Mở kỹ năng của bạn</Button>
          )}
        </section>
      );
    }

    if (phase === 'assassination') {
      return (
        <section className="space-y-4">
          <div className="glass-panel rounded-2xl border-error/30 p-5 sm:p-7">
            <p className="text-xs text-error">Cửa sổ cuối game</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">Ai là Scrum Master?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Chỉ Người trễ task mới có thể gửi lượt chỉ điểm. Chọn một người chơi; vai trò của họ vẫn được giữ kín.</p>
          </div>
          {canGuess ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Chọn nghi phạm Scrum Master">
              {guessCandidates.map((player) => (
                <li key={player.id}>
                  <Button type="button" variant="outline" className="h-auto min-h-20 w-full flex-col gap-2 py-3" onClick={() => void store.saboteurGuess(player.id)}>
                    <img src={getAvatarUrl(player.name)} alt="" className="h-9 w-9 rounded-full border border-outline-variant object-cover" />
                    <span className="max-w-full truncate text-xs">{player.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-xl border border-outline-variant p-4 text-sm text-muted-foreground">Đang chờ Người trễ task đưa ra quyết định.</p>}
        </section>
      );
    }

    if (phase === 'ended') {
      return (
        <div className="space-y-5">
          {game.winner ? (
            <EndGameRecap
              winner={game.winner}
              endReason={game.endReason}
              goodWins={game.goodWins}
              badWins={game.badWins}
              players={recapPlayers}
              sprintHistory={endReveal?.history ?? game.history}
              isLoading={endRevealLoading}
            />
          ) : <div className="glass-panel rounded-2xl p-6 text-center text-sm text-muted-foreground">Đang tải kết quả ván chơi…</div>}
          {endRevealError && <div className="rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error" role="alert">{endRevealError} <button type="button" className="ml-2 underline" onClick={() => void retryEndReveal()}>Thử lại</button></div>}
          <LobbyRoomPanel
            roomId={roomId}
            players={players.map((player) => ({ id: player.id, name: player.name, ready: true, presence: 'online' as const, isHost: Boolean(player.id === playerId && isHost), isSpectator: false }))}
            currentPlayerId={playerId || ''}
            isHost={isHost}
            phase="ended"
            rematch={store.rematch ?? { proposedBy: null, readyPlayerIds: [] }}
            onProposeRematch={store.proposeRematch}
            onStartRematch={store.startRematch}
          />
        </div>
      );
    }

    if (phase === 'roleReveal') {
      return <section className="glass-panel rounded-2xl p-6 text-center"><h2 className="text-lg font-semibold text-foreground">Vai trò của bạn đã được phát bí mật</h2><p className="mt-2 text-sm text-muted-foreground">Đóng phiếu vai trò của bạn khi đã ghi nhớ.</p></section>;
    }

    if (phase === 'firstNight') {
      const needsTarget = allowedActions.includes('setTtsTarget');
      return (
        <section className="glass-panel rounded-2xl p-5 sm:p-7">
          <span className="material-symbols-outlined grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl text-primary" aria-hidden="true">bedtime</span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Giờ tan ca đầu tiên</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Thông tin riêng của bạn nằm trong thẻ vai trò. Không có mục tiêu bí mật nào được hiển thị công khai.</p>
          {needsTarget && <Button type="button" className="mt-4 min-h-11" onClick={openSkills}>Chọn người theo sát</Button>}
        </section>
      );
    }

    return <section className="glass-panel rounded-2xl p-5"><h2 className="text-lg font-semibold text-foreground">{phaseMeta.title}</h2><p className="mt-2 text-sm text-muted-foreground">{phaseMeta.instruction}</p></section>;
  };

  const actionTitle = phase === 'teamSelection'
    ? isCurrentPo ? 'Đến lượt bạn chọn đội' : 'Chờ PO chọn đội'
    : phase === 'teamVoting'
      ? teamVoteSubmitted ? 'Phiếu của bạn đã được ghi nhận' : 'Bỏ phiếu duyệt đội'
      : phase === 'execution'
        ? isOnTeam ? 'Đến lượt đội Sprint bỏ phiếu' : 'Chờ đội Sprint bỏ phiếu'
        : phase === 'firstNight' && allowedActions.includes('setTtsTarget')
          ? 'Bạn cần chọn người theo sát'
          : phase === 'ended'
            ? 'Ván chơi đã kết thúc'
            : phaseMeta?.label ?? 'Đang đồng bộ phòng';
  const actionDescription = phase === 'teamSelection'
    ? `Chọn đúng ${requiredTeamSize} người trước khi hết 45 giây.`
    : phase === 'teamVoting'
      ? 'Lựa chọn được giữ kín cho đến khi cả phòng hoàn tất bỏ phiếu.'
      : phase === 'execution'
        ? isOnTeam ? 'Người thuộc phe Scrum chỉ có thể chọn Hoàn thành.' : 'Lá phiếu được mở sau khi hệ thống xáo ngẫu nhiên.'
        : phase === 'firstNight' && allowedActions.includes('setTtsTarget')
          ? 'Chọn mục tiêu trong thẻ Kỹ năng. Mục tiêu sẽ không hiện trên bảng công khai.'
          : phase === 'ended'
            ? 'Xem lại Sprint và vai trò, hoặc chơi lại cùng phòng.'
            : instruction || 'Theo dõi đồng hồ và trao đổi khi chat khả dụng.';

  const renderContextActions = () => {
    if (phase === 'teamSelection' && (canSelectTeam || allowedActions.includes('usePmOverride'))) {
      return <>
        {canSelectTeam && <Button type="button" className="min-h-11" onClick={() => void finalizeTeam()} disabled={selectedPlayers.length !== requiredTeamSize || !canFinalizeTeam}>Chốt đội hình</Button>}
        {allowedActions.includes('usePmOverride') && <Button type="button" variant="outline" className="min-h-11" onClick={openSkills}>Chiếm quyền chỉ định</Button>}
      </>;
    }
    if (phase === 'teamVoting' && canVoteTeam) {
      return <>
        <Button type="button" className="min-h-11 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => void store.voteTeam('approve')}>Đồng ý</Button>
        <Button type="button" variant="outline" className="min-h-11 border-error/40 text-error hover:bg-error/10" onClick={() => void store.voteTeam('reject')}>Từ chối</Button>
      </>;
    }
    if (phase === 'execution' && canVoteExecution && isOnTeam) {
      return <>
        <Button type="button" className="min-h-11 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => void store.voteExecution('success')}>Hoàn thành</Button>
        {faction === 'bad' && <Button type="button" variant="outline" className="min-h-11 border-error/40 text-error hover:bg-error/10" onClick={() => void store.voteExecution('fail')}>Thất bại</Button>}
      </>;
    }
    if (phase === 'firstNight' && allowedActions.includes('setTtsTarget')) {
      return <Button type="button" className="min-h-11" onClick={openSkills}>Chọn người theo sát</Button>;
    }
    if ((phase === 'planningDiscussion' || phase === 'sprintResult') && allowedActions.some((action) => ['usePmOverride', 'useBossSilence', 'useDeadlineSilence', 'useBaCheck', 'useQcRedo', 'useDaCheck'].includes(action))) {
      return <Button type="button" variant="outline" className="min-h-11" onClick={openSkills}>Mở kỹ năng</Button>;
    }
    if (phase === 'ended') {
      return <Button type="button" variant="outline" className="min-h-11" onClick={leave}>Về trang chủ</Button>;
    }
    if (phase === 'planningDiscussion') return <Button type="button" variant="outline" className="min-h-11" onClick={() => openChat('public')}>Mở chat</Button>;
    if (phase === 'teamVoting' && teamVoteSubmitted) return <Badge variant="outline" className="min-h-10 px-3">Đã gửi phiếu</Badge>;
    if (phase === 'execution' && (!isOnTeam || voteAck?.phase === 'execution')) return <Badge variant="outline" className="min-h-10 px-3">{isOnTeam ? 'Đã gửi phiếu' : 'Bạn đang chờ'}</Badge>;
    return null;
  };

  const totalDuration = timerTotalMs;
  const phaseIsGame = Boolean(phase && phase !== 'lobby');
  const contextActions = renderContextActions();

  return (
    <div className="game-experience flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#game-board" className="sr-only z-[100] rounded-lg bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Bỏ qua điều hướng</a>
      {phase === 'roleReveal' && store.showRoleReveal && <RoleRevealPopup />}
      <SkillResultToast />
      <VoteFeedback />

      <nav className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-outline-variant bg-surface-dim/90 px-2 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-4 lg:px-6" aria-label="Điều hướng phòng chơi">
        <button type="button" onClick={() => setMenuOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden" aria-label="Mở bảng người chơi và vai trò">
          <span className="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Say Agile One More Time — trang chủ">
          <img src="/brand/logo.svg" alt="" className="h-7 w-auto sm:h-8" />
          <span className="hidden truncate text-sm font-semibold text-foreground xl:inline">Say Agile One More Time</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <span className="hidden max-w-28 truncate font-mono text-xs text-muted-foreground sm:inline">{roomId}</span>
          {phaseIsGame && <span className="hidden font-mono text-xs font-semibold text-secondary sm:inline">Sprint {sprintNumber}/{totalSprints}</span>}
          {inPersonMode && <span className="hidden rounded-full border border-outline-variant px-2 py-1 text-[10px] text-muted-foreground sm:inline">Chơi trực tiếp</span>}
          <ConnectionStatus status={connection} />
          <button type="button" onClick={() => void handleShare()} className="grid h-10 w-10 place-items-center rounded-xl text-primary hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Chia sẻ lời mời phòng">
            <span className="material-symbols-outlined" aria-hidden="true">ios_share</span>
          </button>
          <GameSoundToggle
            phaseVersion={game?.phaseVersion ?? lobby?.phaseVersion ?? null}
            phase={phase}
            remainingMs={phaseDeadlineAt == null ? null : phaseRemainingMs}
            voteAck={voteAck}
            revealOutcome={game?.executionReveal?.outcome ?? null}
            winner={game?.winner ?? null}
            latestSkill={game?.publicEvents.filter((event) => event.type === 'skillUsed').at(-1)?.data.skill?.toString() ?? null}
          />
          <ThemeToggle />
          <button type="button" onClick={() => openChat('public')} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden" aria-label="Mở chat">
            <span className="material-symbols-outlined" aria-hidden="true">forum</span>
            {messages.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 overflow-hidden border-r border-outline-variant bg-surface-container-low/60 backdrop-blur-lg md:block xl:w-80" aria-label="Vai trò và bảng Sprint">
          {renderSidebar()}
        </aside>

        <main id="game-board" className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-48 pt-3 sm:px-5 sm:pt-5 lg:pb-36" tabIndex={-1}>
          <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
            {phaseMeta && (
              <GamePhaseHeader
                roomId={roomId}
                phaseLabel={phaseMeta.label}
                title={phase === 'teamSelection' ? `Sprint ${sprintNumber} · Chọn đội` : phaseMeta.title}
                instruction={instruction}
                sprintNumber={sprintNumber}
                totalSprints={totalSprints}
                goodWins={game?.goodWins ?? 0}
                badWins={game?.badWins ?? 0}
                remainingMs={phaseDeadlineAt == null ? null : phaseRemainingMs}
                totalMs={totalDuration}
                timerLabel={timerLabel}
                connectionStatus={connection}
              />
            )}
            {error && <div className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error" role="alert">{error}</div>}
            {renderPhase()}
            {shareToast && <p className="rounded-xl border border-secondary/30 bg-secondary/5 p-3 text-sm text-secondary" role="status">{shareToast}</p>}
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 flex-col overflow-hidden border-l border-outline-variant bg-surface-container-low/60 backdrop-blur-lg lg:flex" aria-label="Chat và hoạt động">
          {renderChat()}
        </aside>
      </div>

      {phaseIsGame && <ContextActionBar title={actionTitle} description={actionDescription} waiting={!contextActions}>{contextActions}</ContextActionBar>}

      <MobileDrawer open={menuOpen} onOpenChange={setMenuOpen} side="left" title="Vai trò và bảng Sprint">
        <div className="min-h-0">{renderSidebar()}</div>
      </MobileDrawer>
      <MobileDrawer open={chatOpen} onOpenChange={setChatOpen} side="bottom" title={activeChatTab === 'bad' ? 'Chat riêng phe Phá Dự Án' : 'Chat và hoạt động'}>
        <div className="flex h-[70dvh] min-h-0 flex-col">{renderChat()}</div>
      </MobileDrawer>
    </div>
  );
}

function ChatTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 flex-1 whitespace-nowrap rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-surface-container-high hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}
