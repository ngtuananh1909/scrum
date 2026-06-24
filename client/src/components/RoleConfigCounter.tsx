'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ROLES, type RoleConfig, type PlayerRole, isMultiInstance, totalSelected, canStart } from '@/lib/types';

// Lobby role selection UI. Toggle for single-instance roles; +/- counter for Developer / Người trễ task.
// PO can only start when totalSelected === players.length.
export function RoleConfigCounter({
  onStart,
}: {
  onStart: (selectedRoles: string[]) => void;
}) {
  const players = useGameStore((s) => s.players);
  const roleConfig = useGameStore((s) => s.roleConfig);
  const setRoleConfig = useGameStore((s) => s.setRoleConfig);

  const [showDescription, setShowDescription] = useState<PlayerRole | null>(null);
  void showDescription;

  const adjust = (role: PlayerRole, delta: number) => {
    const current = roleConfig.counts[role] ?? 0;
    let next = current + delta;
    if (next < 0) next = 0;
    if (!isMultiInstance(role) && next > 1) next = 1;
    if (totalSelected(roleConfig) - current + next > players.length) return;
    const counts = { ...roleConfig.counts, [role]: next };
    if (next === 0) delete counts[role];
    setRoleConfig({ counts });
  };

  const total = totalSelected(roleConfig);
  const startEnabled = canStart(roleConfig, players.length);

  const handleStart = () => {
    if (!startEnabled) return;
    const flat: string[] = [];
    for (const [role, n] of Object.entries(roleConfig.counts)) {
      for (let i = 0; i < (n ?? 0); i++) flat.push(role);
    }
    onStart(flat);
  };

  const handleAutoRandom = () => {
    onStart([]); // server falls back to default 60/40 pool
  };

  const renderRoleCard = (role: PlayerRole, isGood: boolean) => {
    const count = roleConfig.counts[role] ?? 0;
    const multi = isMultiInstance(role);
    const borderColor = count > 0 ? (isGood ? 'border-secondary' : 'border-error') : 'border-outline';
    const bgColor = count > 0 ? (isGood ? 'bg-secondary/10' : 'bg-error/10') : 'bg-surface-container-high';
    const textColor = count > 0 ? (isGood ? 'text-secondary' : 'text-error') : 'text-muted-foreground';

    return (
      <div
        key={role}
        className={`rounded-lg p-3 border-2 transition-all ${borderColor} ${bgColor}`}
        onMouseEnter={() => setShowDescription(role)}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className={`text-sm font-mono font-semibold ${textColor} flex-1 truncate`}>{role}</p>
          {multi && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              ×N
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => adjust(role, -1)}
            disabled={count === 0}
            className="w-7 h-7 rounded-md border border-outline text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Decrease ${role}`}
          >
            −
          </button>
          <span className={`text-xl font-mono font-bold tabular-nums ${textColor}`}>{count}</span>
          <button
            onClick={() => adjust(role, +1)}
            disabled={!multi && count >= 1}
            className="w-7 h-7 rounded-md border border-outline text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Increase ${role}`}
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
            Cấu hình vai trò
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Developer & Người trễ task có thể chọn nhiều, vai khác giới hạn 1.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`text-2xl font-mono font-bold tabular-nums ${
              total === players.length ? 'text-secondary' : 'text-foreground'
            }`}
          >
            {total} / {players.length}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-secondary mb-2">
            Phe Scrum Team (Tốt)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ROLES.GOOD.map((r) => renderRoleCard(r as PlayerRole, true))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-error mb-2">
            Phe Phá Dự Án (Xấu)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ROLES.BAD.map((r) => renderRoleCard(r as PlayerRole, false))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <button
          onClick={handleAutoRandom}
          className="flex-1 py-3 rounded-lg border border-outline text-muted-foreground hover:border-primary hover:text-primary font-mono text-sm uppercase tracking-wider"
        >
          Random 60/40
        </button>
        <button
          onClick={handleStart}
          disabled={!startEnabled}
          className={`flex-1 py-3 rounded-lg font-semibold tracking-wide text-sm uppercase ${
            startEnabled
              ? 'bg-primary-container text-primary-foreground border border-primary/50 shadow-[0_0_15px_var(--row-glow-primary)] hover:shadow-[0_0_25px_var(--row-glow-primary)]'
              : 'bg-surface-container-high text-muted-foreground border border-outline opacity-50 cursor-not-allowed'
          }`}
        >
          <span className="material-symbols-outlined mr-2 align-middle text-base">play_arrow</span>
          Bắt đầu Sprint 1
        </button>
      </div>
    </div>
  );
}

export function defaultRoleConfig(): RoleConfig {
  return { counts: {} };
}
