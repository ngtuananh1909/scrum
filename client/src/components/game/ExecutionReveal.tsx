'use client';

export type ExecutionBallot = 'success' | 'fail';

/** The engine supplies already-shuffled, anonymous execution ballot faces. */
export function ExecutionReveal({
  ballots,
  outcome,
  failWeight,
}: {
  ballots: ExecutionBallot[];
  outcome: 'success' | 'fail';
  failWeight: number;
}) {
  const successCount = ballots.filter((ballot) => ballot === 'success').length;
  const failCount = ballots.length - successCount;
  const passed = outcome === 'success';

  return (
    <section className="glass-panel rounded-2xl p-4 sm:p-6" aria-labelledby="execution-reveal-title" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Phiếu đã được xáo trộn</p>
          <h2 id="execution-reveal-title" className={`mt-1 text-lg font-semibold ${passed ? 'text-secondary' : 'text-error'}`}>
            {passed ? 'Sprint thành công' : 'Sprint thất bại'}
          </h2>
        </div>
        <span className="rounded-full border border-outline-variant bg-surface-container/60 px-3 py-1.5 text-xs text-muted-foreground">
          {successCount} hoàn thành · {failCount} thất bại
        </span>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label="Các lá phiếu ẩn danh">
        {ballots.map((ballot, index) => {
          const success = ballot === 'success';
          return (
            <li
              key={`${index}-${ballot}`}
              className={`relative grid min-h-24 place-items-center overflow-hidden rounded-xl border p-3 text-center ${
                success ? 'border-secondary/30 bg-secondary/5' : 'border-error/30 bg-error/5'
              }`}
            >
              <span className="absolute left-3 top-2 text-[10px] font-mono text-muted-foreground">#{String(index + 1).padStart(2, '0')}</span>
              <span>
                <span className={`material-symbols-outlined block text-2xl ${success ? 'text-secondary' : 'text-error'}`} aria-hidden="true">
                  {success ? 'check_circle' : 'local_fire_department'}
                </span>
                <span className={`mt-1 block text-xs font-semibold ${success ? 'text-secondary' : 'text-error'}`}>
                  {success ? 'Hoàn thành' : 'Thất bại'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-outline-variant/70 pt-3 text-sm text-muted-foreground">
        Tổng trọng số phiếu thất bại: <strong className="font-mono text-foreground">{failWeight}</strong>
      </p>
    </section>
  );
}
