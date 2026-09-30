import { describe, expect, it, vi } from 'vitest';
import {
  createAuthenticatedFetch,
  createBrowserSessionManager,
  type AuthSession,
} from './browserAuth';
import { registerRoomRealtimeHandlers } from './supabaseBrowser';

function session(userId: string, accessToken: string): AuthSession {
  return {
    access_token: accessToken,
    user: { id: userId },
  } as AuthSession;
}

describe('browser auth adapter', () => {
  it('reuses an existing persisted Supabase session without signing in again', async () => {
    const existing = session('auth-user-1', 'access-token-1');
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: existing }, error: null }),
      signInAnonymously: vi.fn(),
    };
    const ensureSession = createBrowserSessionManager(() => auth as never);

    await expect(ensureSession()).resolves.toEqual({
      userId: 'auth-user-1',
      accessToken: 'access-token-1',
    });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('creates one anonymous session for concurrent first requests', async () => {
    let resolveSession!: (value: { data: { session: AuthSession | null }; error: null }) => void;
    const sessionPromise = new Promise<{ data: { session: AuthSession | null }; error: null }>(
      (resolve) => {
        resolveSession = resolve;
      }
    );
    const created = session('auth-user-2', 'access-token-2');
    const auth = {
      getSession: vi.fn(() => sessionPromise),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { session: created }, error: null }),
    };
    const ensureSession = createBrowserSessionManager(() => auth as never);

    const first = ensureSession();
    const second = ensureSession();
    resolveSession({ data: { session: null }, error: null });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { userId: 'auth-user-2', accessToken: 'access-token-2' },
      { userId: 'auth-user-2', accessToken: 'access-token-2' },
    ]);
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('attaches the current session token to same-origin API requests', async () => {
    const send = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const apiFetch = createAuthenticatedFetch(
      async () => ({ userId: 'auth-user-3', accessToken: 'access-token-3' }),
      send
    );

    await apiFetch('/api/rooms/ABCD', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandId: 'command-1' }),
    });

    const requestInit = send.mock.calls[0][1] as RequestInit;
    expect(new Headers(requestInit.headers).get('Authorization')).toBe('Bearer access-token-3');
    expect(new Headers(requestInit.headers).get('Content-Type')).toBe('application/json');
    expect(send.mock.calls[0][0]).toBe('/api/rooms/ABCD');
  });
});

describe('room Realtime adapter', () => {
  it('subscribes only to the RLS-backed public, private-seat, and room-message projections', () => {
    const calls: Array<{ event: string; filter: Record<string, string> }> = [];
    const channel = {
      on: vi.fn((event: string, filter: Record<string, string>) => {
        calls.push({ event, filter });
        return channel;
      }),
    };

    registerRoomRealtimeHandlers(channel as never, 'ROOM-1', {
      onPublicState: vi.fn(),
      onPrivateState: vi.fn(),
      onMessage: vi.fn(),
    });

    expect(calls.map(({ filter }) => filter.table)).toEqual([
      'room_public_state',
      'player_secrets',
      'room_messages',
    ]);
    expect(calls.map(({ filter }) => filter.filter)).toEqual([
      'room_id=eq.ROOM-1',
      'room_id=eq.ROOM-1',
      'room_id=eq.ROOM-1',
    ]);
    expect(calls.some(({ filter }) => filter.table === 'rooms')).toBe(false);
  });
});
