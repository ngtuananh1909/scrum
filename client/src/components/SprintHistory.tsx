'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getAvatarUrl } from '@/lib/utils';

// Collapsible sidebar panel showing past sprints (proposed team + outcome).
export function SprintHistory() {
  const sprintHistory = useGameStore((s) => s.sprintHistory);
  const players = useGameStore((s) => s.players);
  const [open, setOpen] = useState(false);

  if (sprintHistory.length === 0) return null;

  const getName = (id: string) => players.find((p) => p.id === id)?.name || 'Unknown';

  return (
    <div className="border-b border-outline-variant">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 sm:px-6 py-3 flex items-center justify-between hover:bg-surface-container-high transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-muted-foreground">
            history
          </span>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Sprint History ({sprintHistory.length})
          </span>
        </div>
        <span
          className={`material-symbols-outlined text-base text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-6 pb-4 space-y-3 max-h-[40vh] overflow-y-auto">
          {sprintHistory
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.sprintIndex}
                className={`rounded-lg p-3 border ${
                  entry.outcome === 'success'
                    ? 'border-secondary/30 bg-secondary/5'
                    : 'border-error/30 bg-error/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    Sprint {entry.sprintIndex}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      entry.outcome === 'success'
                        ? 'bg-secondary/20 text-secondary'
                        : 'bg-error/20 text-error'
                    }`}
                  >
                    {entry.outcome === 'success' ? '✓ THÀNH CÔNG' : '✗ CHÁY DEADLINE'}
                  </span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Team ({entry.proposedTeam.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.proposedTeam.map((id) => (
                    <div
                      key={id}
                      className="flex items-center gap-1 bg-surface-container rounded-full pl-1 pr-2 py-0.5"
                      title={getName(id)}
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-outline">
                        <img
                          src={getAvatarUrl(getName(id))}
                          alt={getName(id)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] font-mono truncate max-w-[5rem]">
                        {getName(id)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}