# Architecture

The current architecture and setup are summarized in the [root README](../../README.md). The canonical behavior contract is [SYSTEM_BEHAVIOR_SPEC.md](../../client/docs/SYSTEM_BEHAVIOR_SPEC.md).

- client/src/game contains pure phase, role, vote, timer, and visibility rules.
- client/src/server verifies Supabase Anonymous Auth identity and persists commands in locked Postgres transactions.
- supabase/migrations defines the internal game state, unique ballot rows, safe room projection, private player rows, audience-scoped messages, RLS, and Realtime publication.
- client/src/store/gameStore.ts combines viewer snapshots, authorized Realtime rows, and polling fallback for the UI.
- client/src/app/api/rooms exposes create, join, viewer snapshot, versioned commands, chat, presence, and ended-role reveal. Old action routes return HTTP 410.

Only the public projection and RLS-authorized private/message rows reach browser Realtime. The client never receives the full internal room state.
