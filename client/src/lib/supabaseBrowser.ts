'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase singleton for Realtime subscriptions.
// Uses the anon key — safe to ship to the browser. RLS policies gate what it can read/write.
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    );
  }
  return _supabase;
}
