'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { getAvatarUrl } from '@/lib/utils';
import type { Player } from '@/lib/types';

interface SkillModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  // Players to choose from; defaults to all players except self.
  candidates?: Player[];
  // Number of targets to pick. 0 = confirm-only modal (no picker).
  pickCount: number;
  confirmLabel: string;
  // Called with the picked ids. For pickCount=0 the array is [].
  onConfirm: (targetIds: string[]) => Promise<void> | void;
  // Optional accent color: 'good' green, 'bad' red, 'neutral' primary.
  accent?: 'good' | 'bad' | 'neutral';
}

export function SkillModal({
  open,
  onClose,
  title,
  description,
  candidates,
  pickCount,
  confirmLabel,
  onConfirm,
  accent = 'neutral',
}: SkillModalProps) {
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const choices = candidates ?? players.filter((p) => p.id !== playerId);

  const accentBorder =
    accent === 'good'
      ? 'border-secondary'
      : accent === 'bad'
      ? 'border-error'
      : 'border-primary';
  const accentBg =
    accent === 'good'
      ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
      : accent === 'bad'
      ? 'bg-error text-error-foreground hover:bg-error/90'
      : 'bg-primary-container text-primary-foreground hover:bg-primary/80';

  const toggle = (id: string) => {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
      return;
    }
    if (picked.length >= pickCount) {
      // Replace oldest for pickCount=1; for multi, drop first.
      if (pickCount === 1) setPicked([id]);
      else setPicked([...picked.slice(1), id]);
      return;
    }
    setPicked([...picked, id]);
  };

  const handleConfirm = async () => {
    if (pickCount > 0 && picked.length !== pickCount) return;
    setBusy(true);
    try {
      await onConfirm(pickCount === 0 ? [] : picked);
      setPicked([]);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const enabled = pickCount === 0 ? !busy : picked.length === pickCount && !busy;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={!busy} className="sm:max-w-lg max-w-[calc(100%-1rem)]">
        <div className="flex flex-col gap-4 py-2">
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>

          {pickCount > 0 && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Đã chọn {picked.length} / {pickCount}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[45vh] overflow-y-auto">
                {choices.map((p) => {
                  const selected = picked.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                        selected
                          ? `${accentBorder} bg-primary/10`
                          : 'border-outline hover:border-primary/50'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden">
                        <img
                          src={getAvatarUrl(p.name)}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-[10px] font-mono truncate w-full text-center">{p.name}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy} className="flex-1">
              Hủy
            </Button>
            <Button onClick={handleConfirm} disabled={!enabled} className={`flex-1 ${accentBg}`}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
