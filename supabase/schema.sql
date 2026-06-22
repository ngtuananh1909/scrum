-- Supabase schema for Say Agile One More Time.
-- Apply once via Supabase dashboard → SQL Editor → New Query → paste → Run.

-- Rooms: one row per game session. State is a JSONB blob matching the Room interface in client/src/lib/types.ts.
create table if not exists public.rooms (
  id            text primary key,                       -- 6-char room code
  state         jsonb not null,                         -- full Room object
  created_at    timestamptz not null default now(),
  last_updated  timestamptz not null default now()
);

-- Chat messages (separate table — chat is append-only, queried independently of room state).
create table if not exists public.messages (
  id          bigserial primary key,
  room_id     text not null references public.rooms(id) on delete cascade,
  player_id   text not null,
  player_name text not null,                            -- denormalized for fast rendering
  text        text not null check (length(text) between 1 and 500),
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists rooms_last_updated_idx on public.rooms (last_updated desc);
create index if not exists messages_room_id_created_at_idx on public.messages (room_id, created_at desc);

-- Realtime: broadcast row changes to subscribed clients.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.messages;

-- Row-level security. Anonymous public game — open for now, tighten later if abused.
alter table public.rooms    enable row level security;
alter table public.messages enable row level security;

drop policy if exists "anon_all_rooms" on public.rooms;
drop policy if exists "anon_all_msgs"  on public.messages;

create policy "anon_all_rooms" on public.rooms    for all using (true) with check (true);
create policy "anon_all_msgs"  on public.messages for all using (true) with check (true);
