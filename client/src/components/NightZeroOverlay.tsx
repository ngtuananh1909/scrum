'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAvatarUrl } from '@/lib/utils';

// Full-screen overlay shown when phase === 'nightZero'.
// SM sees saboteur list; Client sees BA avatar; TTS picks follow target.
// Non-skill roles just see a brief message + Continue.
export function NightZeroOverlay() {
  const phase = useGameStore((s) => s.phase);
  const myRole = useGameStore((s) => s.myRole);
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.players);
  const saboteurIds = useGameStore((s) => s.saboteurIds);
  const baId = useGameStore((s) => s.baId);
  const nightZeroSeen = useGameStore((s) => s.nightZeroSeen);
  const ttsFollowTargetId = useGameStore((s) => s.ttsFollowTargetId);
  const nightZeroComplete = useGameStore((s) => s.nightZeroComplete);
  const setNightZeroSeen = useGameStore((s) => s.setNightZeroSeen);

  const [pickedTarget, setPickedTarget] = useState<string | null>(null);
  // Derive open from store state — no setState-in-effect.
  const open = phase === 'nightZero' && !nightZeroSeen;

  if (phase !== 'nightZero') return null;
  if (!myRole) return null;

  const isTTS = myRole === 'Thực tập sinh';
  const isSM = myRole === 'Scrum Master';
  const isClient = myRole === 'Client';

  const handleContinue = () => {
    setNightZeroSeen(true);
  };

  const handleTTSConfirm = async () => {
    if (!pickedTarget) return;
    await nightZeroComplete(pickedTarget);
    setNightZeroSeen(true);
  };

  const saboteurPlayers = players.filter((p) => saboteurIds.includes(p.id));
  const baPlayer = players.find((p) => p.id === baId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleContinue()}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg max-w-[calc(100%-1rem)]">
        <div className="flex flex-col gap-5 py-4">
          <div className="text-center">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Giờ Tan Ca Đầu Tiên
            </p>
            <h2 className="text-2xl font-bold text-primary mt-1">Night Zero</h2>
          </div>

          {isSM && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là <strong className="text-secondary">Scrum Master</strong>. Đây là danh sách
                phe Phá Dự Án bạn cần bảo vệ team khỏi:
              </p>
              {saboteurPlayers.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground italic">
                  (Không tìm thấy Người trễ task — kiểm tra cấu hình)
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 justify-items-center">
                  {saboteurPlayers.map((p) => (
                    <div key={p.id} className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-error">
                        <img src={getAvatarUrl(p.name)} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs font-mono text-error truncate max-w-[6rem]">{p.name}</p>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={handleContinue} className="w-full">
                <span className="material-symbols-outlined mr-2">visibility</span>
                Đã ghi nhớ
              </Button>
            </>
          )}

          {isClient && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là <strong className="text-error">Client</strong>. Đây là Business Analyst:
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
                  <p className="text-xs text-muted-foreground italic">Nội gián: Đây chính là BA!</p>
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

          {isTTS && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Bạn là <strong className="text-secondary">Thực tập sinh</strong>. Chọn 1 người để
                theo sát — từ Sprint 2, phiếu vote duyệt nhóm của họ sẽ được nhân đôi.
              </p>
              {ttsFollowTargetId ? (
                <p className="text-xs text-center text-secondary">
                  Đã chọn:{' '}
                  <strong>{players.find((p) => p.id === ttsFollowTargetId)?.name}</strong>
                </p>
              ) : (
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
                            selected ? 'border-primary bg-primary/10' : 'border-outline hover:border-primary/50'
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
              )}
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

          {!isSM && !isClient && !isTTS && (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Đang chờ Thực tập sinh chọn mục tiêu... Sprint 1 sẽ bắt đầu sớm.
              </p>
              <Button onClick={handleContinue} variant="outline" className="w-full">
                Đóng
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
