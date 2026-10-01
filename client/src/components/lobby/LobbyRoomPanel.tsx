'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';

export type LobbyPresence = 'online' | 'away';
export type LobbyCommunicationMode = 'remote' | 'inPerson';

export interface LobbyLobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  presence: LobbyPresence;
  isHost?: boolean;
  isSpectator?: boolean;
}

export interface LobbyRematchState {
  proposedBy: string | null;
  readyPlayerIds: string[];
}

export interface LobbyRoomPanelProps {
  roomId: string;
  inviteUrl?: string;
  players: LobbyLobbyPlayer[];
  currentPlayerId: string;
  isHost: boolean;
  isReady?: boolean;
  isLocked?: boolean;
  communicationMode?: LobbyCommunicationMode;
  phase: 'lobby' | 'ended';
  rematch?: LobbyRematchState;
  onReadyChange?: (ready: boolean) => void | Promise<void>;
  onLockChange?: (locked: boolean) => void | Promise<void>;
  onKick?: (playerId: string) => void | Promise<void>;
  onTransferHost?: (playerId: string) => void | Promise<void>;
  onCommunicationModeChange?: (mode: LobbyCommunicationMode) => void | Promise<void>;
  onProposeRematch?: () => void | Promise<void>;
  onRematchOptIn?: (ready: boolean) => void | Promise<void>;
  onStartRematch?: () => void | Promise<void>;
}

type ConfirmAction =
  | { type: 'kick'; player: LobbyLobbyPlayer }
  | { type: 'transfer'; player: LobbyLobbyPlayer }
  | null;

export function createRoomInviteUrl(roomId: string, origin: string): string {
  return `${origin}/?room=${encodeURIComponent(roomId)}`;
}

export function LobbyRoomPanel({
  roomId,
  inviteUrl: suppliedInviteUrl,
  players,
  currentPlayerId,
  isHost,
  isReady,
  isLocked,
  communicationMode,
  phase,
  rematch,
  onReadyChange,
  onLockChange,
  onKick,
  onTransferHost,
  onCommunicationModeChange,
  onProposeRematch,
  onRematchOptIn,
  onStartRematch,
}: LobbyRoomPanelProps) {
  const [qrCode, setQrCode] = useState('');
  const [qrError, setQrError] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let active = true;
    const invite = suppliedInviteUrl || createRoomInviteUrl(roomId, window.location.origin);

    QRCode.toDataURL(invite, {
      width: 176,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#172033', light: '#ffffff' },
    }).then((dataUrl) => {
      if (active) {
        setQrCode(dataUrl);
        setQrError(false);
      }
    }).catch(() => {
      if (active) {
        setQrCode('');
        setQrError(true);
      }
    });

    return () => { active = false; };
  }, [roomId, suppliedInviteUrl]);

  const getInviteUrl = () => suppliedInviteUrl || createRoomInviteUrl(roomId, window.location.origin);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} đã được sao chép.`);
      return true;
    } catch {
      setCopyMessage(`Không thể sao chép. Hãy chọn và sao chép ${label.toLowerCase()}.`);
      return false;
    }
  };

  const shareInvite = async () => {
    const inviteUrl = getInviteUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Vào phòng chơi', text: `Mã phòng ${roomId}`, url: inviteUrl });
        setCopyMessage('Đã mở chia sẻ lời mời.');
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyText(inviteUrl, 'Liên kết mời');
  };

  const runAction = async (action: () => void | Promise<void>) => {
    setIsWorking(true);
    setCopyMessage('');
    try {
      await action();
      setConfirmAction(null);
    } catch {
      setCopyMessage('Không thể cập nhật phòng. Vui lòng thử lại.');
    } finally {
      setIsWorking(false);
    }
  };

  const performConfirmedAction = () => {
    if (!confirmAction) return;
    const pending = confirmAction;
    if (pending.type === 'kick' && onKick) {
      void runAction(() => onKick(pending.player.id));
    } else if (pending.type === 'transfer' && onTransferHost) {
      void runAction(() => onTransferHost(pending.player.id));
    }
  };

  const isRematchProposed = Boolean(rematch?.proposedBy);
  const readyPlayerIds = rematch?.readyPlayerIds ?? [];
  const currentPlayerOptedIn = readyPlayerIds.includes(currentPlayerId);
  const canStartRematch = readyPlayerIds.length >= 5;
  const currentPlayer = players.find((player) => player.id === currentPlayerId);
  const readyState = typeof isReady === 'boolean' ? isReady : currentPlayer?.ready;
  const activeCommunicationMode = communicationMode ?? 'remote';
  const playerCount = players.filter((player) => !player.isSpectator).length;
  const spectatorCount = players.length - playerCount;

  return (
    <section className="space-y-5" aria-label="Phòng chơi">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.78fr)]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mã phòng</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.12em] text-foreground" aria-label={`Mã phòng ${roomId}`}>
                {roomId}
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isLocked ? 'bg-surface-container-high text-muted-foreground' : 'bg-secondary/10 text-secondary'}`}>
              <span className={`h-2 w-2 rounded-full ${isLocked ? 'bg-muted-foreground' : 'bg-secondary'}`} />
              {isLocked ? 'Đã khóa phòng' : 'Đang nhận người chơi'}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-center gap-2"
              onClick={() => void copyText(roomId, 'Mã phòng')}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">content_copy</span>
              Sao chép mã
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-center gap-2"
              onClick={() => void copyText(getInviteUrl(), 'Liên kết mời')}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">link</span>
              Sao chép liên kết
            </Button>
            <Button
              type="button"
              className="h-11 justify-center gap-2"
              onClick={() => void shareInvite()}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">ios_share</span>
              Chia sẻ lời mời
            </Button>
          </div>

          <details className="group mt-3 rounded-xl border border-border bg-background" open={activeCommunicationMode === 'inPerson'}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">qr_code_2</span>
                Mã QR để vào phòng
              </span>
              <span className="material-symbols-outlined text-lg text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
            </summary>
            <div className="flex flex-col items-center gap-2 border-t border-border p-4 text-center">
              {qrCode ? (
                <Image src={qrCode} alt={`Mã QR lời mời vào phòng ${roomId}`} width={176} height={176} unoptimized className="h-44 w-44 rounded-lg border border-border bg-white p-2" />
              ) : qrError ? (
                <p className="max-w-xs text-sm text-muted-foreground">Chưa tạo được mã QR. Hãy chia sẻ mã phòng hoặc liên kết mời.</p>
              ) : (
                <div className="h-44 w-44 animate-pulse rounded-lg bg-muted" aria-label="Đang tạo mã QR" />
              )}
              <p className="text-xs text-muted-foreground">Quét bằng camera để mở trang tham gia.</p>
            </div>
          </details>
          <p className="mt-3 min-h-5 text-sm text-primary" aria-live="polite">{copyMessage}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Người chơi</p>
              <h2 className="mt-1 text-xl font-bold text-foreground">Danh sách phòng</h2>
            </div>
            <span className="text-right font-mono text-sm tabular-nums text-muted-foreground">
              <span className="block">{playerCount}/10</span>
              {spectatorCount > 0 && <span className="block font-sans text-xs">{spectatorCount} khán giả</span>}
            </span>
          </div>

          <ul className="mt-4 space-y-2">
            {players.map((player) => {
              const isCurrentPlayer = player.id === currentPlayerId;
              const presenceText = player.presence === 'online' ? 'Đang online' : 'Mất kết nối';
              return (
                <li key={player.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${player.presence === 'online' ? 'bg-secondary' : 'bg-muted-foreground'}`} aria-label={presenceText} title={presenceText} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {player.name}{isCurrentPlayer ? <span className="ml-1.5 font-normal text-muted-foreground">(Bạn)</span> : null}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {player.isHost && <span className="inline-flex items-center gap-1 text-primary"><span className="material-symbols-outlined text-sm" aria-hidden="true">crown</span>Chủ phòng</span>}
                        {player.isSpectator && <span>Khán giả</span>}
                        <span>{presenceText}</span>
                      </div>
                    </div>
                    {phase === 'lobby' && !player.isSpectator && (
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${player.ready ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'}`}>
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">{player.ready ? 'check_circle' : 'schedule'}</span>
                        {player.ready ? 'Sẵn sàng' : 'Đang chờ'}
                      </span>
                    )}
                    {phase === 'ended' && rematch?.proposedBy && (
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${readyPlayerIds.includes(player.id) ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'}`}>
                        {readyPlayerIds.includes(player.id) ? 'Vào ván mới' : 'Chưa tham gia'}
                      </span>
                    )}
                  </div>

                  {phase === 'lobby' && isHost && !isCurrentPlayer && (onKick || (onTransferHost && player.presence === 'online')) && (
                    <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-border pt-2">
                      {onTransferHost && player.presence === 'online' && (
                        <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={() => setConfirmAction({ type: 'transfer', player })}>
                          Chuyển chủ phòng
                        </Button>
                      )}
                      {onKick && (
                        <Button type="button" variant="ghost" size="sm" className="min-h-9 text-destructive hover:text-destructive" onClick={() => setConfirmAction({ type: 'kick', player })}>
                          Mời rời phòng
                        </Button>
                      )}
                    </div>
                  )}

                  {confirmAction?.player.id === player.id && (
                    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3" role="group" aria-label="Xác nhận thao tác phòng">
                      <p className="text-sm text-foreground">
                        {confirmAction.type === 'kick' ? `Mời ${player.name} rời phòng?` : `Chuyển quyền chủ phòng cho ${player.name}?`}
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmAction(null)} disabled={isWorking}>Hủy</Button>
                        <Button type="button" size="sm" onClick={performConfirmedAction} disabled={isWorking}>
                          {isWorking ? 'Đang cập nhật…' : 'Xác nhận'}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {players.length === 0 && (
              <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Chưa có người chơi trong phòng.</li>
            )}
          </ul>

          {phase === 'lobby' && onReadyChange && typeof readyState === 'boolean' && (
            <Button
              type="button"
              variant={readyState ? 'outline' : 'default'}
              className="mt-4 h-12 w-full gap-2"
              onClick={() => void runAction(() => onReadyChange(!readyState))}
              disabled={isWorking || !currentPlayer || currentPlayer.isSpectator}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">{readyState ? 'undo' : 'task_alt'}</span>
              {readyState ? 'Chưa sẵn sàng' : 'Tôi đã sẵn sàng'}
            </Button>
          )}

          {phase === 'lobby' && isHost && onLockChange && typeof isLocked === 'boolean' && (
            <Button type="button" variant="outline" className="mt-2 h-11 w-full gap-2" onClick={() => void runAction(() => onLockChange(!isLocked))} disabled={isWorking}>
              <span className="material-symbols-outlined text-lg" aria-hidden="true">{isLocked ? 'lock_open' : 'lock'}</span>
              {isLocked ? 'Mở phòng cho người mới' : 'Khóa người mới vào'}
            </Button>
          )}

          {(communicationMode !== undefined || onCommunicationModeChange) && (
            <fieldset className="mt-4 border-t border-border pt-4">
              <legend className="text-sm font-semibold text-foreground">Cách giao tiếp</legend>
              <p className="mt-1 text-xs text-muted-foreground">Đổi cách hiển thị cho bàn chơi; mặc định là chat từ xa.</p>
              <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Chế độ giao tiếp">
                <button type="button" aria-pressed={activeCommunicationMode === 'remote'} onClick={() => onCommunicationModeChange && void runAction(() => onCommunicationModeChange('remote'))} className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeCommunicationMode === 'remote' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`} disabled={isWorking || !onCommunicationModeChange}>
                  Chat từ xa
                </button>
                <button type="button" aria-pressed={activeCommunicationMode === 'inPerson'} onClick={() => onCommunicationModeChange && void runAction(() => onCommunicationModeChange('inPerson'))} className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeCommunicationMode === 'inPerson' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`} disabled={isWorking || !onCommunicationModeChange}>
                  Chơi trực tiếp
                </button>
              </div>
            </fieldset>
          )}
        </div>
      </div>

      {phase === 'ended' && rematch && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Chơi lại</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">{isRematchProposed ? 'Chủ phòng đang rủ chơi ván mới' : 'Mở một ván mới cùng phòng này'}</h2>
              {isRematchProposed && (
              <p className="mt-1 text-sm text-muted-foreground">{readyPlayerIds.length}/5 người đã sẵn sàng. Cần ít nhất 5 người để bắt đầu.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isRematchProposed && isHost && onProposeRematch && (
                <Button type="button" className="min-h-11" onClick={() => void runAction(onProposeRematch)} disabled={isWorking}>Đề xuất chơi lại</Button>
              )}
              {isRematchProposed && onRematchOptIn && !currentPlayer?.isSpectator && (
                <Button type="button" variant={currentPlayerOptedIn ? 'outline' : 'default'} className="min-h-11" onClick={() => void runAction(() => onRematchOptIn(!currentPlayerOptedIn))} disabled={isWorking}>
                  {currentPlayerOptedIn ? 'Rời ván mới' : 'Tham gia ván mới'}
                </Button>
              )}
              {isRematchProposed && isHost && onStartRematch && (
                <Button type="button" className="min-h-11" onClick={() => void runAction(onStartRematch)} disabled={isWorking || !canStartRematch}>
                  Bắt đầu ván mới
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
