'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSprintSize } from '@/lib/types';

// FAB cluster shown bottom-right. Each button gated by role + phase + cooldown.
// Clicking opens the appropriate skill modal.

import { SkillModal } from './SkillModal';

type ActiveSkill =
  | 'pm'
  | 'ba'
  | 'qc'
  | 'da'
  | 'sep'
  | 'deadline'
  | null;

export function SkillFab() {
  const phase = useGameStore((s) => s.phase);
  const myRole = useGameStore((s) => s.myRole);
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const currentSprint = useGameStore((s) => s.currentSprint);
  const pmOverrideUsed = useGameStore((s) => s.pmOverrideUsed);
  const pmDeferredThisSprint = useGameStore((s) => s.pmDeferredThisSprint);
  const businessAnalystCheckUsed = useGameStore((s) => s.businessAnalystCheckUsed);
  const qcRedoUsed = useGameStore((s) => s.qcRedoUsed);
  const dataAnalystCheckUsed = useGameStore((s) => s.dataAnalystCheckUsed);
  const sepSilencedPlayerId = useGameStore((s) => s.sepSilencedPlayerId);
  const deadlineSilenced = useGameStore((s) => s.deadlineSilenced);
  const prevSprintTeam = useGameStore((s) => s.prevSprintTeam);
  const techDebtActive = useGameStore((s) => s.techDebtActive);

  const pmOverride = useGameStore((s) => s.pmOverride);
  const pmDefer = useGameStore((s) => s.pmDefer);
  const businessAnalystCheck = useGameStore((s) => s.businessAnalystCheck);
  const qcRedo = useGameStore((s) => s.qcRedo);
  const dataAnalystCheck = useGameStore((s) => s.dataAnalystCheck);
  const sepSilence = useGameStore((s) => s.sepSilence);
  const deadlineSilence = useGameStore((s) => s.deadlineSilence);

  const [active, setActive] = useState<ActiveSkill>(null);

  if (!phase || phase === 'lobby' || phase === 'ended') return null;
  if (!myRole) return null;

  const buttons: Array<{
    key: ActiveSkill;
    label: string;
    icon: string;
    accent: 'good' | 'bad' | 'neutral';
    cooldown: string; // e.g. "1/1", "0/1", "Used this sprint"
  }> = [];

  // Skills are only usable during the night (tan ca) phase.
  if (phase !== 'night') return null;

  // PM override: night only, once per game.
  if (myRole === 'Project Manager' && phase === 'night') {
    if (pmOverrideUsed) {
      buttons.push({ key: 'pm', label: 'PM Override', icon: 'gavel', accent: 'neutral', cooldown: '1/1' });
    } else if (pmDeferredThisSprint) {
      buttons.push({ key: 'pm', label: 'PM Override', icon: 'gavel', accent: 'neutral', cooldown: 'Deferred' });
    } else {
      buttons.push({ key: 'pm', label: 'PM Override', icon: 'gavel', accent: 'neutral', cooldown: '0/1' });
    }
  }
  if (myRole === 'Business Analyst' && !businessAnalystCheckUsed && phase === 'night') {
    buttons.push({ key: 'ba', label: 'BA Check', icon: 'search_check', accent: 'good', cooldown: '0/1' });
  }
  if (myRole === 'Quality Controller' && phase === 'night' && !qcRedoUsed) {
    buttons.push({ key: 'qc', label: 'QC Redo', icon: 'restart_alt', accent: 'good', cooldown: '0/1' });
  }
  if (
    myRole === 'Data Analyst' &&
    !dataAnalystCheckUsed &&
    currentSprint >= 1 &&
    phase === 'night' &&
    prevSprintTeam.length > 0
  ) {
    buttons.push({ key: 'da', label: 'DA Check', icon: 'analytics', accent: 'good', cooldown: '0/1' });
  }
  if (myRole === 'Ông sếp khó ưa' && phase === 'night' && !sepSilencedPlayerId) {
    buttons.push({
      key: 'sep',
      label: 'Khóa miệng',
      icon: 'volume_off',
      accent: 'bad',
      cooldown: '0/1',
    });
  }
  if (myRole === 'Deadline' && phase === 'night' && !deadlineSilenced) {
    buttons.push({
      key: 'deadline',
      label: 'Áp lực tối đa',
      icon: 'whatshot',
      accent: 'bad',
      cooldown: '0/1',
    });
  }

  // Hide buttons that are used up and don't need any action.
  const visibleButtons = buttons.filter((b) => {
    if (b.cooldown === '1/1') return false;
    if (b.cooldown === 'Used this sprint') return false;
    if (b.cooldown === 'Deferred') return false;
    return true;
  });

  if (visibleButtons.length === 0) return null;

  const expectedSize = getSprintSize(players.length, currentSprint, techDebtActive);
  const candidatesAll = players.filter((p) => p.id !== playerId);
  const daCandidates = players.filter((p) => prevSprintTeam.includes(p.id));

  return (
    <>
      <div className="fixed bottom-20 sm:bottom-24 right-4 z-50 flex flex-col gap-2 items-end">
        {visibleButtons.map((b) => {
          const accentBg =
            b.accent === 'good'
              ? 'bg-secondary text-secondary-foreground'
              : b.accent === 'bad'
              ? 'bg-error text-error-foreground'
              : 'bg-primary-container text-primary-foreground';
          return (
            <button
              key={b.key}
              onClick={() => setActive(b.key)}
              className={`group flex items-center gap-2 pl-3 pr-4 py-2 rounded-full ${accentBg} shadow-[0_4px_20px_var(--toast-shadow)] hover:scale-105 transition-transform`}
            >
              <span className="material-symbols-outlined">{b.icon}</span>
              <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                {b.label}
              </span>
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded tag-chip">
                {b.cooldown}
              </span>
            </button>
          );
        })}
      </div>

      {/* PM Override — Dùng luôn (không thể hoãn) + Bỏ qua Sprint này */}
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

      {/* BA Check */}
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

      {/* QC Redo */}
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

      {/* DA Check */}
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

      {/* Sếp silence */}
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

      {/* Deadline */}
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
    </>
  );
}
