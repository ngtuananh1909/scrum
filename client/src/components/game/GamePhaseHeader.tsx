'use client';

export type GameConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

const CONNECTION_LABELS: Record<GameConnectionState, string> = {
  connecting: 'Đang kết nối',
  connected: 'Đã kết nối',
  reconnecting: 'Đang đồng bộ lại',
  offline: 'Mất kết nối',
};

const CONNECTION_STYLES: Record<GameConnectionState, string> = {
  connecting: 'border-primary/30 bg-primary/10 text-primary',
  connected: 'border-secondary/30 bg-secondary/10 text-secondary',
  reconnecting: 'border-primary/30 bg-primary/10 text-primary',
  offline: 'border-error/30 bg-error/10 text-error',
};

export function ConnectionStatus({ status }: { status: GameConnectionState }) {
  return (
    <span
      role="status"
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium ${CONNECTION_STYLES[status]}`}
      aria-label={`Trạng thái kết nối: ${CONNECTION_LABELS[status]}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          status === 'connected'
            ? 'bg-secondary'
            : status === 'offline'
              ? 'bg-error'
              : 'bg-primary'
        } ${status === 'reconnecting' ? 'animate-pulse' : ''}`}
      />
      <span className="hidden sm:inline">{CONNECTION_LABELS[status]}</span>
    </span>
  );
}

function formatTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface GamePhaseHeaderProps {
  roomId: string;
  phaseLabel: string;
  title: string;
  instruction: string;
  sprintNumber: number;
  totalSprints: number;
  goodWins: number;
  badWins: number;
  remainingMs?: number | null;
  totalMs?: number | null;
  timerLabel?: string;
  connectionStatus: GameConnectionState;
}

/** The active phase, time remaining, score, and connection stay visible above the board. */
export function GamePhaseHeader({
  roomId,
  phaseLabel,
  title,
  instruction,
  sprintNumber,
  totalSprints,
  goodWins,
  badWins,
  remainingMs,
  totalMs,
  timerLabel,
  connectionStatus,
}: GamePhaseHeaderProps) {
  const sprint = Math.min(totalSprints, Math.max(1, sprintNumber));
  const timerProgress =
    remainingMs != null && totalMs != null && totalMs > 0
      ? Math.max(0, Math.min(1, remainingMs / totalMs))
      : null;
  const urgent = remainingMs != null && remainingMs <= 10_000;

  return (
    <header className="phase-banner mx-auto w-full max-w-5xl rounded-2xl border border-outline-variant px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{phaseLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Phòng {roomId}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        </div>
        <ConnectionStatus status={connectionStatus} />
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{instruction}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/70 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-3" aria-label={`Tiến độ Sprint ${sprint} trên ${totalSprints}`}>
          <span className="shrink-0 text-xs font-medium text-foreground">Sprint {sprint}/{totalSprints}</span>
          <div className="flex min-w-20 flex-1 gap-1.5" aria-hidden="true">
            {Array.from({ length: totalSprints }, (_, index) => {
              const result = index < goodWins ? 'good' : index < goodWins + badWins ? 'bad' : 'pending';
              return (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${
                    result === 'good' ? 'bg-secondary' : result === 'bad' ? 'bg-error' : 'bg-surface-container-high'
                  }`}
                />
              );
            })}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            <span className="text-secondary">{goodWins}</span>
            <span aria-hidden="true"> – </span>
            <span className="text-error">{badWins}</span>
          </span>
        </div>

        {remainingMs != null && (
          <div
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 ${
              urgent ? 'border-error/40 bg-error/10 text-error' : 'border-outline-variant bg-surface-container/70 text-foreground'
            }`}
            role="timer"
            aria-label={`${timerLabel || 'Còn lại'} ${formatTime(remainingMs)}`}
          >
            <span className="text-xs text-muted-foreground">{timerLabel || 'Còn lại'}</span>
            <span className="font-mono text-sm font-semibold tabular-nums">{formatTime(remainingMs)}</span>
          </div>
        )}
      </div>

      {timerProgress != null && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
          <div
            className={`h-full rounded-full ${urgent ? 'bg-error' : 'bg-primary'} motion-safe:transition-[width] motion-safe:duration-500`}
            style={{ width: `${timerProgress * 100}%` }}
          />
        </div>
      )}
    </header>
  );
}
