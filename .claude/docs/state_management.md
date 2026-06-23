# State Management (Zustand)

## Store Location
`client/src/store/gameStore.ts`

## RoomState (interface)

| Field | Type | Description |
|-------|------|-------------|
| `roomId` | `string \| null` | Current room ID |
| `playerId` | `string \| null` | Local player UUID (from localStorage) |
| `playerName` | `string \| null` | Display name |
| `players` | `Player[]` | All players in room |
| `phase` | `Phase \| null` | Current game phase |
| `currentSprint` | `number` | 0-4 |
| `proposedTeam` | `string[]` | Player IDs in proposed team |
| `currentPO` | `Player \| null` | Current Product Owner |
| `myRole` | `string \| null` | This player's assigned role |
| `isGood` | `boolean` | Is this player on good team |
| `saboteurIds` | `string[]` | Bad player IDs (known to other bad players) |
| `smId` | `string \| null` | Scrum Master ID (known to bad players) |
| `goodWins` | `number` | Good team sprint wins (need 3) |
| `badWins` | `number` | Bad team wins |
| `consecutiveDelays` | `number` | 4 = bad team wins |
| `techLeadPresent` | `boolean` | Tech Lead on current team |
| `qcBugged` | `boolean` | QC cẩu thả won last sprint → next sprint bugged |
| `messages` | `ChatMessage[]` | Room chat messages |
| `error` | `string \| null` | Last error message |
| `realtimeChannel` | `RealtimeChannel \| null` | Supabase channel reference |
| `pollingInterval` | `number \| null` | Polling fallback interval ID |

## Key Actions

- `ensurePlayerId()`: Gets or creates localStorage UUID
- `setRoomFromResponse(data)`: Syncs server state → Zustand; handles `currentPO` as index or object
- `subscribeToRoom()`: Opens Supabase Realtime channel; fetches message history first
- `unsubscribeFromRoom()`: Removes channel, stops polling

## Player ID Identity

Player ID is a UUID stored in `localStorage` (key: `player_id`). No authentication — the UUID is the identity. Server matches returning players by this ID on join/rejoin.

## Player Shape

```ts
interface Player {
  id: string;          // UUID from localStorage
  name: string;
  role?: PlayerRole;   // hidden from other players until game end
  isAlive: boolean;
  socketId?: string;   // not used (Realtime uses Supabase channels)
}
```