'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAvatarUrl } from '@/lib/utils';
import { isGoodRole, isBadRole, ROLE_SKILLS, type PlayerRole } from '@/lib/types';

// Full-screen overlay shown whenever phase === 'night'.
// - SM: full red/green role table for all players (every night).
// - Client: BA identity reveal.
// - BA: Client identity reveal (NEW — mutual).
// - TTS (first night only): target picker.
// - Others with skill FABs: hint to use skills.
// - Others: "Đang chờ giờ tan ca..." with continue button (auto-advances when timer hits 0).
export function NightOverlay() {
  const phase = useGameStore((s) => s.phase);
  const myRole = useGameStore((s) => s.myRole);
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.players);
  const saboteurIds = useGameStore((s) => s.saboteurIds);
  const baId = useGameStore((s) => s.baId);
  const clientId = useGameStore((s) => s.clientId);
  const smId = useGameStore((s) => s.smId);
  const currentSprint = useGameStore((s) => s.currentSprint);
  const ttsFollowTargetId = useGameStore((s) => s.ttsFollowTargetId);
  const nightAdvance = useGameStore((s) => s.nightAdvance);
  const nightZeroComplete = useGameStore((s) => s.nightZeroComplete);
  const phaseRemainingMs = useGameStore((s) => s.phaseRemainingMs);

  const [pickedTarget, setPickedTarget] = useState<string | null>(null);

  if (phase !== 'night') return null;
  if (!myRole) return null;

  const isTTS = myRole === 'Thực tập sinh';
  const isSM = myRole === 'Scrum Master';
  const isClient = myRole === 'Client';
  const isBA = myRole === 'Business Analyst';

  const isFirstNight = currentSprint === 0;
  const ttsNeedsToPick = isTTS && isFirstNight && !ttsFollowTargetId;

  const handleContinue = async () => {
    // Any non-TTS player can advance out of night.
    await nightAdvance();
  };

  const handleTTSConfirm = async () => {
    if (!pickedTarget) return;
    await nightZeroComplete(pickedTarget);
    await nightAdvance();
  };

  const seconds = Math.ceil(phaseRemainingMs / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const isUrgent = phaseRemainingMs < 5000 && phaseRemainingMs > 0;

  const baPlayer = players.find((p) => p.id === baId);
  const clientPlayer = players.find((p) => p.id === clientId);
  const smPlayer = players.find((p) => p.id === smId);

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl max-w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex flex-col gap-5 py-4">
          {/* Header */}
          <div className="text-center">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">bedtime</span>
              {isFirstNight ? 'Giờ Tan Ca Đầu Tiên' : 'Giờ Tan Ca'}
            </p>
            <h2 className="text-2xl font-bold text-primary mt-1">
              {isFirstNight ? 'Night Zero' : `Sprint ${currentSprint + 1} — Đêm`}
            </h2>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high">
              <span
                className={`material-symbols-outlined text-base ${
                  isUrgent ? 'text-error animate-pulse' : 'text-muted-foreground'
                }`}
              >
                timer
              </span>
              <span
                className={`font-mono font-bold text-sm ${
                  isUrgent ? 'text-error' : 'text-foreground'
                }`}
              >
                {phaseRemainingMs <= 0 ? 'Hết giờ!' : `${mm}:${ss.toString().padStart(2, '0')}`}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                còn lại
              </span>
            </div>
          </div>

          {/* SM — full red/green role board */}
          {isSM && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là <strong className="text-secondary">Scrum Master</strong>. Đây là bảng
                phân vai đầy đủ:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
                {players.map((p) => {
                  const role = p.role ?? 'Scrum Master';
                  const bad = isBadRole(role);
                  const good = isGoodRole(role);
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
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-outline bg-surface-container">
                          <img
                            src={getAvatarUrl(p.name)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${
                            bad ? 'bg-error' : 'bg-secondary'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {p.name}
                          {isMe && ' (Bạn)'}
                        </p>
                        <p
                          className={`text-[10px] font-mono truncate font-bold ${
                            bad ? 'text-error' : 'text-secondary'
                          }`}
                        >
                          {bad ? 'PHE XẤU' : 'PHE TỐT'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={handleContinue} className="w-full">
                <span className="material-symbols-outlined mr-2">wb_sunny</span>
                Bắt đầu vào ca
              </Button>
            </>
          )}

          {/* Client — sees BA */}
          {isClient && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là <strong className="text-error">Client</strong>. Đồng minh nội gián của
                bạn:
              </p>
              {baPlayer ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-secondary">
                    <img
                      src={getAvatarUrl(baPlayer.name)}
                      alt={baPlayer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-mono text-secondary">{baPlayer.name}</p>
                  <p className="text-xs text-muted-foreground italic">
                    Nội gián: Đây chính là Business Analyst!
                  </p>
                </div>
              ) : (
                <p className="text-xs text-center text-muted-foreground italic">
                  (Không có Business Analyst trong phòng)
                </p>
              )}
              <Button onClick={handleContinue} className="w-full">
                <span className="material-symbols-outlined mr-2">visibility</span>
                Đã ghi nhớ
              </Button>
            </>
          )}

          {/* BA — sees Client (mutual reveal) */}
          {isBA && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là <strong className="text-secondary">Business Analyst</strong>. Đồng minh
                nội gián của bạn:
              </p>
              {clientPlayer ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-error">
                    <img
                      src={getAvatarUrl(clientPlayer.name)}
                      alt={clientPlayer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm font-mono text-error">{clientPlayer.name}</p>
                  <p className="text-xs text-muted-foreground italic">
                    Nội gián: Đây chính là Client!
                  </p>
                </div>
              ) : (
                <p className="text-xs text-center text-muted-foreground italic">
                  (Không có Client trong phòng)
                </p>
              )}
              <Button onClick={handleContinue} className="w-full">
                <span className="material-symbols-outlined mr-2">visibility</span>
                Đã ghi nhớ
              </Button>
            </>
          )}

          {/* TTS — first night target picker */}
          {ttsNeedsToPick && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là <strong className="text-secondary">Thực tập sinh</strong>. Chọn 1 người để
                theo sát — từ Sprint 2, phiếu vote duyệt nhóm của họ sẽ được nhân đôi.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
                {players
                  .filter((p) => p.id !== playerId)
                  .map((p) => {
                    const selected = pickedTarget === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPickedTarget(p.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                          selected
                            ? 'border-primary bg-primary/10'
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
                        <p className="text-[10px] font-mono truncate w-full text-center">
                          {p.name}
                        </p>
                      </button>
                    );
                  })}
              </div>
              <Button
                onClick={handleTTSConfirm}
                disabled={!pickedTarget}
                className="w-full disabled:opacity-50"
              >
                <span className="material-symbols-outlined mr-2">person_pin</span>
                Theo sát người này
              </Button>
            </>
          )}

          {/* TTS — already picked, or subsequent nights */}
          {isTTS && !ttsNeedsToPick && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Đang chờ giờ tan ca kết thúc để vào ca làm việc...
              </p>
              <Button onClick={handleContinue} variant="outline" className="w-full">
                Bỏ qua (vào ca)
              </Button>
            </>
          )}

          {/* Other roles with skill FABs */}
          {!isSM && !isClient && !isBA && !isTTS && (
            <OtherRoleHint myRole={myRole} onContinue={handleContinue} />
          )}

          {/* If current player is SM and we also want to remind them of their own identity */}
          {isSM && smPlayer && (
            <p className="text-[10px] text-center text-muted-foreground italic">
              Bạn là {smPlayer.name} — Scrum Master.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OtherRoleHint({
  myRole,
  onContinue,
}: {
  myRole: string;
  onContinue: () => void;
}) {
  const hasSkillFab = [
    'Project Manager',
    'Quality Controller',
    'Data Analyst',
    'Ông sếp khó ưa',
    'Deadline',
  ].includes(myRole);

  const skill = ROLE_SKILLS[myRole as PlayerRole];
  // Reveal role + skill only on the very first night. From sprint 2 onwards,
  // players remember their role/skill from the initial reveal — no need to show again.
  const currentSprint = useGameStore((s) => s.currentSprint);
  const showReveal = currentSprint === 0;

  return (
    <>
      <p className="text-sm text-center text-muted-foreground">
        {hasSkillFab
          ? 'Giờ tan ca — bạn có thể dùng kỹ năng (nút ở góc dưới bên phải).'
          : 'Đang chờ giờ tan ca kết thúc để vào ca làm việc...'}
      </p>
      {showReveal && (
        <>
          <div className="glass-panel rounded-lg p-3 text-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Vai trò của bạn
            </span>
            <span className="text-sm font-semibold text-foreground">{myRole}</span>
          </div>
          {skill && (
            <div className="rounded-xl p-3 border border-primary/30 bg-primary/5 space-y-1.5">
              <div className="flex items-center gap-1.5 justify-center">
                <span className="material-symbols-outlined text-xs text-primary">
                  auto_awesome
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
                  Kỹ năng — {skill.name}
                </span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed text-center">
                {skill.effect}
              </p>
              {skill.trigger && (
                <p className="text-[10px] font-mono text-primary/80 italic text-center pt-1 border-t border-primary/20">
                  ⏱ {skill.trigger}
                </p>
              )}
            </div>
          )}
        </>
      )}
      <Button onClick={onContinue} variant="outline" className="w-full">
        <span className="material-symbols-outlined mr-2">wb_sunny</span>
        Vào ca
      </Button>
    </>
  );
}