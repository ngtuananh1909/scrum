'use client';

import { useEffect, useState } from 'react';

// Shared countdown component. Reads `phaseRemainingMs` from the Zustand store
// and renders a MM:SS label + progress bar that pulses red when < 5s.
export function TimerBar({
  remainingMs,
  totalMs,
  label,
  variant = 'neutral',
}: {
  remainingMs: number;
  totalMs: number;
  label: string;
  variant?: 'night' | 'planning' | 'teamVoting' | 'execution' | 'sprintResult' | 'discussion' | 'neutral';
}) {
  // Animate progress smoothly even though the store ticks every 500ms.
  const [animatedRemaining, setAnimatedRemaining] = useState(remainingMs);

  useEffect(() => {
    setAnimatedRemaining(remainingMs);
    if (remainingMs <= 0) return;
    const id = setInterval(() => {
      setAnimatedRemaining((r) => Math.max(0, r - 100));
    }, 100);
    return () => clearInterval(id);
  }, [remainingMs]);

  const seconds = Math.ceil(animatedRemaining / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, animatedRemaining / totalMs)) : 0;
  const lowTime = animatedRemaining > 0 && animatedRemaining < 5000;
  const expired = animatedRemaining <= 0;

  const accent =
    variant === 'night'
      ? 'border-primary/30'
      : variant === 'teamVoting'
      ? 'border-secondary/40'
      : variant === 'execution'
      ? 'border-error/40'
      : variant === 'sprintResult'
      ? 'border-warning/40'
      : variant === 'discussion'
      ? 'border-error/40'
      : 'border-outline';

  return (
    <div
      className={`glass-panel rounded-xl px-4 py-3 border-l-4 ${accent} ${
        expired ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span
          className={`font-mono font-bold text-lg tabular-nums ${
            expired
              ? 'text-error'
              : lowTime
              ? 'text-error animate-pulse'
              : 'text-foreground'
          }`}
        >
          {expired ? 'Hết giờ!' : `${mm}:${ss.toString().padStart(2, '0')}`}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-150 ${
            expired
              ? 'bg-error'
              : lowTime
              ? 'bg-error'
              : variant === 'night'
              ? 'bg-primary'
              : variant === 'teamVoting'
              ? 'bg-secondary'
              : variant === 'execution'
              ? 'bg-error'
              : 'bg-primary'
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}