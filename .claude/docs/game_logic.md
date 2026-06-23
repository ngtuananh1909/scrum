# Game Logic & Role Rules

## Game Phases

`Phase = 'lobby' | 'planning' | 'teamVoting' | 'execution' | 'sprintResult' | 'ended'`

### Phase Flow

1. **lobby** — Players join. Room creator can start when 5+ players present.
2. **planning** — Current PO selects players for the sprint team.
3. **teamVoting** — All alive players vote agree/reject on proposed team.
4. **execution** — Team members vote success/fail (good players forced to success).
5. **sprintResult** — Outcome displayed, then next sprint begins (back to planning) or game ends.
6. **ended** — Game over, roles revealed.

## Role System

### Good Roles (60% of players)
`['Scrum Master', 'Project Manager', 'Developer', 'Business Analyst', 'Tech Lead', 'Data Analyst']`

### Bad Roles (40% of players)
`['Người trễ task' (Saboteur)', 'QC cẩu thả']`

### Role Assignment
```ts
goodCount = floor(playerCount * 0.6)
badCount = playerCount - goodCount
// Roles shuffled randomly and assigned
```

### Special Role Powers

| Role | Power |
|------|-------|
| **Tech Lead** | On team during execution → neutralizes 1 fail |
| **Data Analyst** | Can once-per-game check if a player is good or bad |
| **Project Manager** | Can once-per-game override a rejected team proposal |
| **QC cẩu thả** | If on winning execution team → next sprint is "bugged" (bad players know who SM is) |

## Sprint Size Matrix

```ts
SPRINT_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],   // [sprint0, sprint1, sprint2, sprint3, sprint4]
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 5, 6, 6]
}
```

## Win Conditions

### Good Wins
- 3 successful sprints completed

### Bad Wins
- 3 failed sprints
- 4 consecutive rejected team proposals (`consecutiveDelays >= 4`)
- Saboteur correctly guesses the Scrum Master after any good team win

## Voting Rules

### Team Voting (teamVoting phase)
- All alive players vote: `agree` or `reject`
- Majority `agree` → proceed to execution
- Majority `reject` → PO rotates to next player, `consecutiveDelays++`
- If PM override available and team rejected: PM can use override to accept anyway (uses `pmOverrideUsed`)
- 4 consecutive rejects → bad team wins immediately

### Execution Voting (execution phase)
- Only proposed team members vote
- Good players: **must vote `success`** (forced)
- Bad players: vote `success` or `fail` secretly
- `fail` votes >= 1 → sprint fails (sprint 3 of 7-10 player games needs 2 fails: `requiresDoubleFail`)
- Tech Lead on team neutralizes 1 fail (so 1 fail becomes 0 fails → success)
- QC cẩu thả: if team succeeds and QC was on team → `qcBugged = true` for next sprint

## Double Fail Rule

Sprint 3 of games with 7-10 players requires **2 fails** to fail the sprint:
```ts
requiresDoubleFail(playerCount, sprintIndex) // true when playerCount in [7,8,9,10] && sprintIndex === 2
```