begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

-- The migration runs in Supabase's local Postgres, where postgres can seed
-- fixtures even though browser roles cannot write these tables.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-good@example.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-bad@example.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-member@example.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rls-other-room@example.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rls-spectator@example.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'rls-other-role@example.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'rls-outsider@example.test', '', now(), now(), now());

insert into public.game_rooms (room_id, host_player_id, internal_state)
values ('RLS001', null, null), ('RLS002', null, null);

insert into public.room_players (id, room_id, auth_user_id, display_name, joined_order, is_spectator)
values
  ('20000000-0000-0000-0000-000000000001', 'RLS001', '10000000-0000-0000-0000-000000000001', 'Good', 0, false),
  ('20000000-0000-0000-0000-000000000002', 'RLS001', '10000000-0000-0000-0000-000000000002', 'Bad', 1, false),
  ('20000000-0000-0000-0000-000000000003', 'RLS001', '10000000-0000-0000-0000-000000000003', 'Member', 2, false),
  ('20000000-0000-0000-0000-000000000004', 'RLS002', '10000000-0000-0000-0000-000000000004', 'Other room', 0, false),
  ('20000000-0000-0000-0000-000000000005', 'RLS001', '10000000-0000-0000-0000-000000000005', 'Spectator', 3, true),
  ('20000000-0000-0000-0000-000000000006', 'RLS002', '10000000-0000-0000-0000-000000000006', 'Other role', 1, false);

update public.game_rooms
set host_player_id = '20000000-0000-0000-0000-000000000001'
where room_id = 'RLS001';

insert into public.player_secrets (room_id, player_id, role)
values
  ('RLS001', '20000000-0000-0000-0000-000000000001', 'Scrum Master'),
  ('RLS001', '20000000-0000-0000-0000-000000000002', 'Người trễ task'),
  ('RLS001', '20000000-0000-0000-0000-000000000003', 'Project Manager'),
  ('RLS002', '20000000-0000-0000-0000-000000000004', 'Scrum Master'),
  ('RLS002', '20000000-0000-0000-0000-000000000006', 'Người trễ task');

update public.game_rooms
set internal_state = '{"phase":"night"}'
where room_id in ('RLS001', 'RLS002');

insert into public.room_public_state (room_id, revision, payload)
values ('RLS001', 1, '{"phase":"lobby","players":[]}'), ('RLS002', 1, '{"phase":"lobby","players":[]}');

insert into public.room_messages (room_id, audience, sender_player_id, command_id, text)
values
  ('RLS001', 'public', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'public hello'),
  ('RLS001', 'bad', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'bad hello'),
  ('RLS002', 'public', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'other room');

select ok(not has_table_privilege('anon', 'public.game_rooms', 'select'), 'unauthenticated anon key cannot read internal room state');
select ok(not has_table_privilege('authenticated', 'public.game_rooms', 'select'), 'authenticated browser cannot read internal room state');
select ok(not has_table_privilege('authenticated', 'public.room_players', 'select'), 'authenticated browser cannot enumerate room player rows');
select ok(has_table_privilege('authenticated', 'public.room_public_state', 'select'), 'authenticated browser can select the safe projection');
select ok(has_table_privilege('authenticated', 'public.player_secrets', 'select'), 'authenticated browser can select its RLS-filtered secret');
select ok(has_table_privilege('authenticated', 'public.room_messages', 'select'), 'authenticated browser can select RLS-filtered messages');
select ok(not has_table_privilege('authenticated', 'public.team_votes', 'select'), 'authenticated browser cannot read individual team votes');
select ok(not has_table_privilege('authenticated', 'public.execution_votes', 'select'), 'authenticated browser cannot read individual execution votes');
select ok(not has_table_privilege('authenticated', 'public.game_events', 'select'), 'authenticated browser cannot read server event log');
select ok(not has_table_privilege('authenticated', 'public.applied_commands', 'select'), 'authenticated browser cannot read idempotency records');
select ok(not has_table_privilege('authenticated', 'public.room_public_state', 'insert,update,delete'), 'authenticated browser cannot mutate public projection');
select ok(not has_table_privilege('authenticated', 'public.player_secrets', 'insert,update,delete'), 'authenticated browser cannot mutate secrets');
select ok(not has_table_privilege('authenticated', 'public.room_messages', 'insert,update,delete'), 'authenticated browser cannot mutate messages');
select ok(not has_sequence_privilege('authenticated', 'public.room_messages_sequence_seq', 'usage'), 'authenticated browser cannot consume the message sequence');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'private policy helpers are not callable through the anon role');
select ok(to_regclass('public.rooms') is null and to_regclass('public.messages') is null, 'legacy API table names are absent after cutover');
select ok(
  (select count(*) = 9 and bool_and(c.relrowsecurity)
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any (array['game_rooms','room_players','player_secrets','team_votes','execution_votes','room_public_state','room_messages','game_events','applied_commands'])),
  'RLS is enabled on every secure game table'
);
select is(
  (select array_agg(schemaname || '.' || tablename order by schemaname, tablename)::text
   from pg_catalog.pg_publication_tables
   where pubname = 'supabase_realtime'),
  '{public.player_secrets,public.room_messages,public.room_public_state}',
  'Realtime publishes only the safe projection, secrets, and messages'
);
select throws_ok(
  $$insert into public.player_secrets (room_id, player_id, role) values ('RLS001', '20000000-0000-0000-0000-000000000003', 'Scrum Master')$$,
  '23505',
  null,
  'a room cannot assign a second Scrum Master'
);
select throws_ok(
  $$insert into public.player_secrets (room_id, player_id, role) values ('RLS001', '20000000-0000-0000-0000-000000000003', 'Người trễ task')$$,
  '23505',
  null,
  'a room cannot assign a second Người trễ task'
);
select throws_ok(
  $$insert into public.room_messages (room_id, audience, sender_player_id, command_id, text) values ('RLS001', 'public', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'duplicate retry')$$,
  '23505',
  null,
  'a sender command id can insert only one room message'
);
set constraints game_rooms_required_roles_check, player_secrets_required_roles_check immediate;
select throws_ok(
  $$update public.player_secrets set role = 'Developer' where room_id = 'RLS002' and role = 'Người trễ task'$$,
  '23514',
  null,
  'a started room must keep exactly one Scrum Master and one Người trễ task'
);
set constraints game_rooms_required_roles_check, player_secrets_required_roles_check deferred;

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}';
select is((select count(*)::bigint from public.room_public_state), 1::bigint, 'good member sees only their room projection');
select is((select count(*)::bigint from public.player_secrets), 1::bigint, 'good member sees exactly their own secret row');
select is((select role from public.player_secrets), 'Scrum Master', 'good member can read their own role');
select is((select count(*)::bigint from public.player_secrets where player_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'good member cannot read another player secret');
select is((select count(*)::bigint from public.room_messages), 1::bigint, 'good member sees public chat but not bad chat');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}';
select is((select count(*)::bigint from public.room_public_state), 1::bigint, 'bad member sees its room projection');
select is((select count(*)::bigint from public.player_secrets), 1::bigint, 'bad member sees only its own secret row');
select is((select count(*)::bigint from public.room_messages), 2::bigint, 'bad member sees public and bad chat');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}';
select is((select count(*)::bigint from public.room_messages), 1::bigint, 'ordinary member cannot read bad chat');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":true}';
select is((select count(*)::bigint from public.room_public_state where room_id = 'RLS001'), 0::bigint, 'member in another room cannot see this room projection');
select is((select count(*)::bigint from public.player_secrets), 1::bigint, 'member in another room sees only their own secret');
select is((select count(*)::bigint from public.room_messages where room_id = 'RLS002'), 1::bigint, 'member in another room sees only that room chat');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":true}';
select is((select count(*)::bigint from public.room_public_state where room_id = 'RLS001'), 1::bigint, 'spectator can read the safe room projection');
select is((select count(*)::bigint from public.player_secrets), 0::bigint, 'spectator cannot read player secrets');
select is((select count(*)::bigint from public.room_messages), 1::bigint, 'spectator can read public chat but not bad chat');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000007';
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated","is_anonymous":true}';
select is((select count(*)::bigint from public.room_public_state), 0::bigint, 'non-member cannot read any room projection');
select is((select count(*)::bigint from public.player_secrets), 0::bigint, 'non-member cannot read any player secret');
select is((select count(*)::bigint from public.room_messages), 0::bigint, 'non-member cannot read any room messages');

select * from finish();
rollback;
