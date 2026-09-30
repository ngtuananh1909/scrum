'use client';

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase singleton for Realtime subscriptions.
// Uses the anon key — safe to ship to the browser. RLS policies gate what it can read/write.
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
  }
  return _supabase;
}

export interface RoomRealtimePayload {
  new: Record<string, unknown>;
}

export interface RoomRealtimeHandlers {
  onPublicState: (payload: RoomRealtimePayload) => void;
  onPrivateState: (payload: RoomRealtimePayload) => void;
  onMessage: (payload: RoomRealtimePayload) => void;
}

/** Register only the RLS-protected projections and messages for the active room. */
export function registerRoomRealtimeHandlers(
  channel: RealtimeChannel,
  roomId: string,
  handlers: RoomRealtimeHandlers
): RealtimeChannel {
  return channel
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_public_state',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => handlers.onPublicState(payload as unknown as RoomRealtimePayload)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'player_secrets',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => handlers.onPrivateState(payload as unknown as RoomRealtimePayload)
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => handlers.onMessage(payload as unknown as RoomRealtimePayload)
    );
}
