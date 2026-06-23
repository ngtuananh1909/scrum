# API Routes Reference

Base URL: `/api/rooms`

## `POST /api/rooms` — Create Room

**Body:** `{ roomId: string, playerName: string, playerId: string }`

**Response:** `{ roomId, playerId, room, player }`

**Errors:** 400 if room already exists or missing fields.

---

## `GET /api/rooms/[id]` — Get Room

**Response:** `{ room }` (full Room object from Supabase)

---

## `POST /api/rooms/[id]/join` — Join Room

**Body:** `{ playerName: string, playerId: string }`

**Response:** `{ room, player }`

**Behavior:**
- If `playerId` already in room → returns existing player (rejoin path)
- Reject if room not in `lobby` phase or >= 10 players

---

## `POST /api/rooms/[id]/start` — Start Game

**Body:** `{ playerId: string }`

**Response:** `{ room, role, isGood, saboteurIds[], smId }`

**Side effects:**
- Assigns roles to all players
- Sets phase to `planning`
- Bad players receive other saboteur IDs
- Scrum Master receives their own ID as `smId`

---

## `POST /api/rooms/[id]/propose` — Propose Team

**Body:** `{ playerId: string, playerIds: string[] }`

**Response:** `{ room }`

**Constraints:** Only current PO can propose.

---

## `POST /api/rooms/[id]/vote-team` — Team Vote

**Body:** `{ playerId: string, vote: 'agree' | 'reject' }`

**Response:** `{ room }`

**Logic:** When all alive players voted → `tallyTeamVote()` resolves:
- `agree` majority → phase `execution`
- `reject` majority → PO rotates, `consecutiveDelays++`, phase `planning`
- 4 consecutive delays → bad wins, phase `ended`

---

## `POST /api/rooms/[id]/vote-execution` — Execution Vote

**Body:** `{ playerId: string, vote: 'success' | 'fail' }`

**Response:** `{ room }`

**Logic:**
- Good players forced to `success`
- Bad players vote secretly
- When all team members voted → `tallyExecutionVote()` resolves
- Tech Lead on team neutralizes 1 fail
- Sprint 3 of 7-10 player games needs 2 fails (double fail)

---

## `POST /api/rooms/[id]/saboteur-guess` — Guess Scrum Master

**Body:** `{ playerId: string, guessedSmId: string }`

**Response:** `{ winner: 'bad' | 'good', correct: boolean }`

**Constraints:** Only saboteurs can use. Only available after good team wins >= 1 sprint.

---

## `POST /api/rooms/[id]/chat` — Send Chat Message

**Body:** `{ playerId: string, playerName: string, text: string }`

**Response:** `{}` (empty on success)

---

## `GET /api/rooms/[id]/chat` — Get Chat History

**Response:** `{ messages: ChatMessage[] }`

**Used by:** Client on subscribe to backfill messages before Realtime appends new ones.

---

## Server-Side State Storage

All game state lives in `client/src/lib/store.ts` backed by Supabase:

- `readRoom(id)` → select `state` from `rooms` where `id=eq.id`
- `writeRoom(room)` → upsert `{ id, state, last_updated }` into `rooms`

State is a JSONB blob matching the `Room` interface. One UPSERT per action.