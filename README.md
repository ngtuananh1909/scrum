# Say Agile One More Time

A real-time, 5–10 player social deduction game about Scrum teams, deadlines, and project sabotage. The player interface is Vietnamese-first.

The authoritative rules are in [SYSTEM_BEHAVIOR_SPEC.md](client/docs/SYSTEM_BEHAVIOR_SPEC.md). A match has four regular Sprints and one fifth tiebreaker only after a 2–2 result. Three failed Sprints or four consecutive rejected teams give the bad side a win; three successful Sprints open the final Scrum Master guess.

## Architecture

- [client/src/game](client/src/game/) owns the pure rule engine, timers, role presets, and public/private projections. UI and API code should not duplicate rule decisions.
- [client/src/server](client/src/server/) authenticates commands and mutates a room inside one Postgres transaction. A row lock, phase version, command ID, and unique vote rows protect concurrent play.
- Supabase Anonymous Auth gives each browser a persistent identity without visible sign-in. API routes verify its token and resolve room membership server-side; a submitted player ID is never authorization.
- Internal game state and ballots stay server-only. Realtime publishes a safe public room projection, each player's own private row, and audience-filtered chat under RLS.
- The client Zustand store reconciles snapshots with Realtime and falls back to authenticated polling. Clearing browser storage loses the anonymous identity; another browser cannot reclaim that seat from its displayed player ID.

## Local setup

Requires Node 24, npm, and Docker. From the client directory:

1. Run npm install.
2. Run npm run supabase:start.
3. Copy .env.local.example to .env.local and fill it with values from the local Supabase status output.
4. Run npm run dev and open http://localhost:3000.

For a hosted project, enable Anonymous Sign-Ins and set the equivalent environment variables. DATABASE_URL is a server-only Postgres connection; use Supabase's transaction pooler for a serverless deployment. Keep DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY out of browser code and version control.

The database uses versioned files in [supabase/migrations](supabase/migrations/); [schema.sql](supabase/schema.sql) is the equivalent fresh-install schema. The secure migration archives legacy rooms and messages, revokes their former open access, and invalidates active legacy matches because old seat ownership cannot be verified safely. Start a new room after applying it.

## Play flow

1. Create or join a six-character room by code, link, or QR. The host previews a Beginner, Classic, Advanced, Chaos, or Custom role set. Each match requires exactly one Scrum Master and one Người trễ task.
2. After role reveal and the first-night secret action, each Sprint has 180 seconds of planning discussion and 45 seconds for the PO to choose a team. A timely PM override skips the approval vote.
3. The 30-second team vote shows who submitted a ballot without revealing choices. Missing votes become Reject; choices appear together after voting closes. Four consecutive rejected teams end the match for the bad side.
4. Team members submit secret execution votes in 30 seconds; missing votes become Success. The reveal shuffles anonymous cards. The post-result window allows QC redo and Data Analyst checks.
5. Three failed Sprints give the bad side a win. Three good successes open a 60-second final guess for Người trễ task; a wrong or missed guess gives the good side a win. A 2–2 result after Sprint 4 adds one tiebreaker Sprint with Sprint 4's base team size.

The room UI includes presence, readiness, host controls, rematch, role guidance, a contextual action area, public and bad-team text chat, rate-limited reactions, connection status, and a post-game recap. In-person mode changes presentation, not game rules.

## API and data safety

Authenticated routes under [client/src/app/api/rooms](client/src/app/api/rooms/) handle create, join, viewer snapshot, versioned commands, chat, presence, and ended-role reveal. Former action-specific routes return HTTP 410; use POST /api/rooms/[id]/commands for gameplay and lobby actions. The server checks actor, phase, deadline, targets, and one-shot skills inside a transaction.

Normal room responses and raw Realtime payloads must never contain another player's role, named execution ballot, private check result, or TTS follow target. RLS tests are in [supabase/tests](supabase/tests/). Never treat client-side filtering as a secrecy boundary.

## Verification

From client/, run:

- npm run test:unit
- npm run test:db-policy
- npm run test:integration
- npm run test:e2e
- npm run lint
- npm run build

Start local Supabase before database or browser tests. The browser suite uses isolated player contexts. Any change to a role, timer, vote, or win condition needs an engine test; API or schema changes need concurrency and private-data checks.

## Deployment

Deploy client/ on a Node-capable host. Apply the migration to the target Supabase project before switching traffic, enable Anonymous Sign-Ins and Realtime for only the approved tables, and configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL, and the server-only auth-verification key used by the app. Test a new room and denial of access to archived legacy tables before inviting players.

Brand assets are in [client/public/brand](client/public/brand/README.md). The stitch_agile_sprint_saboteur/ files are static design references, not runtime assets.
