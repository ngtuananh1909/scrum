'use client';

import { useGameStore } from '@/store/gameStore';

// Renders a large center toast confirming the player's vote, visible for 1.5s.
export function VoteFeedback() {
  const voteAck = useGameStore((s) => s.voteAck);
  if (!voteAck) return null;

  const isAgree = voteAck.vote === 'agree' || voteAck.vote === 'success';
  const label =
    voteAck.vote === 'agree'
      ? 'ĐỒNG Ý'
      : voteAck.vote === 'reject'
      ? 'TỪ CHỐI'
      : voteAck.vote === 'success'
      ? 'HOÀN THÀNH'
      : 'CHÁY DEADLINE';

  const icon =
    voteAck.vote === 'agree' || voteAck.vote === 'success' ? 'check_circle' : 'thumb_down';

  return (
    <div
      className="fixed inset-x-0 top-24 z-[60] flex justify-center pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`glass-panel rounded-2xl px-8 py-5 flex items-center gap-4 shadow-2xl border-2 ${
          isAgree ? 'border-secondary glow-green' : 'border-error glow-red'
        }`}
        style={{
          animation: 'vote-ack-pop 0.3s ease-out',
        }}
      >
        <span
          className={`material-symbols-outlined text-5xl ${
            isAgree ? 'text-secondary' : 'text-error'
          }`}
          style={{ fontVariationSettings: 'FILL 1' }}
        >
          {icon}
        </span>
        <div className="flex flex-col">
          <span
            className={`text-2xl font-bold font-mono tracking-wide ${
              isAgree ? 'text-secondary' : 'text-error'
            }`}
          >
            Đã chọn {label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Phiếu của bạn đã được ghi nhận
          </span>
        </div>
      </div>
      <style jsx>{`
        @keyframes vote-ack-pop {
          0% {
            transform: scale(0.7);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}