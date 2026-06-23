# Architecture & Data Flow

## High-Level Flow

```
Browser ──── REST API ──► Next.js API Routes ──► Supabase Postgres
   ▲                                                    │
   └──── Supabase Realtime (postgres_changes) ──────────┘
```

## Supabase Schema

### `rooms` table
- `id`: UUID, primary key
- `state`: JSONB — contains full Room object (players, phase, votes, sprint, scores)
- `last_updated`: timestamp

### `messages` table
- `id`: serial primary key
- `room_id`: UUID, foreign key to rooms
- `player_id`: UUID
- `player_name`: text
- `text`: text
- `created_at`: timestamp

## Realtime Subscriptions

In `gameStore.ts:subscribeToRoom()`:

1. Subscribe to `rooms` table with filter `id=eq.${roomId}` for UPDATE events
2. Subscribe to `messages` table with filter `room_id=eq.${roomId}` for INSERT events
3. On any subscription error (CHANNEL_ERROR, TIMED_OUT, CLOSED), fallback to 2s polling

## State Flow

1. Client calls REST API → server reads/writes room state in Supabase
2. Server returns updated state + player metadata
3. Client calls `setRoomFromResponse()` to sync Zustand store
4. Supabase Realtime broadcasts room state change to all other clients
5. Other clients receive UPDATE event and call `setRoomFromResponse()` on their side

## API URL

Client uses `NEXT_PUBLIC_API_URL` env var. Defaults to empty string (same origin in dev).