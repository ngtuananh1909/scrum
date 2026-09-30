# Say Agile One More Time

Read [AGENTS.md](AGENTS.md) for repository ownership, engineering rules, and model routing. Read [SYSTEM_BEHAVIOR_SPEC.md](client/docs/SYSTEM_BEHAVIOR_SPEC.md) before changing gameplay; it is the canonical rule source and overrides older notes.

The current app uses a pure rule engine in client/src/game, authenticated room services in client/src/server, restricted Supabase schema in supabase/migrations, and a client store in client/src/store/gameStore.ts. Never put role assignments or execution-vote mappings in a public or raw Realtime payload. Browser identity comes from Supabase Anonymous Auth, not a submitted player ID.

Development and verification commands are in [README.md](README.md). The focused architecture, state, API, and rules notes are in [.claude/docs](.claude/docs/).
