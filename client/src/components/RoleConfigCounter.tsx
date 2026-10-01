'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { GameRole } from '@/game/types';
import type { PresetMode } from '@/game/presets';
import { isRoleSetValid } from '@/game/presets';
import { ROLE_DESCRIPTIONS, ROLES, type PlayerRole } from '@/lib/types';
import {
  customRoleSelectionError,
  roleConfigFromRoles,
  rolesFromRoleConfig,
} from '@/components/lobby/roleSelection';
import { Button } from '@/components/ui/button';

export type LobbyRolePreset = PresetMode;

export interface LobbyRolePreview {
  preset: LobbyRolePreset;
  roles: GameRole[];
}

export interface RoleConfigCounterProps {
  onStart: (roles: GameRole[]) => void;
  rolePreview?: LobbyRolePreview | null;
  isHost?: boolean;
  isBusy?: boolean;
  serverError?: string | null;
  onSelectPreset?: (preset: LobbyRolePreset, roles?: GameRole[]) => void | Promise<void>;
  onRerollPreset?: () => void | Promise<void>;
}

const PRESET_DETAILS: Array<{
  id: LobbyRolePreset;
  name: string;
  note: string;
}> = [
  { id: 'beginner', name: 'Cơ bản', note: 'Vai trò dễ nắm cho bàn mới.' },
  { id: 'classic', name: 'Kinh điển', note: 'Đội hình quen thuộc, dễ đọc thế trận.' },
  { id: 'advanced', name: 'Nâng cao', note: 'Kết hợp nhiều kỹ năng cần phối hợp.' },
  { id: 'chaos', name: 'Hỗn loạn', note: 'Mỗi lần đổi sẽ có đội hình ngẫu nhiên.' },
  { id: 'custom', name: 'Tùy chỉnh', note: 'Tự chọn vai trò cho từng phe.' },
];

export function RoleConfigCounter({
  onStart,
  rolePreview: rolePreviewProp,
  isHost: isHostProp,
  isBusy = false,
  serverError: serverErrorProp,
  onSelectPreset,
  onRerollPreset,
}: RoleConfigCounterProps) {
  const players = useGameStore((state) => state.players);
  const publicState = useGameStore((state) => state.publicState);
  const storedRolePreview = publicState && 'rolePreview' in publicState ? publicState.rolePreview : null;
  const storedRolePreset = useGameStore((state) => state.rolePreset);
  const storeIsHost = useGameStore((state) => state.isHost);
  const storeError = useGameStore((state) => state.error);
  const roleConfig = useGameStore((state) => state.roleConfig);
  const setRoleConfig = useGameStore((state) => state.setRoleConfig);
  const setRolePreset = useGameStore((state) => state.setRolePreset);
  const rerollRolePreset = useGameStore((state) => state.rerollRolePreset);
  const clearStoreError = useGameStore((state) => state.clearError);
  const [isSaving, setIsSaving] = useState(false);
  const [customDirty, setCustomDirty] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const rolePreview = rolePreviewProp === undefined ? storedRolePreview : rolePreviewProp;
  const selectPreset = onSelectPreset ?? setRolePreset;
  const rerollPreset = onRerollPreset ?? rerollRolePreset;
  const isHost = isHostProp ?? storeIsHost;
  const serverError = serverErrorProp ?? storeError;
  const selectedPreset = rolePreview?.preset ?? storedRolePreset ?? 'custom';
  const previewRoles = rolePreview?.roles ?? [];
  const playerCount = players.filter((player) => !player.isSpectator).length;
  const goodTarget = Math.ceil(playerCount * 0.6);
  const badTarget = playerCount - goodTarget;
  const customRoles = useMemo(() => rolesFromRoleConfig(roleConfig), [roleConfig]);
  const visibleRoles = selectedPreset === 'custom' && customDirty ? customRoles : previewRoles;
  const selectionError = customRoleSelectionError(visibleRoles, playerCount);
  const previewIsValid = visibleRoles.length === playerCount && isRoleSetValid(visibleRoles, playerCount);
  const canStart = isHost && playerCount >= 5 && playerCount <= 10 && previewIsValid && !selectionError && !customDirty && !isBusy && !isSaving;
  const handleStart = () => onStart([]);

  useEffect(() => {
    if (selectedPreset === 'custom' && rolePreview?.roles && !customDirty) {
      setRoleConfig(roleConfigFromRoles(rolePreview.roles));
    }
  }, [selectedPreset, rolePreview?.roles, customDirty, setRoleConfig]);

  const savePreset = async (preset: LobbyRolePreset, roles?: GameRole[]) => {
    if (!isHost || isBusy || isSaving) return;
    setIsSaving(true);
    setLocalError(null);
    clearStoreError();
    try {
      await selectPreset(preset, roles);
      const actionError = useGameStore.getState().error;
      if (actionError) throw new Error(actionError);
      setCustomDirty(false);
    } catch {
      setLocalError(useGameStore.getState().error || 'Không thể lưu cấu hình vai trò. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const choosePreset = async (preset: LobbyRolePreset) => {
    if (preset === 'custom') {
      const initialRoles = previewRoles.length === playerCount
        ? previewRoles
        : customRoles;
      setRoleConfig(roleConfigFromRoles(initialRoles));
      setCustomDirty(false);
      await savePreset('custom', initialRoles);
      return;
    }
    await savePreset(preset);
  };

  const reroll = async () => {
    if (!isHost || isBusy || isSaving) return;
    setIsSaving(true);
    setLocalError(null);
    clearStoreError();
    try {
      await rerollPreset();
      const actionError = useGameStore.getState().error;
      if (actionError) throw new Error(actionError);
    } catch {
      setLocalError(useGameStore.getState().error || 'Không thể đổi đội hình ngẫu nhiên. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const adjust = (role: PlayerRole, delta: number) => {
    if (!isHost || isBusy || isSaving) return;
    const current = roleConfig.counts[role] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    if (role !== 'Developer' && next > 1) return;
    if ((role === 'Scrum Master' || role === 'Người trễ task') && next !== 1) return;

    const total = customRoles.length - current + next;
    if (total > playerCount) return;
    const isGoodRole = (ROLES.GOOD as readonly string[]).includes(role);
    const currentFactionTotal = customRoles.filter((selected) =>
      (ROLES.GOOD as readonly string[]).includes(selected) === isGoodRole,
    ).length;
    const factionTarget = isGoodRole ? goodTarget : badTarget;
    if (currentFactionTotal - current + next > factionTarget) return;

    const counts = { ...roleConfig.counts, [role]: next };
    if (next === 0) delete counts[role];
    setRoleConfig({ counts });
    setCustomDirty(true);
    setLocalError(null);
  };

  const selectedRoleCounts = useMemo(() => {
    const counts = new Map<GameRole, number>();
    for (const role of visibleRoles) counts.set(role, (counts.get(role) ?? 0) + 1);
    return counts;
  }, [visibleRoles]);
  const goodPreview = visibleRoles.filter((role) => (ROLES.GOOD as readonly string[]).includes(role));
  const badPreview = visibleRoles.filter((role) => (ROLES.BAD as readonly string[]).includes(role));
  const hasRandomPreview = selectedPreset === 'advanced' || selectedPreset === 'chaos';
  const canReroll = hasRandomPreview && isHost && !isBusy && !isSaving;

  const renderRoleCard = (role: PlayerRole, good: boolean) => {
    const count = roleConfig.counts[role] ?? 0;
    const factionTotal = customRoles.filter((selected) =>
      (ROLES.GOOD as readonly string[]).includes(selected) === good,
    ).length;
    const factionTarget = good ? goodTarget : badTarget;
    const isRequired = role === 'Scrum Master' || role === 'Người trễ task';
    const mayAdd = role === 'Developer' || count === 0;
    const canDecrease = count > 0 && !isRequired;
    const canIncrease = mayAdd && factionTotal < factionTarget && customRoles.length < playerCount;
    const color = good ? 'text-secondary' : 'text-error';
    const border = count > 0 ? (good ? 'border-secondary/50' : 'border-error/50') : 'border-border';
    const background = count > 0 ? (good ? 'bg-secondary/5' : 'bg-error/5') : 'bg-background';

    return (
      <div key={role} title={ROLE_DESCRIPTIONS[role]} className={`min-w-0 rounded-xl border p-3 transition-colors ${border} ${background}`}>
        <div className="flex min-h-10 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`truncate text-sm font-semibold ${count > 0 ? color : 'text-foreground'}`}>{role}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{isRequired ? 'Bắt buộc ×1' : role === 'Developer' ? 'Có thể chọn nhiều' : 'Tối đa ×1'}</p>
          </div>
          <span className={`min-w-6 text-right font-mono text-lg font-bold tabular-nums ${color}`}>{count}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => adjust(role, -1)} disabled={!canDecrease || !isHost || isBusy || isSaving} aria-label={`Bớt vai ${role}`} className="min-h-10 rounded-lg border border-border text-lg font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40">−</button>
          <button type="button" onClick={() => adjust(role, 1)} disabled={!canIncrease || !isHost || isBusy || isSaving} aria-label={`Thêm vai ${role}`} className="min-h-10 rounded-lg border border-border text-lg font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40">+</button>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="role-config-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Chuẩn bị ván chơi</p>
          <h2 id="role-config-title" className="mt-1 text-xl font-bold text-foreground">Chọn đội hình vai trò</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">Xem trước vai trò trước khi bắt đầu. Máy chủ sẽ xáo và gán vai khi chủ phòng bắt đầu ván.</p>
        </div>
        <div className="flex shrink-0 items-baseline gap-2 font-mono tabular-nums">
          <span className={`text-2xl font-bold ${previewIsValid ? 'text-secondary' : 'text-foreground'}`}>{visibleRoles.length}</span>
          <span className="text-sm text-muted-foreground">/ {playerCount} vai</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PRESET_DETAILS.map((preset) => {
          const active = selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => void choosePreset(preset.id)}
              disabled={!isHost || isBusy || isSaving || preset.id === selectedPreset}
              className={`min-h-24 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70 ${active ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}
            >
              <span className={`block text-sm font-bold ${active ? 'text-primary' : 'text-foreground'}`}>{preset.name}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{preset.note}</span>
            </button>
          );
        })}
      </div>

      {selectedPreset === 'custom' && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Tự chọn vai</h3>
              <p className="mt-1 text-xs text-muted-foreground">Một Scrum Master, một Người trễ task; phe tốt chiếm {goodTarget} người ở bàn {playerCount} người.</p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{customRoles.length}/{playerCount} đã chọn</span>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-secondary">Phe Scrum · {customRoles.filter((role) => (ROLES.GOOD as readonly string[]).includes(role)).length}/{goodTarget}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ROLES.GOOD.map((role) => renderRoleCard(role as PlayerRole, true))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-error">Phe Phá Dự Án · {customRoles.filter((role) => (ROLES.BAD as readonly string[]).includes(role)).length}/{badTarget}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ROLES.BAD.map((role) => renderRoleCard(role as PlayerRole, false))}
            </div>
          </div>
          {customDirty && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Đội hình đang chỉnh chỉ hiển thị trên máy này cho đến khi lưu.</p>
              <Button type="button" className="min-h-11 shrink-0" onClick={() => void savePreset('custom', customRoles)} disabled={!isHost || isBusy || isSaving || Boolean(customRoleSelectionError(customRoles, playerCount))}>
                {isSaving ? 'Đang lưu…' : 'Lưu đội hình'}
              </Button>
            </div>
          )}
        </div>
      )}

      {selectedPreset !== 'custom' && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Bản xem trước · {playerCount} người</h3>
              <p className="mt-1 text-xs text-muted-foreground">Chỉ chủ phòng đổi được đội hình. Vai thật được gán ngẫu nhiên khi bắt đầu.</p>
            </div>
            {canReroll && (
              <Button type="button" variant="outline" className="min-h-11 shrink-0 gap-2" onClick={() => void reroll()} disabled={isSaving}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">shuffle</span>
                {isSaving ? 'Đang đổi…' : 'Đổi đội hình'}
              </Button>
            )}
          </div>
          {previewRoles.length === playerCount ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-secondary/25 bg-secondary/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-secondary">Phe Scrum · {goodPreview.length}</h4>
                  <span className="text-xs text-muted-foreground">Mục tiêu {goodTarget}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {[...selectedRoleCounts.entries()].filter(([role]) => (ROLES.GOOD as readonly string[]).includes(role)).map(([role, count]) => (
                    <li key={role} className="flex justify-between gap-3 text-sm text-foreground"><span>{role}</span><span className="font-mono font-semibold tabular-nums">×{count}</span></li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-error/25 bg-error/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-error">Phe Phá Dự Án · {badPreview.length}</h4>
                  <span className="text-xs text-muted-foreground">Mục tiêu {badTarget}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {[...selectedRoleCounts.entries()].filter(([role]) => (ROLES.BAD as readonly string[]).includes(role)).map(([role, count]) => (
                    <li key={role} className="flex justify-between gap-3 text-sm text-foreground"><span>{role}</span><span className="font-mono font-semibold tabular-nums">×{count}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground" aria-live="polite">
              {playerCount < 5 ? 'Cần ít nhất 5 người để xem đội hình.' : isSaving ? 'Đang tạo bản xem trước…' : 'Đang chờ chủ phòng chọn đội hình.'}
            </div>
          )}
        </div>
      )}

      {(selectionError || serverError || localError) && (
        <p className="mt-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error" role="alert">
          {serverError || localError || selectionError}
        </p>
      )}

      {playerCount < 5 && <p className="mt-4 text-center text-sm text-muted-foreground">Cần ít nhất 5 người để bắt đầu.</p>}
      {playerCount > 10 && <p className="mt-4 text-center text-sm text-error">Phòng đã đủ giới hạn 10 người.</p>}

      {isHost && (
        <Button type="button" className="mt-5 h-12 w-full gap-2 text-sm font-semibold" onClick={handleStart} disabled={!canStart}>
          <span className="material-symbols-outlined text-xl" aria-hidden="true">play_arrow</span>
          {isBusy ? 'Đang chuẩn bị ván…' : 'Bắt đầu ván'}
        </Button>
      )}
      {!isHost && <p className="mt-5 text-center text-sm text-muted-foreground">Chờ chủ phòng bắt đầu ván.</p>}
    </section>
  );
}
