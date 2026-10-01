'use client';

import { ROLE_DESCRIPTIONS, ROLE_SKILLS, type PlayerRole } from '@/lib/types';
import type { GameRole } from '@/game/types';

interface KnownRole {
  playerId: string;
  role: GameRole;
}

/** Private, viewer-scoped guidance. Never accepts or renders the TTS follow target. */
export function RoleGuidance({
  role,
  faction,
  knownRoles = [],
  players = [],
}: {
  role: GameRole | null;
  faction: 'good' | 'bad' | null;
  knownRoles?: KnownRole[];
  players?: Array<{ id: string; name: string }>;
}) {
  if (!role) return null;

  const skill = ROLE_SKILLS[role as PlayerRole];
  const description = ROLE_DESCRIPTIONS[role as PlayerRole];
  const nameById = new Map(players.map((player) => [player.id, player.name]));

  return (
    <section className="glass-panel rounded-2xl p-4" aria-labelledby="role-guidance-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Chỉ bạn nhìn thấy</p>
          <h2 id="role-guidance-title" className={`mt-1 text-base font-semibold ${faction === 'bad' ? 'text-error' : 'text-secondary'}`}>
            {role}
          </h2>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] ${faction === 'bad' ? 'border-error/30 bg-error/10 text-error' : 'border-secondary/30 bg-secondary/10 text-secondary'}`}>
          {faction === 'bad' ? 'Phe phá dự án' : 'Phe Scrum'}
        </span>
      </div>

      {description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>}

      {skill && (
        <div className="mt-4 border-t border-outline-variant/70 pt-3">
          <p className="text-xs font-medium text-primary">{skill.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{skill.effect}</p>
          {skill.trigger && <p className="mt-2 text-[11px] text-muted-foreground">{skill.trigger}</p>}
        </div>
      )}

      {knownRoles.length > 0 && (
        <div className="mt-4 border-t border-outline-variant/70 pt-3">
          <h3 className="text-xs font-medium text-foreground">Thông tin vai trò bạn được biết</h3>
          <ul className="mt-2 space-y-1.5">
            {knownRoles.map(({ playerId, role: knownRole }) => (
              <li key={`${playerId}-${knownRole}`} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{nameById.get(playerId) || 'Người chơi'}</span>
                <span className="shrink-0 font-medium text-foreground">{knownRole}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
