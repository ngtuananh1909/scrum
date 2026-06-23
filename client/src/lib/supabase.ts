import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client. Uses service role key (bypasses RLS).
// Never import this from a 'use client' file — the key would leak to the browser bundle.
// Lazy init: client created on first call, not at module evaluation time (avoids build-time env var issues).
let _client: SupabaseClient | undefined;

export function supabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }
  return _client;
}
