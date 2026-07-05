'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  getSprintSize,
  isBadRole,
  isGoodRole,
  ROLE_DESCRIPTIONS,
  ROLE_SKILLS,
  type PlayerRole,
} from '@/lib/types';
import { getAvatarUrl } from '@/lib/utils';
import { SkillModal } from './SkillModal';

type ActiveSkill =
  | 'pm'
  | 'ba'
  | 'qc'
  | 'da'
  | 'sep'
  | 'deadline'
  | 'tts'
  | null;

export function SkillPanel() {
  const phase = useGameStore((s) => s.phase);
  const myRole = useGameStore((s) => s.myRole);
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const currentSprint = useGameStore((s) => s.currentSprint);
  const saboteurIds = useGameStore((s) => s.saboteurIds);
  const baId = useGameStore((s) => s.baId);
  const clientId = useGameStore((s) => s.clientId);
  const smId = useGameStore((s) => s.smId);
  const pmOverrideUsed = useGameStore((s) => s.pmOverrideUsed);
  const pmDeferredThisSprint = useGameStore((s) => s.pmDeferredThisSprint);
  const businessAnalystCheckUsed = useGameStore((s) => s.businessAnalystCheckUsed);
  const qcRedoUsed = useGameStore((s) => s.qcRedoUsed);
  const dataAnalystCheckUsed = useGameStore((s) => s.dataAnalystCheckUsed);
  const sepSilencedPlayerId = useGameStore((s) => s.sepSilencedPlayerId);
  const deadlineSilenced = useGameStore((s) => s.deadlineSilenced);
  const ttsFollowTargetId = useGameStore((s) => s.ttsFollowTargetId);
  const prevSprintTeam = useGameStore((s) => s.prevSprintTeam);
  const techDebtActive = useGameStore((s) => s.techDebtActive);

  const nightZeroComplete = useGameStore((s) => s.nightZeroComplete);
  const pmOverride = useGameStore((s) => s.pmOverride);
  const pmDefer = useGameStore((s) => s.pmDefer);
  const businessAnalystCheck = useGameStore((s) => s.businessAnalystCheck);
  const qcRedo = useGameStore((s) => s.qcRedo);
  const dataAnalystCheck = useGameStore((s) => s.dataAnalystCheck);
  const sepSilence = useGameStore((s) => s.sepSilence);
  const deadlineSilence = useGameStore((s) => s.deadlineSilence);

  const [active, setActive] = useState<ActiveSkill>(null);

  if (!phase || phase === 'lobby' || phase === 'ended') return <SkillEmptyState phase={phase} />;
  if (!myRole) return <SkillEmptyState phase={phase} />;

  const myRoleKey = myRole as PlayerRole;
  const isNight = phase === 'night';
  const isFirstNight = currentSprint === 0;
  const expectedSize = getSprintSize(players.length, currentSprint, techDebtActive);
  const candidatesAll = players.filter((p) => p.id !== playerId);
  const daCandidates = players.filter((p) => prevSprintTeam.includes(p.id));
  const ttsTarget = players.find((p) => p.id === ttsFollowTargetId);

  const buttons: Array<{
    skillKey: Exclude<ActiveSkill, null>;
    label: string;
    icon: string;
    accent: 'good' | 'bad' | 'neutral';
    cooldown: string;
    disabled?: boolean;
  }> = [];

  if (isNight && myRole === 'Project Manager') {
    if (pmOverrideUsed) {
      buttons.push({ skillKey: 'pm', label: 'PM Override', icon: 'gavel', accent: 'neutral', cooldown: '1/1', disabled: true });
    } else if (pmDeferredThisSprint) {
      buttons.push({ skillKey: 'pm', label: 'PM Override', icon: 'gavel', accent: 'neutral', cooldown: 'Deferred', disabled: true });
    } else {
      buttons.push({ skillKey: 'pm', label: 'PM Override', icon: 'gavel', accent: 'neutral', cooldown: '0/1' });
    }
  }
  if (isNight && myRole === 'Business Analyst') {
    buttons.push({ skillKey: 'ba', label: 'BA Check', icon: 'search_check', accent: 'good', cooldown: businessAnalystCheckUsed ? '1/1' : '0/1', disabled: businessAnalystCheckUsed });
  }
  if (isNight && myRole === 'Quality Controller') {
    buttons.push({ skillKey: 'qc', label: 'QC Redo', icon: 'restart_alt', accent: 'good', cooldown: qcRedoUsed ? '1/1' : '0/1', disabled: qcRedoUsed });
  }
  if (isNight && myRole === 'Data Analyst') {
    const available = currentSprint >= 1 && prevSprintTeam.length > 0 && !dataAnalystCheckUsed;
    buttons.push({ skillKey: 'da', label: 'DA Check', icon: 'analytics', accent: 'good', cooldown: dataAnalystCheckUsed ? '1/1' : currentSprint < 1 ? 'Sprint 2+' : '0/1', disabled: !available });
  }
  if (isNight && myRole === 'Ông sếp khó ưa') {
    buttons.push({ skillKey: 'sep', label: 'Khóa miệng', icon: 'volume_off', accent: 'bad', cooldown: sepSilencedPlayerId ? '1/sprint' : '0/1', disabled: Boolean(sepSilencedPlayerId) });
  }
  if (isNight && myRole === 'Deadline') {
    buttons.push({ skillKey: 'deadline', label: 'Áp lực tối đa', icon: 'whatshot', accent: 'bad', cooldown: deadlineSilenced ? '1/1' : '0/1', disabled: deadlineSilenced });
  }
  if (isNight && myRole === 'Thực tập sinh' && isFirstNight) {
    buttons.push({ skillKey: 'tts', label: 'Theo sát', icon: 'person_pin', accent: 'good', cooldown: ttsFollowTargetId ? 'Done' : 'Required', disabled: Boolean(ttsFollowTargetId) });
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <SkillRoleCard
        role={myRoleKey}
        isNight={isNight}
        players={players}
        playerId={playerId}
        saboteurIds={saboteurIds}
        baId={baId}
        clientId={clientId}
        smId={smId}
        ttsTargetName={ttsTarget?.name}
      />

      <div className="rounded-xl border border-outline bg-surface-container/50 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Kỹ năng</p>
            <p className="text-xs text-muted-foreground">
              {isNight ? 'Dùng trong Giờ Tan Ca. Không có nút skip.' : 'Skill chỉ mở trong Giờ Tan Ca.'}
            </p>
          </div>
          <span className="material-symbols-outlined text-primary">auto_awesome</span>
        </div>

        {buttons.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Role này không có active skill trong phase hiện tại.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {buttons.map((button) => (
              <SkillActionButton
                key={button.skillKey}
                {...button}
                onClick={() => !button.disabled && setActive(button.skillKey)}
              />
            ))}
          </div>
        )}
      </div>

      <SkillModal
        open={active === 'tts'}
        onClose={() => setActive(null)}
        title="Theo sát nhân viên"
        description="Chọn 1 người để theo sát. Từ Sprint 2, phiếu biểu quyết duyệt nhóm của họ được nhân đôi. Chọn xong vẫn chờ hết giờ Tan Ca."
        candidates={candidatesAll}
        pickCount={1}
        confirmLabel="Theo sát người này"
        accent="good"
        onConfirm={async (ids) => {
          await nightZeroComplete(ids[0]);
        }}
      />

      <SkillModal
        open={active === 'pm'}
        onClose={() => setActive(null)}
        title="Chiếm quyền chỉ định"
        description={`Bạn là PM. Chọn ${expectedSize} người vào nhóm Sprint. Nếu dùng, lượt biểu quyết duyệt sẽ bị bỏ qua, đi thẳng vào thực thi. Bạn CÓ CHẮC dùng ngay bây giờ không?`}
        candidates={players}
        pickCount={expectedSize}
        confirmLabel="Dùng luôn (không thể hoãn)"
        secondaryLabel="Bỏ qua Sprint này"
        onSecondary={async () => {
          await pmDefer();
        }}
        accent="neutral"
        onConfirm={async (ids) => {
          await pmOverride(ids);
        }}
      />

      <SkillModal
        open={active === 'ba'}
        onClose={() => setActive(null)}
        title="Business Analyst Check"
        description="Chọn 2 người. Hệ thống trả Yes nếu ít nhất 1 thuộc phe xấu, ngược lại No. (Kẻ fake CV sẽ lừa được bạn)"
        candidates={candidatesAll}
        pickCount={2}
        confirmLabel="Kiểm tra"
        accent="good"
        onConfirm={async (ids) => {
          await businessAnalystCheck([ids[0], ids[1]]);
        }}
      />

      <SkillModal
        open={active === 'qc'}
        onClose={() => setActive(null)}
        title="Yêu cầu làm lại Sprint"
        description="Hủy kết quả Sprint vừa công bố. Sprint hiện tại sẽ được lập kế hoạch lại từ đầu. (Dùng 1 lần/game)"
        pickCount={0}
        confirmLabel="Làm lại Sprint"
        accent="good"
        onConfirm={async () => {
          await qcRedo();
        }}
      />

      <SkillModal
        open={active === 'da'}
        onClose={() => setActive(null)}
        title="Data Analyst Check"
        description="Chọn 1 người đã tham gia Sprint trước. Hệ thống trả về phiếu vote (Hoàn thành / Cháy deadline) của họ."
        candidates={daCandidates}
        pickCount={1}
        confirmLabel="Phân tích"
        accent="good"
        onConfirm={async (ids) => {
          await dataAnalystCheck(ids[0]);
        }}
      />

      <SkillModal
        open={active === 'sep'}
        onClose={() => setActive(null)}
        title="Khóa miệng nhân viên"
        description="Chọn 1 người. Người đó bị cấm chat và biểu quyết trong vòng Planning của Sprint này."
        candidates={candidatesAll}
        pickCount={1}
        confirmLabel="Khóa"
        accent="bad"
        onConfirm={async (ids) => {
          await sepSilence(ids[0]);
        }}
      />

      <SkillModal
        open={active === 'deadline'}
        onClose={() => setActive(null)}
        title="Áp lực tối đa"
        description="Cấm chat của TẤT CẢ thành viên trong Planning của Sprint này. (Dùng 1 lần/game)"
        pickCount={0}
        confirmLabel="Kích hoạt áp lực"
        accent="bad"
        onConfirm={async () => {
          await deadlineSilence();
        }}
      />
    </div>
  );
}

export function SkillFab() {
  return <SkillPanel />;
}

function SkillActionButton({
  label,
  icon,
  accent,
  cooldown,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  accent: 'good' | 'bad' | 'neutral';
  cooldown: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const accentClass =
    accent === 'good'
      ? 'border-secondary/40 bg-secondary/10 text-secondary'
      : accent === 'bad'
      ? 'border-error/40 bg-error/10 text-error'
      : 'border-primary/40 bg-primary/10 text-primary';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg border p-3 flex items-center gap-3 text-left transition-colors ${accentClass} disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-surface-container-high`}
    >
      <span className="material-symbols-outlined shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Cooldown: {cooldown}
        </span>
      </span>
      <span className="material-symbols-outlined text-base text-muted-foreground">
        {disabled ? 'lock' : 'chevron_right'}
      </span>
    </button>
  );
}

function SkillRoleCard({
  role,
  isNight,
  players,
  playerId,
  saboteurIds,
  baId,
  clientId,
  smId,
  ttsTargetName,
}: {
  role: PlayerRole;
  isNight: boolean;
  players: ReturnType<typeof useGameStore.getState>['players'];
  playerId: string | null;
  saboteurIds: string[];
  baId: string | null;
  clientId: string | null;
  smId: string | null;
  ttsTargetName?: string;
}) {
  const skill = ROLE_SKILLS[role];
  const baPlayer = players.find((p) => p.id === baId);
  const clientPlayer = players.find((p) => p.id === clientId);
  const smPlayer = players.find((p) => p.id === smId);

  return (
    <div className="rounded-xl border border-outline bg-surface-container/50 p-3 space-y-3">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Vai trò của bạn
        </p>
        <p className="text-base font-bold text-foreground">{role}</p>
        <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRIPTIONS[role]}</p>
      </div>

      {skill && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-primary">{skill.name}</p>
          <p className="text-xs text-foreground/90 leading-relaxed">{skill.effect}</p>
          {skill.trigger && <p className="text-[10px] font-mono text-primary/80">⏱ {skill.trigger}</p>}
        </div>
      )}

      {isNight && role === 'Scrum Master' && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-secondary">
            Bảng phe Scrum Master
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {players.map((p) => {
              const playerRole = p.role ?? 'Scrum Master';
              const bad = saboteurIds.includes(p.id) || isBadRole(playerRole);
              const good = isGoodRole(playerRole);
              const isMe = p.id === playerId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    bad
                      ? 'border-error/40 bg-error/5'
                      : good
                      ? 'border-secondary/40 bg-secondary/5'
                      : 'border-outline'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-outline bg-surface-container shrink-0">
                    <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {p.name}{isMe && ' (Bạn)'}
                    </p>
                    <p className={`text-[10px] font-mono font-bold ${bad ? 'text-error' : 'text-secondary'}`}>
                      {bad ? 'PHE XẤU' : 'PHE TỐT'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {smPlayer && (
            <p className="text-[10px] text-muted-foreground italic">
              Bạn là {smPlayer.name} — Scrum Master.
            </p>
          )}
        </div>
      )}

      {isNight && role === 'Client' && (
        <AllyCard title="Đồng minh nội gián của bạn" player={baPlayer} empty="Không có Business Analyst trong phòng" tone="good" />
      )}

      {isNight && role === 'Business Analyst' && (
        <AllyCard title="Đồng minh nội gián của bạn" player={clientPlayer} empty="Không có Client trong phòng" tone="bad" />
      )}

      {role === 'Thực tập sinh' && ttsTargetName && (
        <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-2 text-xs text-secondary">
          Đang theo sát: <strong>{ttsTargetName}</strong>
        </div>
      )}
    </div>
  );
}

function AllyCard({
  title,
  player,
  empty,
  tone,
}: {
  title: string;
  player?: { name: string };
  empty: string;
  tone: 'good' | 'bad';
}) {
  const toneClass = tone === 'good' ? 'border-secondary/40 text-secondary' : 'border-error/40 text-error';

  return (
    <div className={`rounded-lg border p-3 text-center space-y-2 ${toneClass}`}>
      <p className="text-[10px] font-mono uppercase tracking-widest">{title}</p>
      {player ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-current">
            <img src={getAvatarUrl(player.name)} alt={player.name} className="w-full h-full object-cover" />
          </div>
          <p className="text-sm font-mono font-semibold">{player.name}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">{empty}</p>
      )}
    </div>
  );
}

function SkillEmptyState({ phase }: { phase: string | null }) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="rounded-xl border border-outline bg-surface-container/50 p-4 text-center space-y-2">
        <span className="material-symbols-outlined text-3xl text-muted-foreground">auto_awesome</span>
        <p className="text-sm font-semibold text-foreground">Skill chưa sẵn sàng</p>
        <p className="text-xs text-muted-foreground">
          {phase === 'lobby' ? 'Bắt đầu game để xem vai trò và skill.' : 'Không có skill trong trạng thái hiện tại.'}
        </p>
      </div>
    </div>
  );
}
