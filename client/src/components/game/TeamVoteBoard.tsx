'use client';

export interface PublicPlayerName {
  id: string;
  name: string;
}

export type TeamVoteBoardState =
  | {
      kind: 'voting';
      players: PublicPlayerName[];
      eligibleIds: string[];
      submittedIds: string[];
      pendingIds: string[];
      silencedIds?: string[];
      viewerId?: string | null;
    }
  | {
      kind: 'reveal';
      players: PublicPlayerName[];
      choices: Record<string, 'approve' | 'reject'>;
      accepted: boolean;
      approveWeight: number;
      rejectWeight: number;
    };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN');
}

/** A sealed ballot board during voting and one simultaneous public reveal afterward. */
export function TeamVoteBoard({ state }: { state: TeamVoteBoardState }) {
  if (state.kind === 'voting') {
    const submitted = new Set(state.submittedIds);
    const pending = new Set(state.pendingIds);
    const silenced = new Set(state.silencedIds || []);
    const voters = state.players.filter((player) => state.eligibleIds.includes(player.id));

    return (
      <section className="glass-panel rounded-2xl p-4 sm:p-5" aria-labelledby="team-vote-status-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="team-vote-status-title" className="text-base font-semibold text-foreground">Phiếu đang được niêm phong</h2>
            <p className="mt-1 text-xs text-muted-foreground">Lựa chọn của từng người chỉ hiện cùng lúc sau khi cuộc bỏ phiếu kết thúc.</p>
          </div>
          <span className="shrink-0 rounded-full border border-outline-variant bg-surface-container/60 px-2.5 py-1 text-xs font-mono text-muted-foreground">
            {submitted.size}/{voters.length} đã bỏ phiếu
          </span>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Trạng thái bỏ phiếu">
          {voters.map((player) => {
            const hasVoted = submitted.has(player.id);
            const isPending = pending.has(player.id);
            const isSilenced = silenced.has(player.id);
            const status = isSilenced
              ? 'Không thể bỏ phiếu'
              : hasVoted
                ? 'Đã bỏ phiếu'
                : isPending
                  ? 'Đang chờ'
                  : 'Không tham gia';
            return (
              <li
                key={player.id}
                className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 ${
                  hasVoted
                    ? 'border-secondary/30 bg-secondary/5'
                    : isSilenced
                      ? 'border-outline-variant bg-surface-container/30 opacity-70'
                      : 'border-outline-variant bg-surface-container/50'
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-container-high text-[10px] font-semibold text-foreground" aria-hidden="true">
                  {initials(player.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {player.name}{player.id === state.viewerId ? ' (bạn)' : ''}
                  </span>
                  <span className={`block text-[11px] ${hasVoted ? 'text-secondary' : 'text-muted-foreground'}`}>
                    {status}
                  </span>
                </span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${hasVoted ? 'bg-secondary' : isSilenced ? 'bg-muted-foreground' : 'bg-outline'}`} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const playersById = new Map(state.players.map((player) => [player.id, player]));
  const choices = Object.entries(state.choices).map(([playerId, choice]) => ({
    player: playersById.get(playerId),
    choice,
  }));
  const approveCount = choices.filter(({ choice }) => choice === 'approve').length;
  const rejectCount = choices.length - approveCount;

  return (
    <section className="glass-panel rounded-2xl p-4 sm:p-5" aria-labelledby="team-vote-reveal-title" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Phiếu được mở đồng thời</p>
          <h2 id="team-vote-reveal-title" className="mt-1 text-lg font-semibold text-foreground">
            {state.accepted ? 'Nhóm được duyệt' : 'Nhóm chưa được duyệt'}
          </h2>
        </div>
        <div className="flex gap-2 text-xs font-medium">
          <span className="rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1.5 text-secondary">Hiệu lực đồng ý {state.approveWeight}</span>
          <span className="rounded-full border border-error/30 bg-error/10 px-3 py-1.5 text-error">Hiệu lực từ chối {state.rejectWeight}</span>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{approveCount + rejectCount} người đã bỏ phiếu; kỹ năng có thể đổi trọng số.</p>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Lựa chọn của từng người">
        {choices.map(({ player, choice }, index) => {
          const approve = choice === 'approve';
          return (
            <li
              key={player?.id || index}
              className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 ${approve ? 'border-secondary/30 bg-secondary/5' : 'border-error/30 bg-error/5'}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-container-high text-[10px] font-semibold text-foreground" aria-hidden="true">
                {player ? initials(player.name) : '?'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">{player?.name || 'Người chơi'}</span>
                <span className={`block text-xs font-semibold ${approve ? 'text-secondary' : 'text-error'}`}>
                  {approve ? 'Đồng ý' : 'Từ chối'}
                </span>
              </span>
              <span className={`material-symbols-outlined text-lg ${approve ? 'text-secondary' : 'text-error'}`} aria-hidden="true">
                {approve ? 'check_circle' : 'cancel'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
