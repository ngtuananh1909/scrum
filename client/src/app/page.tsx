'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Lobby() {
  return (
    <Suspense fallback={null}>
      <LobbyInner />
    </Suspense>
  );
}

function LobbyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [prefilledRoom, setPrefilledRoom] = useState(false);

  const {
    createRoom,
    joinRoom,
    roomId: storeRoomId,
    players,
    error,
    clearError,
    ensurePlayerId,
  } = useGameStore();

  useEffect(() => {
    ensurePlayerId();
  }, [ensurePlayerId]);

  // Auto-fill room code from ?room= query param (shared-link landing).
  useEffect(() => {
    const r = searchParams.get('room');
    if (r && !prefilledRoom) {
      setRoomId(r.toUpperCase());
      setPrefilledRoom(true);
    }
  }, [searchParams, prefilledRoom]);

  useEffect(() => {
    if (storeRoomId && players.length > 0) {
      router.push(`/game/${storeRoomId}`);
    }
  }, [storeRoomId, players, router]);

  const handleCreate = async () => {
    if (!roomId.trim() || !playerName.trim()) return;
    setIsCreating(true);
    await createRoom(roomId.trim(), playerName.trim());
    setIsCreating(false);
  };

  const handleJoin = async () => {
    if (!roomId.trim() || !playerName.trim()) return;
    setIsJoining(true);
    await joinRoom(roomId.trim(), playerName.trim());
    setIsJoining(false);
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  const canEnterRoom = Boolean(roomId.trim() && playerName.trim());

  return (
    <main className="tactical-lobby">
      <div className="tactical-lobby__topbar">
        <div className="tactical-lobby__signal" aria-label="Hệ thống sẵn sàng"><span aria-hidden="true" />LIVE SESSION</div>
        <ThemeToggle className="tactical-icon-button" />
      </div>

      <section className="tactical-lobby__grid" aria-label="Thiết lập phòng chơi">
        <div className="tactical-lobby__intro">
          <div className="tactical-lobby__wordmark"><img src="/brand/logo-wordmark.svg" alt="Say Agile One More Time" className="h-10 sm:h-12 w-auto" /></div>
          <p className="tactical-kicker">PHÒNG CHIẾN THUẬT · REAL-TIME</p>
          <h1>Chọn phòng. Chọn đội. Giữ dự án sống sót.</h1>
          <p className="tactical-lobby__lede">Một ván social deduction cho team Scrum — nơi mọi quyết định Sprint đều để lại dấu vết.</p>
          <div className="tactical-lobby__protocol"><span className="material-symbols-outlined" aria-hidden="true">groups</span><span>5–10 người chơi</span></div>
          <Link href="/how-to-play" className="tactical-lobby__guide-link">Cách chơi <span aria-hidden="true">→</span></Link>
        </div>

        <section className="tactical-lobby__access" aria-labelledby="access-title">
          <div className="tactical-panel__heading">
            <div><p className="tactical-kicker">01 · ACCESS NODE</p><h2 id="access-title">Vào phòng</h2></div>
            <span className="material-symbols-outlined tactical-panel__icon" aria-hidden="true">vpn_key</span>
          </div>

          {error && (
            <div className="tactical-error" role="alert"><span>{error}</span><button onClick={clearError} aria-label="Đóng thông báo lỗi"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>
          )}

          <div className="tactical-form">
            <div className="tactical-field-group">
              <label htmlFor="player-name">Tên hiển thị</label>
              <Input id="player-name" name="playerName" placeholder="Ví dụ: Minh" value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={20} aria-required="true" className="tactical-field" />
              <p className="tactical-field__hint">Tên này sẽ hiện với cả đội.</p>
            </div>
            <div className="tactical-field-group">
              <div className="tactical-label-row"><label htmlFor="room-code">Mã phòng</label><button type="button" onClick={generateRoomId} className="tactical-text-action">Tạo mã mới</button></div>
              <div className="tactical-room-input">
                <Input id="room-code" name="roomCode" placeholder="ABC123" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} maxLength={20} aria-required="true" className="tactical-field tactical-field--code" />
                <Button type="button" variant="outline" onClick={generateRoomId} className="tactical-generate-button" aria-label="Tạo mã phòng ngẫu nhiên" title="Tạo mã phòng ngẫu nhiên"><span className="material-symbols-outlined" aria-hidden="true">autorenew</span></Button>
              </div>
              <p className="tactical-field__hint">Dùng mã có sẵn để tham gia, hoặc tạo một mã cho đội bạn.</p>
            </div>
            <div className="tactical-form__actions">
              <Button className="tactical-action tactical-action--primary" onClick={handleCreate} disabled={!canEnterRoom || isCreating}><span className="material-symbols-outlined" aria-hidden="true">{isCreating ? 'progress_activity' : 'add'}</span>{isCreating ? 'Đang tạo' : 'Tạo phòng'}</Button>
              <Button variant="outline" className="tactical-action tactical-action--secondary" onClick={handleJoin} disabled={!canEnterRoom || isJoining}><span className="material-symbols-outlined" aria-hidden="true">{isJoining ? 'progress_activity' : 'login'}</span>{isJoining ? 'Đang vào' : 'Tham gia'}</Button>
            </div>
            <p className="tactical-entry-status" aria-live="polite">{canEnterRoom ? 'Sẵn sàng thiết lập phiên.' : 'Nhập tên và mã phòng để tiếp tục.'}</p>
          </div>
        </section>

        <section className="tactical-lobby__rules" aria-labelledby="rules-title">
          <div className="tactical-panel__heading"><div><p className="tactical-kicker">02 · WIN CONDITIONS</p><h2 id="rules-title">Luật tóm tắt</h2></div><span className="material-symbols-outlined tactical-panel__icon" aria-hidden="true">fact_check</span></div>
          <div className="tactical-rules-list">
            <p><span className="tactical-rule-marker tactical-rule-marker--good" />Phe tốt hoàn thành 3 Sprint, rồi bảo vệ Scrum Master ở vòng lật kèo.</p>
            <p><span className="tactical-rule-marker tactical-rule-marker--bad" />Phe xấu thắng khi 3 Sprint cháy deadline.</p>
            <p><span className="tactical-rule-marker" />4 lần delay, hết 4 Sprint chưa đủ 3 thắng, hoặc đoán đúng Scrum Master cũng kết thúc ván.</p>
          </div>
        </section>

        <aside className="tactical-lobby__note"><span className="material-symbols-outlined" aria-hidden="true">share</span><p>Tạo phòng xong, chia sẻ mã hoặc link mời cho team.</p></aside>
      </section>
    </main>
  );
}
