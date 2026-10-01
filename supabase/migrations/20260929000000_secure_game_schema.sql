-- Remove legacy room data from Realtime before archiving it. Only the three
-- row-filtered browser projections are published after this migration.
do $migration$
declare
  published_table record;
  policy_row record;
  old_table text;
  archived_table text;
  sequence_name text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    for published_table in
      select schemaname, tablename
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and not (
          schemaname = 'public'
          and tablename in ('room_public_state', 'player_secrets', 'room_messages')
        )
    loop
      execute format(
        'alter publication %I drop table %I.%I',
        'supabase_realtime', published_table.schemaname, published_table.tablename
      );
    end loop;
  end if;

  -- Preserve legacy rows for server-only audit/recovery. Existing active room
  -- codes are intentionally invalid after this cutover; they are not imported
  -- into the new schema because their old JSON state has no verified identity.
  foreach old_table in array array['rooms', 'messages'] loop
    archived_table := case old_table
      when 'rooms' then 'legacy_rooms_20260929'
      else 'legacy_messages_20260929'
    end;

    if to_regclass(format('public.%I', old_table)) is not null then
      if to_regclass(format('public.%I', archived_table)) is not null then
        raise exception 'Cannot archive public.%: archive table public.% already exists', old_table, archived_table;
      end if;

      for policy_row in
        select polname
        from pg_catalog.pg_policy
        where polrelid = to_regclass(format('public.%I', old_table))
      loop
        execute format('drop policy %I on public.%I', policy_row.polname, old_table);
      end loop;

      execute format('alter table public.%I enable row level security', old_table);
      execute format('revoke all on table public.%I from public, anon, authenticated', old_table);
      execute format('alter table public.%I rename to %I', old_table, archived_table);
    end if;
  end loop;

  -- Revoke any inherited API grants from existing archives, including a schema
  -- that was already archived by an earlier manual cutover attempt.
  foreach archived_table in array array['legacy_rooms_20260929', 'legacy_messages_20260929'] loop
    if to_regclass(format('public.%I', archived_table)) is not null then
      for policy_row in
        select polname
        from pg_catalog.pg_policy
        where polrelid = to_regclass(format('public.%I', archived_table))
      loop
        execute format('drop policy %I on public.%I', policy_row.polname, archived_table);
      end loop;
      execute format('alter table public.%I enable row level security', archived_table);
      execute format('revoke all on table public.%I from public, anon, authenticated', archived_table);

      if archived_table = 'legacy_messages_20260929' then
        sequence_name := pg_catalog.pg_get_serial_sequence(format('public.%I', archived_table), 'id');
        if sequence_name is not null then
          execute format('revoke all on sequence %s from public, anon, authenticated', sequence_name);
        end if;
      end if;

      execute format('grant all on table public.%I to service_role', archived_table);
    end if;
  end loop;
end
$migration$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create table if not exists public.game_rooms (
  room_id text primary key,
  host_player_id uuid,
  phase_version bigint not null default 0 check (phase_version >= 0),
  revision bigint not null default 0 check (revision >= 0),
  internal_state jsonb default null check (internal_state is null or jsonb_typeof(internal_state) = 'object'),
  deadline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.game_rooms(room_id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 20),
  joined_order integer not null check (joined_order >= 0),
  is_spectator boolean not null default false,
  ready boolean not null default false,
  last_seen timestamptz not null default now(),
  kicked_at timestamptz,
  unique (room_id, id)
);

create unique index if not exists room_players_active_auth_user_idx
  on public.room_players (room_id, auth_user_id)
  where kicked_at is null;
create unique index if not exists room_players_active_display_name_idx
  on public.room_players (room_id, lower(display_name))
  where kicked_at is null;
create index if not exists room_players_auth_user_idx
  on public.room_players (auth_user_id, room_id)
  where kicked_at is null;

do $constraints$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.game_rooms'::regclass and conname = 'game_rooms_host_player_fk'
  ) then
    alter table public.game_rooms
      add constraint game_rooms_host_player_fk
      foreign key (room_id, host_player_id)
      references public.room_players (room_id, id)
      on delete set null (host_player_id)
      deferrable initially deferred;
  end if;
end
$constraints$;

create table if not exists public.player_secrets (
  room_id text not null references public.game_rooms(room_id) on delete cascade,
  player_id uuid not null,
  role text not null check (role in (
    'Scrum Master', 'Project Manager', 'Developer', 'Business Analyst',
    'Quality Controller', 'Technical Leader', 'Data Analyst', 'Thực tập sinh',
    'Người trễ task', 'Client', 'Ông sếp khó ưa', 'Kẻ fake CV',
    'QC cẩu thả', 'Deadline', 'Technical Debt'
  )),
  private_state jsonb not null default '{}'::jsonb check (jsonb_typeof(private_state) = 'object'),
  primary key (room_id, player_id),
  foreign key (room_id, player_id) references public.room_players (room_id, id) on delete cascade
);

create unique index if not exists player_secrets_one_scrum_master_per_room_idx
  on public.player_secrets (room_id)
  where role = 'Scrum Master';
create unique index if not exists player_secrets_one_late_task_per_room_idx
  on public.player_secrets (room_id)
  where role = 'Người trễ task';

create or replace function private.assert_room_required_roles()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  target_room_id text;
  game_started boolean;
  scrum_master_count integer;
  late_task_count integer;
begin
  target_room_id := coalesce(new.room_id, old.room_id);

  select gr.internal_state is not null
  into game_started
  from public.game_rooms gr
  where gr.room_id = target_room_id;

  if not found or not game_started then
    return null;
  end if;

  select
    count(*) filter (where ps.role = 'Scrum Master'),
    count(*) filter (where ps.role = 'Người trễ task')
  into scrum_master_count, late_task_count
  from public.player_secrets ps
  where ps.room_id = target_room_id;

  if scrum_master_count <> 1 or late_task_count <> 1 then
    raise exception 'A started room must have exactly one Scrum Master and one Người trễ task'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

revoke all on function private.assert_room_required_roles() from public, anon, authenticated;

drop trigger if exists game_rooms_required_roles_check on public.game_rooms;
create constraint trigger game_rooms_required_roles_check
  after insert or update or delete on public.game_rooms
  deferrable initially deferred
  for each row execute function private.assert_room_required_roles();

drop trigger if exists player_secrets_required_roles_check on public.player_secrets;
create constraint trigger player_secrets_required_roles_check
  after insert or update or delete on public.player_secrets
  deferrable initially deferred
  for each row execute function private.assert_room_required_roles();

create table if not exists public.team_votes (
  room_id text not null references public.game_rooms(room_id) on delete cascade,
  phase_version bigint not null check (phase_version >= 0),
  player_id uuid not null,
  vote text not null check (vote in ('approve', 'reject')),
  created_at timestamptz not null default now(),
  primary key (room_id, phase_version, player_id),
  foreign key (room_id, player_id) references public.room_players (room_id, id) on delete cascade
);

create table if not exists public.execution_votes (
  room_id text not null references public.game_rooms(room_id) on delete cascade,
  phase_version bigint not null check (phase_version >= 0),
  player_id uuid not null,
  vote text not null check (vote in ('success', 'fail')),
  created_at timestamptz not null default now(),
  primary key (room_id, phase_version, player_id),
  foreign key (room_id, player_id) references public.room_players (room_id, id) on delete cascade
);

create table if not exists public.room_public_state (
  room_id text primary key references public.game_rooms(room_id) on delete cascade,
  revision bigint not null check (revision >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_messages (
  sequence bigint generated always as identity primary key,
  room_id text not null references public.game_rooms(room_id) on delete cascade,
  audience text not null check (audience in ('public', 'bad')),
  sender_player_id uuid not null,
  command_id uuid not null,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (room_id, sender_player_id, command_id),
  foreign key (room_id, sender_player_id) references public.room_players (room_id, id) on delete cascade
);

create index if not exists room_messages_room_sequence_idx
  on public.room_messages (room_id, sequence desc);
create index if not exists room_messages_sender_rate_limit_idx
  on public.room_messages (room_id, sender_player_id, created_at desc);

create sequence if not exists public.game_events_sequence_seq;

create table if not exists public.applied_commands (
  room_id text not null references public.game_rooms(room_id) on delete cascade,
  command_id uuid not null,
  actor_auth_user_id uuid,
  expected_phase_version bigint not null check (expected_phase_version >= 0),
  result jsonb not null,
  applied_revision bigint check (applied_revision is null or applied_revision >= 0),
  created_at timestamptz not null default now(),
  primary key (room_id, command_id)
);

create table if not exists public.game_events (
  id bigint generated always as identity primary key,
  room_id text not null references public.game_rooms(room_id) on delete cascade,
  sequence bigint not null default nextval('public.game_events_sequence_seq') check (sequence > 0),
  command_id uuid,
  phase_version bigint not null check (phase_version >= 0),
  actor_player_id uuid,
  event_type text not null check (char_length(btrim(event_type)) between 1 and 100),
  public_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(public_payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (room_id, sequence),
  foreign key (room_id, command_id) references public.applied_commands (room_id, command_id) on delete cascade
);

create index if not exists game_events_reaction_rate_limit_idx
  on public.game_events (room_id, actor_player_id, created_at desc)
  where event_type = 'reaction';

create or replace function private.is_active_room_member(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.auth_user_id = (select auth.uid())
      and rp.kicked_at is null
  );
$function$;

create or replace function private.is_current_room_player(p_room_id text, p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.room_players rp
    where rp.room_id = p_room_id
      and rp.id = p_player_id
      and rp.auth_user_id = (select auth.uid())
      and rp.is_spectator = false
      and rp.kicked_at is null
      and exists (
        select 1 from public.game_rooms gr
        where gr.room_id = rp.room_id and gr.internal_state is not null
      )
  );
$function$;

create or replace function private.is_bad_room_player(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.room_players rp
    join public.player_secrets ps
      on ps.room_id = rp.room_id and ps.player_id = rp.id
    where rp.room_id = p_room_id
      and rp.auth_user_id = (select auth.uid())
      and rp.is_spectator = false
      and rp.kicked_at is null
      and exists (
        select 1 from public.game_rooms gr
        where gr.room_id = rp.room_id and gr.internal_state is not null
      )
      and ps.role = any (array[
        'Người trễ task', 'Client', 'Ông sếp khó ưa', 'Kẻ fake CV',
        'QC cẩu thả', 'Deadline', 'Technical Debt'
      ]::text[])
  );
$function$;

revoke all on function private.is_active_room_member(text) from public, anon;
revoke all on function private.is_current_room_player(text, uuid) from public, anon;
revoke all on function private.is_bad_room_player(text) from public, anon;
grant execute on function private.is_active_room_member(text) to authenticated;
grant execute on function private.is_current_room_player(text, uuid) to authenticated;
grant execute on function private.is_bad_room_player(text) to authenticated;
grant execute on function private.assert_room_required_roles() to service_role;

alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.player_secrets enable row level security;
alter table public.team_votes enable row level security;
alter table public.execution_votes enable row level security;
alter table public.room_public_state enable row level security;
alter table public.room_messages enable row level security;
alter table public.game_events enable row level security;
alter table public.applied_commands enable row level security;

drop policy if exists room_public_state_active_member_select on public.room_public_state;
create policy room_public_state_active_member_select
  on public.room_public_state for select to authenticated
  using ((select private.is_active_room_member(room_id)));

drop policy if exists player_secrets_own_player_select on public.player_secrets;
create policy player_secrets_own_player_select
  on public.player_secrets for select to authenticated
  using ((select private.is_current_room_player(room_id, player_id)));

drop policy if exists room_messages_audience_select on public.room_messages;
create policy room_messages_audience_select
  on public.room_messages for select to authenticated
  using (
    (select private.is_active_room_member(room_id))
    and (audience = 'public' or (select private.is_bad_room_player(room_id)))
  );

revoke all on table
  public.game_rooms,
  public.room_players,
  public.player_secrets,
  public.team_votes,
  public.execution_votes,
  public.room_public_state,
  public.room_messages,
  public.game_events,
  public.applied_commands
from public, anon, authenticated;

grant select on table public.room_public_state, public.player_secrets, public.room_messages to authenticated;
grant all on table
  public.game_rooms,
  public.room_players,
  public.player_secrets,
  public.team_votes,
  public.execution_votes,
  public.room_public_state,
  public.room_messages,
  public.game_events,
  public.applied_commands
to service_role;
revoke all on sequence
  public.room_messages_sequence_seq,
  public.game_events_id_seq,
  public.game_events_sequence_seq
from public, anon, authenticated;
grant usage, select on sequence public.room_messages_sequence_seq, public.game_events_id_seq, public.game_events_sequence_seq to service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
grant execute on function private.touch_updated_at() to service_role;

drop trigger if exists game_rooms_touch_updated_at on public.game_rooms;
create trigger game_rooms_touch_updated_at
  before update on public.game_rooms
  for each row execute function private.touch_updated_at();

drop trigger if exists room_public_state_touch_updated_at on public.room_public_state;
create trigger room_public_state_touch_updated_at
  before update on public.room_public_state
  for each row execute function private.touch_updated_at();

do $realtime$
declare
  wanted_table text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach wanted_table in array array['room_public_state', 'player_secrets', 'room_messages'] loop
      if not exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = wanted_table
      ) then
        execute format('alter publication %I add table public.%I', 'supabase_realtime', wanted_table);
      end if;
    end loop;
  end if;
end
$realtime$;
