# Room API

All active routes are under client/src/app/api/rooms. Requests that mutate or read member-private state carry a Supabase Anonymous Auth bearer token; the server verifies it and resolves the room seat. A caller-provided player ID is not authorization.

| Method | Route | Purpose |
|---|---|---|
| POST | /api/rooms | Create room and host seat |
| POST | /api/rooms/[id]/join | Join or rejoin a player or spectator |
| GET | /api/rooms/[id] | Viewer-safe public/private snapshot |
| POST | /api/rooms/[id]/commands | Versioned game and lobby command |
| GET, POST | /api/rooms/[id]/chat | Audience-authorized messages |
| POST | /api/rooms/[id]/presence | Member heartbeat |
| GET | /api/rooms/[id]/end-reveal | Roles only after authoritative game end |

Command bodies include commandId, expectedPhaseVersion, type, and typed payload. The server validates phase, actor, deadline, targets, and one-shot constraints under a Postgres row lock. Deprecated action-specific routes return HTTP 410 and must not be restored as authorization bypasses. See [SETUP.md](../../client/docs/SETUP.md) for test and deployment requirements.
