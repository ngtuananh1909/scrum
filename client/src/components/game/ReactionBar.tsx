'use client';

import { useState } from 'react';
import type { PublicPlayer } from '@/game';

type ReactionEmoji = '🤨' | '😂' | '💀' | '🔥' | '👀' | '🤡';
type ReactionTarget = 'player' | 'proposal' | 'sprintResult';

const EMOJIS: ReactionEmoji[] = ['🤨', '😂', '💀', '🔥', '👀', '🤡'];

export function ReactionBar({ players, proposalAvailable, resultAvailable, onReact }: {
  players: PublicPlayer[];
  proposalAvailable: boolean;
  resultAvailable: boolean;
  onReact: (emoji: ReactionEmoji, targetType: ReactionTarget, targetPlayerId?: string) => void;
}) {
  const [selected, setSelected] = useState('');
  const options = [
    ...(proposalAvailable ? [{ value: 'proposal', label: 'Đề xuất đội', type: 'proposal' as const }] : []),
    ...(resultAvailable ? [{ value: 'sprintResult', label: 'Kết quả Sprint', type: 'sprintResult' as const }] : []),
    ...players.map((player) => ({ value: `player:${player.id}`, label: player.name, type: 'player' as const, playerId: player.id })),
  ];
  const target = options.find((option) => option.value === selected) ?? options[0];
  if (!target) return null;

  return (
    <div className="border-b border-outline-variant p-3" role="group" aria-label="Cảm xúc trong phòng">
      <label className="block text-xs font-medium text-muted-foreground" htmlFor="reaction-target">Đối tượng cảm xúc</label>
      <select
        id="reaction-target"
        value={target.value}
        onChange={(event) => setSelected(event.target.value)}
        className="mt-1 min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Gửi ${emoji} cho ${target.label}`}
            onClick={() => onReact(emoji, target.type, 'playerId' in target ? target.playerId : undefined)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-outline-variant bg-surface-container text-lg transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
