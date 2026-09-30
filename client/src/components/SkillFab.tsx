'use client';

import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { GameRole } from '@/game/types';
import { RoleGuidance } from '@/components/game/RoleGuidance';
import { SkillModal } from './SkillModal';

type ActiveSkill = 'tts' | 'pm' | 'ba' | 'qc' | 'da' | 'boss' | 'deadline' | null;

export function SkillPanel() {
  const phase = useGameStore((state) => state.phase);
  const role = useGameStore((state) => state.privateState?.ownRole ?? state.myRole);
  const faction = useGameStore((state) => state.privateState?.faction ?? state.faction);
  const knownRoles = useGameStore((state) => state.privateState?.knownRoles ?? state.knownRoles);
  const players = useGameStore((state) => state.players);
  const playerId = useGameStore((state) => state.playerId);
  const allowedActions = useGameStore((state) => state.privateState?.allowedActions ?? state.allowedActions);
  const requiredTeamSize = useGameStore((state) => state.requiredTeamSize);
  const sprintHistory = useGameStore((state) => state.sprintHistory);

  const nightZeroComplete = useGameStore((state) => state.nightZeroComplete);
  const pmOverride = useGameStore((state) => state.pmOverride);
  const businessAnalystCheck = useGameStore((state) => state.businessAnalystCheck);
  const qcRedo = useGameStore((state) => state.qcRedo);
  const dataAnalystCheck = useGameStore((state) => state.dataAnalystCheck);
  const sepSilence = useGameStore((state) => state.sepSilence);
  const deadlineSilence = useGameStore((state) => state.deadlineSilence);

  const [active, setActive] = useState<ActiveSkill>(null);
  const actions = useMemo(() => new Set(allowedActions), [allowedActions]);
  const candidates = players.filter((player) => player.id !== playerId);
  const previousTeamIds = sprintHistory[sprintHistory.length - 1]?.teamIds ?? [];
  const previousTeam = players.filter((player) => previousTeamIds.includes(player.id));

  if (!role || phase === 'lobby' || phase === 'ended') {
    return <SkillEmptyState phase={phase} />;
  }

  const availableSkillActions: Array<{
    key: Exclude<ActiveSkill, null>;
    action: string;
    title: string;
    detail: string;
    icon: string;
    accent: 'good' | 'bad' | 'neutral';
  }> = [
    { key: 'tts', action: 'setTtsTarget', title: 'Chọn người theo sát', detail: 'Cần hoàn tất trong giờ tan ca đầu tiên.', icon: 'visibility', accent: 'good' },
    { key: 'pm', action: 'usePmOverride', title: 'Chiếm quyền chỉ định', detail: `Chọn ${requiredTeamSize} người và bỏ qua biểu quyết nhóm.`, icon: 'gavel', accent: 'neutral' },
    { key: 'ba', action: 'useBaCheck', title: 'Kiểm tra Business Analyst', detail: 'Chọn hai người để kiểm tra phe.', icon: 'manage_search', accent: 'good' },
    { key: 'qc', action: 'useQcRedo', title: 'Làm lại Sprint', detail: 'Hủy kết quả vừa rồi và lập kế hoạch lại.', icon: 'restart_alt', accent: 'good' },
    { key: 'da', action: 'useDaCheck', title: 'Kiểm tra lá phiếu', detail: 'Xem một người đã bỏ phiếu nào ở Sprint vừa rồi.', icon: 'analytics', accent: 'good' },
    { key: 'boss', action: 'useBossSilence', title: 'Khóa chat một người', detail: 'Người đó không thể trò chuyện trong Planning.', icon: 'volume_off', accent: 'bad' },
    { key: 'deadline', action: 'useDeadlineSilence', title: 'Áp lực tối đa', detail: 'Tắt chat của cả phòng trong Planning.', icon: 'timer', accent: 'bad' },
  ];
  const skillActions = availableSkillActions.filter((skill) => actions.has(skill.action));

  return (
    <div className="space-y-3">
      <RoleGuidance
        role={role as GameRole}
        faction={faction}
        knownRoles={knownRoles}
        players={players}
      />

      <section className="rounded-2xl border border-outline-variant bg-surface-container/50 p-3" aria-labelledby="available-skills-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 id="available-skills-title" className="text-sm font-semibold text-foreground">Kỹ năng dùng được lúc này</h2>
            <p className="mt-1 text-xs text-muted-foreground">Chỉ hiện hành động hợp lệ cho vai trò và giai đoạn hiện tại.</p>
          </div>
          <span className="material-symbols-outlined text-primary" aria-hidden="true">auto_awesome</span>
        </div>

        {skillActions.length === 0 ? (
          <p className="rounded-xl border border-outline-variant bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
            Chưa có kỹ năng cần dùng. Hãy theo dõi thời gian và chờ giai đoạn tiếp theo.
          </p>
        ) : (
          <div className="grid gap-2">
            {skillActions.map((skill) => (
              <SkillActionButton
                key={skill.key}
                title={skill.title}
                detail={skill.detail}
                icon={skill.icon}
                accent={skill.accent}
                onClick={() => setActive(skill.key)}
              />
            ))}
          </div>
        )}
      </section>

      <SkillModal
        open={active === 'tts'}
        onClose={() => setActive(null)}
        title="Chọn người theo sát"
        description="Chọn một người chơi. Từ Sprint 2, lá phiếu duyệt nhóm của họ có trọng số gấp đôi."
        candidates={candidates}
        pickCount={1}
        confirmLabel="Xác nhận lựa chọn"
        accent="good"
        onConfirm={async (ids) => { await nightZeroComplete(ids[0] || null); }}
      />
      <SkillModal
        open={active === 'pm'}
        onClose={() => setActive(null)}
        title="Chiếm quyền chỉ định"
        description={`Chọn đúng ${requiredTeamSize} người. Nhóm sẽ đi thẳng vào bỏ phiếu kín.`}
        candidates={players}
        pickCount={requiredTeamSize}
        confirmLabel="Dùng kỹ năng"
        accent="neutral"
        onConfirm={async (ids) => { await pmOverride(ids); }}
      />
      <SkillModal
        open={active === 'ba'}
        onClose={() => setActive(null)}
        title="Kiểm tra hai người"
        description="Hệ thống báo Có nếu ít nhất một người thuộc phe Phá Dự Án. Vai Kẻ fake CV có thể đánh lừa lần kiểm tra này."
        candidates={candidates}
        pickCount={2}
        confirmLabel="Kiểm tra"
        accent="good"
        onConfirm={async (ids) => { if (ids[0] && ids[1]) await businessAnalystCheck([ids[0], ids[1]]); }}
      />
      <SkillModal
        open={active === 'qc'}
        onClose={() => setActive(null)}
        title="Làm lại Sprint"
        description="Hủy kết quả hiện tại và lập lại kế hoạch cho cùng Sprint."
        pickCount={0}
        confirmLabel="Làm lại"
        accent="good"
        onConfirm={async () => { await qcRedo(); }}
      />
      <SkillModal
        open={active === 'da'}
        onClose={() => setActive(null)}
        title="Kiểm tra một lá phiếu"
        description="Chọn người đã tham gia Sprint vừa kết thúc để xem họ bỏ phiếu Hoàn thành hay Thất bại."
        candidates={previousTeam}
        pickCount={1}
        confirmLabel="Xem lá phiếu"
        accent="good"
        onConfirm={async (ids) => { if (ids[0]) await dataAnalystCheck(ids[0]); }}
      />
      <SkillModal
        open={active === 'boss'}
        onClose={() => setActive(null)}
        title="Khóa chat một người"
        description="Chọn một người chơi không được trò chuyện trong Planning của Sprint này."
        candidates={candidates}
        pickCount={1}
        confirmLabel="Khóa chat"
        accent="bad"
        onConfirm={async (ids) => { if (ids[0]) await sepSilence(ids[0]); }}
      />
      <SkillModal
        open={active === 'deadline'}
        onClose={() => setActive(null)}
        title="Áp lực tối đa"
        description="Tắt chat của toàn bộ phòng trong Planning của Sprint này."
        pickCount={0}
        confirmLabel="Kích hoạt"
        accent="bad"
        onConfirm={async () => { await deadlineSilence(); }}
      />
    </div>
  );
}

export function SkillFab() {
  return <SkillPanel />;
}

function SkillActionButton({
  title,
  detail,
  icon,
  accent,
  onClick,
}: {
  title: string;
  detail: string;
  icon: string;
  accent: 'good' | 'bad' | 'neutral';
  onClick: () => void;
}) {
  const tone = accent === 'good'
    ? 'border-secondary/30 bg-secondary/5'
    : accent === 'bad'
      ? 'border-error/30 bg-error/5'
      : 'border-primary/30 bg-primary/5';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone}`}
    >
      <span className="material-symbols-outlined shrink-0 text-primary" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
      </span>
      <span className="material-symbols-outlined ml-auto shrink-0 text-base text-muted-foreground" aria-hidden="true">chevron_right</span>
    </button>
  );
}

function SkillEmptyState({ phase }: { phase: string | null }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container/40 p-4 text-center">
      <span className="material-symbols-outlined text-3xl text-muted-foreground" aria-hidden="true">auto_awesome</span>
      <p className="mt-2 text-sm font-semibold text-foreground">Vai trò chưa được mở</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {phase === 'lobby' ? 'Kỹ năng và hướng dẫn sẽ xuất hiện khi ván bắt đầu.' : 'Không có vai trò riêng cho màn hình này.'}
      </p>
    </div>
  );
}
