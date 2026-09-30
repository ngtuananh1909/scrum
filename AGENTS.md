# Project
Real-time Vietnamese-first Agile/Scrum social deduction game for 5–10 players. client/ is the Next.js app; Supabase Postgres, Auth, and Realtime support multiplayer play.

# Repository Map
- client/src/game/: pure canonical rules, phases, role presets, transitions, projections, and unit tests. client/docs/SYSTEM_BEHAVIOR_SPEC.md is the intended-rule authority.
- client/src/server/: verified actor identity, room transactions, command idempotency, public/private projections, and message authorization.
- client/src/app/api/rooms/: create/join/snapshot, versioned commands, chat, presence, and ended-role reveal. Old action-specific endpoints return 410.
- client/src/store/gameStore.ts and client/src/lib/browserAuth.ts: anonymous session, viewer snapshots, Realtime/polling reconciliation, and local UI state.
- client/src/app/page.tsx and client/src/app/game/[roomId]/page.tsx: home lobby and phase UI; client/src/components/game/ and lobby/ own reusable views and actions.
- supabase/migrations/ owns forward schema changes; supabase/schema.sql is fresh setup; supabase/tests/ holds RLS checks. Static Stitch files are visual references.

# Key Flows
- Anonymous Auth token -> server verifies auth.uid -> room_players seat -> locked command transaction -> pure game transition -> internal, vote, event, private, and public rows committed together.
- Browser receives room_public_state and its own player_secrets via RLS-filtered Realtime; secure snapshot/polling reconciles reconnects. Raw internal room state never reaches browser.
- Chat routes derive sender from the seat, enforce audience/silence/rate limits, then insert room_messages; RLS limits private bad-team reads.

# Commands
- From client/: npm install; npm run supabase:start; configure .env.local from the local stack; npm run dev.
- Verify with npm run test:unit, test:db-policy, test:integration, test:e2e, lint, and build. DB/browser tests need Docker and local Supabase.
- The Supabase CLI reads the project at the repository root; hosted deployments apply versioned migrations before serving the new app.

# Conventions & Gotchas
- The canonical spec overrides old README/CLAUDE notes and legacy implementation when rules conflict; do not edit intended rules merely to fit code.
- Bad wins at 3 failed Sprints or 4 rejected teams; 3 good successes open a 60-second final guess. A 2–2 Sprint-4 tie triggers one fifth Sprint with Sprint-4 base size; require exactly one SM and one Người trễ task.
- Planning discussion lasts 180s, then PO selection 45s. Missing team votes become Reject; missing execution votes become Success. Team choices reveal together; execution cards remain anonymous.
- Public projection and events contain no other player's role, named execution vote, BA/DA result, or TTS target. A copied player ID never authorizes a command.
- game_rooms and ballot rows are server-only; browser writes go through authenticated commands. Unique room/phase/player vote rows and row locking prevent lost concurrent ballots.
- Supabase Anonymous Auth preserves the seat in the same browser; clearing its storage loses that identity. Do not promise cross-browser seat recovery from a room code.
- DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY are server-only. Never read local secret values into logs or expose them to client bundles.
- The migration archives insecure legacy rooms/messages and invalidates their active matches; do not re-enable old open RLS or Realtime publication.

# Engineering Rules
- Search current code before assuming behavior; ask only when a correctness-critical ambiguity survives the canonical spec and source inspection.
- Make the smallest correct change using established patterns; avoid unrelated refactors and speculative options.
- For non-trivial work, define steps and verification; reproduce bugs, test the real behavior, and report environment gaps honestly.

# Multi-Agent Routing
- Sol High owns task understanding, decomposition, integration, final reasoning, and reporting; do not use Sol as a routine worker.
- Delegate routine exploration, implementation, tests, and verification to focused Luna Max workers with non-overlapping file ownership.
- Use Terra High only for materially hard cross-module, contradictory, security-sensitive, or architecture reasoning; use independent review when useful.
- Root integrates findings and verifies results; do not re-read large files reliably covered by a worker without a concrete reason.
