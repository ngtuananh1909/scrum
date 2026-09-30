# State Management

The server owns match state. The pure engine in client/src/game transitions authoritative state; client/src/server persists it and derives public and per-player private views. The browser store in client/src/store/gameStore.ts holds received views and local UI/connection state.

- Supabase Anonymous Auth persists a browser identity; room_players binds it to a room seat.
- Commands carry commandId and expectedPhaseVersion. The server resolves the actor from a verified token, locks the room, and commits state plus events atomically.
- room_public_state Realtime updates the shared view. player_secrets and room_messages are restricted by RLS. The client re-fetches an authenticated snapshot after reconnect and polls when Realtime is unavailable.
- Role/check results and execution-vote mappings remain in server-only state or the caller's private view. The ended-role reveal uses a separate endpoint after the game ends.

Do not add game rule decisions to Zustand. See the [root README](../../README.md) for setup and test commands.
