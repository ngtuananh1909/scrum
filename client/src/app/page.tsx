'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';

type EntryMode = 'create' | 'join';

const ROOM_CODE_ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ';

function createRoomCode(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}

export default function Lobby() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-background" aria-label="Đang tải phòng chơi" />}>
      <LobbyInner />
    </Suspense>
  );
}

function LobbyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomFromInvite = searchParams.get('room');
  const [roomId, setRoomId] = useState(() => roomFromInvite?.trim().toUpperCase() ?? '');
  const [playerName, setPlayerName] = useState('');
  const [entryMode, setEntryMode] = useState<EntryMode>(() => roomFromInvite ? 'join' : 'create');
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const {
    createRoom,
    joinRoom,
    roomId: activeRoomId,
    players,
    error,
    clearError,
  } = useGameStore();

  useEffect(() => {
    if (activeRoomId && players.length > 0) router.replace(`/game/${activeRoomId}`);
  }, [activeRoomId, players.length, router]);

  const handleCreate = async () => {
    const name = playerName.trim();
    if (!name || isWorking) return;
    const code = createRoomCode();
    setRoomId(code);
    setIsWorking(true);
    clearError();
    try {
      await createRoom(code, name);
    } finally {
      setIsWorking(false);
    }
  };

  const handleJoin = async () => {
    const name = playerName.trim();
    const code = roomId.trim().toUpperCase();
    if (!name || !code || isWorking) return;
    setIsWorking(true);
    clearError();
    try {
      await joinRoom(code, name, { spectator: joinAsSpectator });
    } finally {
      setIsWorking(false);
    }
  };

  const setMode = (mode: EntryMode) => {
    setEntryMode(mode);
    clearError();
  };

  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-background px-4 py-5 text-foreground sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_49px,rgba(127,132,154,0.06)_50px),linear-gradient(to_bottom,transparent_49px,rgba(127,132,154,0.06)_50px)] bg-[size:50px_50px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
      </div>

      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col sm:min-h-[calc(100dvh-4rem)]">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="Say Agile One More Time — Trang chủ" className="inline-flex min-h-11 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Image src="/brand/logo-wordmark.svg" alt="Say Agile One More Time" width={240} height={40} priority className="h-9 w-auto sm:h-10" />
          </Link>
          <ThemeToggle />
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-12">
          <section className="mx-auto w-full max-w-xl lg:mx-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary">
              <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden="true" />
              TRÒ CHƠI SUY LUẬN · 5–10 NGƯỜI
            </p>
            <h1 className="mt-5 max-w-[13ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Cuộc họp nào cũng có người phá dự án.
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              Cùng lập kế hoạch Sprint, đọc vị đồng đội và tìm ra ai đang âm thầm đẩy deadline trượt khỏi tay bạn.
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-y border-border py-4">
              <div>
                <p className="font-mono text-xl font-bold tabular-nums text-primary sm:text-2xl">5–10</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">người một bàn</p>
              </div>
              <div>
                <p className="font-mono text-xl font-bold tabular-nums text-primary sm:text-2xl">4 + 1</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sprint chính và tiebreak</p>
              </div>
              <div>
                <p className="font-mono text-xl font-bold text-primary sm:text-2xl">0</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">tài khoản cần tạo</p>
              </div>
            </div>

            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="material-symbols-outlined text-lg text-secondary" aria-hidden="true">verified_user</span>
              Chỉ cần biệt danh. Vào phòng ngay trên điện thoại hoặc máy tính.
            </p>
            <Link href="/how-to-play" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Xem hướng dẫn song ngữ <span aria-hidden="true">→</span>
            </Link>
          </section>

          <section className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto" aria-labelledby="entry-title">
            <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-[0_24px_64px_-36px_var(--row-glow-primary)] backdrop-blur-sm sm:p-7">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bắt đầu chơi</p>
                <h2 id="entry-title" className="mt-1 text-2xl font-bold tracking-tight text-foreground">Vào bàn cùng bạn bè</h2>
              </div>

              <div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="group" aria-label="Chọn cách vào chơi">
                <button
                  type="button"
                  aria-pressed={entryMode === 'create'}
                  onClick={() => setMode('create')}
                  className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${entryMode === 'create' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Tạo phòng
                </button>
                <button
                  type="button"
                  aria-pressed={entryMode === 'join'}
                  onClick={() => setMode('join')}
                  className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${entryMode === 'join' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Tham gia
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="player-name" className="text-sm font-semibold text-foreground">Biệt danh</label>
                  <Input
                    id="player-name"
                    name="playerName"
                    autoComplete="nickname"
                    placeholder="Ví dụ: Minh Scrum"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value.slice(0, 20))}
                    maxLength={20}
                    className="h-12 bg-background px-3"
                  />
                  <p className="text-xs text-muted-foreground">Tên này sẽ hiển thị với những người trong phòng.</p>
                </div>

                {entryMode === 'join' && (
                  <div className="space-y-2">
                    <label htmlFor="room-code" className="text-sm font-semibold text-foreground">Mã phòng</label>
                    <Input
                      id="room-code"
                      name="roomCode"
                      placeholder="Nhập mã bạn bè gửi"
                      value={roomId}
                      onChange={(event) => setRoomId(event.target.value.replace(/\s/g, '').toUpperCase())}
                      maxLength={20}
                      autoCapitalize="characters"
                      className="h-12 bg-background px-3 font-mono text-base tracking-[0.12em]"
                    />
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3">
                      <input
                        type="checkbox"
                        checked={joinAsSpectator}
                        onChange={(event) => setJoinAsSpectator(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">Vào với tư cách khán giả</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">Chỉ xem thông tin công khai, không nhận vai hay bỏ phiếu.</span>
                      </span>
                    </label>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error" role="alert">
                    <span className="material-symbols-outlined mt-0.5 text-lg" aria-hidden="true">error</span>
                    <p className="min-w-0 flex-1">{error}</p>
                    <button type="button" onClick={clearError} aria-label="Đóng thông báo lỗi" className="rounded p-1 text-error/80 hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
                    </button>
                  </div>
                )}

                <Button
                  type="button"
                  className="h-12 w-full gap-2 text-sm font-semibold"
                  onClick={entryMode === 'create' ? handleCreate : handleJoin}
                  disabled={!playerName.trim() || (entryMode === 'join' && !roomId.trim()) || isWorking}
                >
                  {isWorking ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg" aria-hidden="true">progress_activity</span>
                      Đang kết nối…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">{entryMode === 'create' ? 'add_circle' : 'login'}</span>
                      {entryMode === 'create' ? 'Tạo phòng mới' : 'Vào phòng'}
                    </>
                  )}
                </Button>
              </div>

              <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">lock_open</span>
                Không cần email hay mật khẩu. Dùng biệt danh để bạn bè nhận ra bạn trong phòng.
              </p>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Chơi trực tiếp? Chủ phòng có thể mở mã QR sau khi tạo phòng.
            </p>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 py-4 text-xs text-muted-foreground">
          <span>Say Agile One More Time</span>
          <span>Phối hợp tốt. Đặt câu hỏi khó.</span>
        </footer>
      </div>
    </main>
  );
}
