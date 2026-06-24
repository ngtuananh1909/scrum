'use client';

import { useGameStore } from '@/store/gameStore';
import { useEffect } from 'react';

// Auto-dismissing toast that shows private skill results (BA Yes/No, DA success/fail).
// Result lives only in client state — never persisted server-side.
export function SkillResultToast() {
  const baResult = useGameStore((s) => s.privateSkillResults.baCheck);
  const daResult = useGameStore((s) => s.privateSkillResults.daCheck);
  const players = useGameStore((s) => s.players);
  const clearBa = useGameStore((s) => s.clearPrivateBaResult);
  const clearDa = useGameStore((s) => s.clearPrivateDaResult);

  useEffect(() => {
    if (baResult) {
      const t = setTimeout(clearBa, 12000);
      return () => clearTimeout(t);
    }
  }, [baResult, clearBa]);

  useEffect(() => {
    if (daResult) {
      const t = setTimeout(clearDa, 12000);
      return () => clearTimeout(t);
    }
  }, [daResult, clearDa]);

  if (!baResult && !daResult) return null;

  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-3 max-w-sm">
      {baResult && (
        <div
          className={`glass-panel rounded-xl p-4 border-2 ${
            baResult === 'Yes' ? 'border-error bg-error/10' : 'border-secondary bg-secondary/10'
          } shadow-[0_0_30px_var(--toast-shadow)]`}
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">search_check</span>
            <div className="flex-1">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Business Analyst Check
              </p>
              <p
                className={`text-2xl font-bold ${
                  baResult === 'Yes' ? 'text-error' : 'text-secondary'
                }`}
              >
                {baResult === 'Yes' ? 'Có phe Phá Dự Án' : 'Không có phe xấu'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {baResult === 'Yes'
                  ? 'Ít nhất 1 trong 2 người bạn chọn thuộc phe xấu.'
                  : 'Cả 2 người bạn chọn đều thuộc Scrum Team.'}
              </p>
            </div>
            <button
              onClick={clearBa}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}
      {daResult && (
        <div
          className={`glass-panel rounded-xl p-4 border-2 ${
            daResult.result === 'fail' ? 'border-error bg-error/10' : 'border-secondary bg-secondary/10'
          } shadow-[0_0_30px_var(--toast-shadow)]`}
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">analytics</span>
            <div className="flex-1">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Data Analyst Check
              </p>
              <p
                className={`text-2xl font-bold ${
                  daResult.result === 'fail' ? 'text-error' : 'text-secondary'
                }`}
              >
                {daResult.result === 'fail' ? 'Vote: Cháy Deadline' : 'Vote: Hoàn thành'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {players.find((p) => p.id === daResult.targetId)?.name ?? 'Unknown'} đã vote{' '}
                <strong>{daResult.result === 'fail' ? 'Không hoàn thành' : 'Hoàn thành'}</strong>{' '}
                ở Sprint trước.
              </p>
            </div>
            <button
              onClick={clearDa}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
