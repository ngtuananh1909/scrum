# Setup Guide — Say Agile One More Time

The maintained overview and commands are in the [root README](../../README.md). This guide covers the Supabase setup and security cutover.

## Local development

Requirements: Node 24, npm, Docker, and the Chromium browser installed by Playwright for E2E tests.

1. From client/, run npm install.
2. From client/, run npm run supabase:start. The CLI starts local Postgres, Auth, REST, and Realtime and applies supabase/migrations.
3. Copy client/.env.local.example to client/.env.local. Fill the Supabase URL, anon key, service-role key, and Postgres DATABASE_URL from the local Supabase status output. Keep that file private.
4. From client/, run npm run dev, then open http://localhost:3000.
5. Create a room in one browser and join it from at least four other isolated browser contexts before starting a game.

Supabase Anonymous Auth is enabled in [config.toml](../../supabase/config.toml). It creates a browser identity without asking the player to create a visible account. Clearing browser data or moving to another browser loses that identity; a room code does not prove ownership of the former seat.

## Hosted Supabase project

1. Enable Anonymous Sign-Ins in Supabase Auth settings.
2. On a new database, apply [schema.sql](../../supabase/schema.sql). On an existing deployment, review and apply the versioned migration in [supabase/migrations](../../supabase/migrations/) during a maintenance window.
3. The migration archives the old rooms/messages tables, removes their open Realtime publication and policies, and creates the new restricted tables. Existing active games cannot be safely resumed because their old player IDs were not authenticated; notify players and start fresh rooms.
4. Confirm Realtime publishes only room_public_state, player_secrets, and room_messages. RLS must limit the last two to the caller's own secret row and authorized message audience.
5. Configure the app's server-only DATABASE_URL with the Supabase transaction pooler connection. Keep SUPABASE_SERVICE_ROLE_KEY on the server for Auth token verification. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for browser Auth/Realtime.
6. Deploy client/ on a Node-capable host. Do not send database or service-role credentials to the browser.

## Verify before inviting players

From client/, with local Supabase running:

- npm run test:unit — pure rules, presets, visibility, and client helpers.
- npm run test:db-policy — grants, RLS, role constraints, and publication allowlist.
- npm run test:integration — real-database API authorization, concurrent votes, replay, timeout races, and rollback.
- npm run test:e2e — five isolated browser contexts through the game flow.
- npm run lint and npm run build — code quality and production compilation.

A secure room snapshot and raw Realtime payload must not expose another player's role, named execution ballot, private BA/DA result, or TTS target. A copied player ID must not authorize a command. Legacy action-specific routes return HTTP 410.
