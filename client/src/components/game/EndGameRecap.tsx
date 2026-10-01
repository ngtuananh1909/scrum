'use client';

import { isGoodRole } from '@/lib/types';
import type { EndReason, Faction, GameRole, SprintRecord } from '@/game/types';
import { getAvatarUrl } from '@/lib/utils';

export interface EndGameRevealPlayer {
  id: string;
  name: string;
  role: GameRole | null;
}

const END_REASON_LABELS: Record<EndReason, string> = {
  threeFailedSprints: 'Phe Phá Dự Án đạt ba Sprint thất bại.',
  fourRejectedTeams: 'Bốn nhóm liên tiếp đã bị từ chối.',
  assassinationGuess: 'Phe Phá Dự Án đã hoàn tất lượt chỉ điểm cuối game.',
  assassinationDeadline: 'Hết giờ chỉ điểm nên Phe Scrum giữ chiến thắng.',
  fiveSprintTiebreak: 'Tỉ số được phân định ở Sprint thứ năm.',
};

export function EndGameRecap({
  winner,
  endReason,
  goodWins,
  badWins,
  players,
  sprintHistory = [],
  isLoading = false,
}: {
  winner: Faction;
  endReason?: EndReason | null;
  goodWins: number;
  badWins: number;
  players: EndGameRevealPlayer[];
  sprintHistory?: SprintRecord[];
  isLoading?: boolean;
}) {
  const goodWon = winner === 'good';

  return (
    <section className="space-y-4" aria-labelledby="endgame-recap-title">
      <div className={`glass-panel rounded-2xl p-5 sm:p-7 ${goodWon ? 'glow-green' : 'glow-red'}`}>
        <p className="text-xs text-muted-foreground">Kết thúc ván</p>
        <h2 id="endgame-recap-title" className={`mt-1 text-2xl font-bold tracking-tight sm:text-3xl ${goodWon ? 'text-secondary' : 'text-error'}`}>
          {goodWon ? 'Phe Scrum chiến thắng' : 'Phe phá dự án chiến thắng'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {(endReason && END_REASON_LABELS[endReason]) || 'Ván chơi đã kết thúc. Xem lại diễn biến và vai trò của cả đội.'}
        </p>
        <div className="mt-5 flex items-center gap-3" aria-label={`Tỉ số Scrum ${goodWins}, phe phá dự án ${badWins}`}>
          <span className="text-xs text-muted-foreground">Tỉ số</span>
          <span className="font-mono text-sm font-semibold text-secondary">Scrum {goodWins}</span>
          <span aria-hidden="true" className="text-muted-foreground">–</span>
          <span className="font-mono text-sm font-semibold text-error">Phá dự án {badWins}</span>
        </div>
      </div>

      {sprintHistory.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground">Diễn biến Sprint</h3>
          <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sprintHistory.map((sprint) => (
              <li key={sprint.sprintNumber} className="rounded-xl border border-outline-variant bg-surface-container/50 p-3">
                <span className="block text-xs text-muted-foreground">Sprint {sprint.sprintNumber}</span>
                <span className={`mt-1 block text-sm font-semibold ${sprint.outcome === 'success' ? 'text-secondary' : 'text-error'}`}>
                  {sprint.outcome === 'success' ? 'Thành công' : 'Thất bại'}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">Nhóm {sprint.teamIds.length} người</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Mở vai trò cả đội</h3>
            <p className="mt-1 text-xs text-muted-foreground">Chỉ hiện sau khi ván kết thúc.</p>
          </div>
          {isLoading && <span className="text-xs text-muted-foreground" role="status">Đang tải…</span>}
        </div>

        {players.length === 0 && !isLoading ? (
          <p className="mt-4 rounded-xl border border-outline-variant bg-surface-container/40 p-4 text-sm text-muted-foreground">
            Chưa tải được bảng vai trò. Hãy thử mở lại phần tổng kết.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Vai trò người chơi">
            {players.map((player) => {
              const good = player.role ? isGoodRole(player.role) : null;
              return (
                <li key={player.id} className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 ${good === true ? 'border-secondary/30 bg-secondary/5' : good === false ? 'border-error/30 bg-error/5' : 'border-outline-variant bg-surface-container/40'}`}>
                  <img src={getAvatarUrl(player.name)} alt="" className="h-9 w-9 shrink-0 rounded-full border border-outline-variant bg-surface-container object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">{player.name}</span>
                    <span className={`block truncate text-[11px] ${good === true ? 'text-secondary' : good === false ? 'text-error' : 'text-muted-foreground'}`}>
                      {player.role || 'Chưa có dữ liệu vai trò'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
