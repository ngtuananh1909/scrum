'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { ROLE_DESCRIPTIONS, ROLE_SKILLS, type PlayerRole } from '@/lib/types';

function getAvatarUrl(name: string): string {
  const colors = ['c0c1ff', '4ae176', 'ffb4ab', '8083ff', 'ff5451'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${encodeURIComponent(name)}&backgroundColor=${color}`;
}

export function RoleRevealPopup() {
  const showRoleReveal = useGameStore((s) => s.showRoleReveal);
  const myRole = useGameStore((s) => s.myRole);
  const isGood = useGameStore((s) => s.isGood);
  const playerName = useGameStore((s) => s.playerName);
  const closeRoleReveal = useGameStore((s) => s.closeRoleReveal);

  if (!showRoleReveal) return null;

  const roleColor = isGood ? 'text-secondary' : 'text-error';
  const bgColor = isGood
    ? 'from-secondary/20 to-secondary/5 border-secondary/30'
    : 'from-error/20 to-error/5 border-error/30';
  const glowColor = isGood ? 'shadow-[0_0_30px_rgba(74,225,118,0.3)]' : 'shadow-[0_0_30px_rgba(239,68,68,0.3)]';

  return (
    <Dialog open={showRoleReveal} onOpenChange={(open) => !open && closeRoleReveal()}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          {/* Header */}
          <div className="space-y-1">
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
              Sprint 1 has begun
            </p>
            <h2 className="text-2xl font-bold text-foreground">Your Role</h2>
          </div>

          {/* Avatar */}
          <div
            className={`w-24 h-24 rounded-full overflow-hidden border-4 ${glowColor.replace('shadow-', 'border-')} bg-background`}
          >
            <img
              src={getAvatarUrl(playerName || 'Player')}
              alt={playerName || ''}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Role */}
          <div className={`glass-panel rounded-xl px-8 py-4 bg-gradient-to-br ${bgColor} border ${glowColor}`}>
            <p className={`text-2xl font-bold font-mono ${roleColor}`}>
              {myRole || 'Unknown'}
            </p>
            <p className={`text-xs font-mono mt-1 ${isGood ? 'text-secondary/70' : 'text-error/70'}`}>
              {isGood ? 'Good Team — protect the sprint!' : 'Bad Team — sabotage the sprint!'}
            </p>
          </div>

          {/* Role description hint */}
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {myRole && ROLE_DESCRIPTIONS[myRole as PlayerRole]}
          </p>

          {/* Skill section — separate from flavor text */}
          {myRole && ROLE_SKILLS[myRole as PlayerRole] && (
            <div className="w-full max-w-xs glass-panel rounded-xl p-4 border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2 justify-center">
                <span className="material-symbols-outlined text-base text-primary">
                  auto_awesome
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
                  Kỹ năng
                </span>
              </div>
              <p className="text-sm font-bold text-foreground text-center">
                {ROLE_SKILLS[myRole as PlayerRole].name}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed text-center">
                {ROLE_SKILLS[myRole as PlayerRole].effect}
              </p>
              {ROLE_SKILLS[myRole as PlayerRole].trigger && (
                <p className="text-[10px] font-mono text-primary/80 italic text-center pt-1 border-t border-primary/20">
                  ⏱ {ROLE_SKILLS[myRole as PlayerRole].trigger}
                </p>
              )}
            </div>
          )}

          {/* Confirm button */}
          <Button
            onClick={closeRoleReveal}
            className={`w-full max-w-xs mt-2 ${isGood ? 'bg-secondary hover:bg-secondary/90 text-secondary-foreground' : 'bg-error hover:bg-error/90 text-error-foreground'}`}
          >
            <span className="material-symbols-outlined mr-2">check</span>
            Bắt đầu Sprint
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
