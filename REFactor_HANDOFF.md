# Handoff — Scrum Game Refactor

Last updated: 2026-09-30 19:38 (Asia/Ho_Chi_Minh)
Working branch: `codex/secure-scrum-refactor`
Repository state: large uncommitted refactor. **Do not reset, checkout, or discard changes.** The working tree includes the current implementation and should be continued in place.

Current local status: Supabase is running, the final production build is served at `http://127.0.0.1:3101`, and room `2U2GT9` is open in the visible browser as `Local Tester`.

## Goal and authority

The task is a security, integrity, game-engine, UX, testing, and documentation refactor of the real-time Scrum social deduction game.

Canonical product rules: [client/docs/SYSTEM_BEHAVIOR_SPEC.md](client/docs/SYSTEM_BEHAVIOR_SPEC.md).

The spec overrides the previous README, CLAUDE notes, legacy `GAME_RULES.md`, and old `client/src/lib/store.ts`. The old `GAME_RULES.md` has been reduced to a historical pointer. The old server store was deleted.

User decisions already made:

- UI is Vietnamese-first.
- Use Supabase Anonymous Auth, not app-issued HttpOnly sessions.
- Every playable role set requires exactly one Scrum Master and one **Người trễ task**.
- After four Sprints tied 2–2, play Sprint 5 using Sprint 4’s base team size; Technical Debt still adds one seat.
- If the final 60-second guess expires, good wins.
- Beginner/Classic presets are fixed; Advanced/Chaos are seeded random previews; Custom is manual.
- Remote text is the default communication mode. In-person mode changes presentation only.
- Rematch: host proposes, active players opt in/ready, host starts after all active players are ready.
- Voice is intentionally deferred: secure private text was the requested first implementation. Do not claim voice/microphone muting exists.

## Current target architecture

```text
Browser Anonymous Auth token
  -> authenticated Next room route
  -> room_players seat lookup using auth.uid()
  -> SELECT game_rooms FOR UPDATE
  -> pure game transition(state, command, context)
  -> one transaction persists internal state, normalized votes,
     private views, public projection, events, and command idempotency
  -> RLS-filtered Realtime/public snapshot back to browser
```

### Server-only data

- `game_rooms.internal_state`: full roles, private targets, votes, checkpoints, and phase state.
- `team_votes` and `execution_votes`: normalized ballots; unique by `(room_id, phase_version, player_id)`.
- `applied_commands`: command-id idempotency.
- `player_secrets`: role plus caller-specific private view.
- `game_events`: only allowlisted public event payloads are stored/published.

### Browser-visible data

- `room_public_state`: phase, team, vote submission status, post-reveal team choices and weighted totals, anonymous execution cards, scores, timers, public events, host, settings, and recap history.
- `player_secrets`: own role, permitted role knowledge, private BA/DA results, own TTS target, allowed actions. RLS restricts it to the corresponding player.
- `room_messages`: public or bad-faction audience. Bad chat is enforced by server and RLS.

The browser never receives raw `game_rooms.internal_state`. A request body `playerId` is rejected as an actor claim.

## Main implementation areas

| Area | Current files | Status |
|---|---|---|
| Canonical pure game engine | `client/src/game/` | Implemented and unit tested. |
| Secure server command service | `client/src/server/` | Implemented. Uses bearer auth, transaction locking, stale phase versions, vote uniqueness, public event allowlist, and server CSPRNG. |
| API routes | `client/src/app/api/rooms/` | New create/join/snapshot/commands/chat/presence/end-reveal routes implemented. Old action routes intentionally return HTTP 410. |
| Secure schema | `supabase/migrations/20260929000000_secure_game_schema.sql`, `supabase/schema.sql` | Implemented; migration archives legacy open `rooms/messages` tables and removes them from Realtime. |
| Browser state | `client/src/store/gameStore.ts`, `client/src/lib/browserAuth.ts`, `client/src/lib/supabaseBrowser.ts` | Implemented; anonymous login, authenticated snapshot, RLS Realtime subscriptions, polling fallback, connection state. |
| UI | `client/src/app/page.tsx`, `client/src/app/game/[roomId]/page.tsx`, `client/src/components/game/`, `client/src/components/lobby/` | Implemented and TypeScript-clean. |
| Test tooling | `client/vitest.config.mts`, `client/playwright.config.ts`, `client/tests/`, `.github/` | Added Vitest, Playwright, local Supabase tooling, DB policy tests, integration tests, and CI. |
| Documentation | root README, setup, CLAUDE/AGENTS, `.claude/docs/`, changelog | Updated to current architecture. |

## Important current behavior

### Game rules now implemented

- 30s role reveal -> 20s first night -> 180s Planning discussion -> 45s PO selection -> 30s team vote -> 3s simultaneous team reveal -> 30s secret execution -> 4s anonymous execution reveal -> 20s result/skill window.
- Team-vote timeout fills missing votes as Reject.
- Execution timeout fills missing execution votes as Success.
- Team ballot choices are hidden while voting. After close, named choices reveal together; the UI displays **effective weighted totals** so TTS’s hidden multiplier does not make the result look inconsistent.
- Execution cards are shuffled and do not expose voter identity.
- Three failed Sprints or four rejected teams: bad wins.
- Three successful Sprints: first enter the 20s result window so QC can redo, then enter 60s assassination.
- QC redo restores the saved start-of-Sprint checkpoint, including history and public events, while preserving QC one-time usage.
- TTS target is private; multiplier activates from Sprint 2.
- Technical Leader only saves exactly one fail.
- QC cẩu thả produces fail weight 2.
- Technical Debt changes the next team size.
- PM can override in Planning or PO selection; the game UI now has a direct “Chiếm quyền chỉ định” CTA during PO selection.
- BA/DA results persist privately for reconnect and never enter public event/state.
- Boss/Deadline silence blocks chat/reactions during Planning but does not remove voting rights.
- Reactions use the allowed emoji set, validate targets in the engine, record public events, and are rate-limited server-side to one per 3 seconds per player.
- Rematch is host-only. It clears old secret rows before writing reshuffled roles, and starts at a phase version greater than the preceding ended game so prior commands/role-reveal acknowledgement cannot carry over.

### Privacy/security details

- Supabase Anonymous Auth is invisible in the UI. Same browser reconnects by `auth.uid()`; another browser cannot reclaim a seat using a displayed ID.
- Browser DML is denied. Only server service code writes internal, ballots, events, and command rows.
- Normal snapshot/Realtime data must not reveal another player’s role, TTS target, BA/DA result, or execution-vote mapping.
- Ended role reveal is allowed to any authenticated room member, including spectators, only after authoritative `ended` state. This matches the requested public post-game recap.
- Chat derives sender from the authenticated seat and enforces room membership, audience, silencing, 500-character limit, 5 messages per 10 seconds, and sender-scoped message idempotency.
- Reusing a message command ID with changed text/audience is rejected.

## What has been verified

Fresh verification on 2026-09-30 after the final integration and E2E fixes:

| Check | Latest known result |
|---|---|
| `npm run test:unit` | Passed: 12 files, 66 tests. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint -- --quiet` | Passed with 0 errors. Full lint has non-blocking image/font warnings only. |
| `npm run build` | Passed. |
| `npm run test:db-policy` | Passed: 40 pgTAP schema/RLS assertions. |
| `npm run test:integration` | Passed: 16 real-database tests for auth, privacy, chat, host transfer, custom roles, rematch, reactions, concurrency, timeout race and rollback. |
| `npm run test:e2e` | Passed: one 5-player multi-context flow in 4.4 minutes, including mobile viewport, create/join, ready, start, private role reveal, first night, 180s Planning, PO selection, simultaneous team voting, execution reveal and Sprint result. |

The verified local stack can be started with:

```bash
cd /home/tuananh/Documents/scrum/client
SUPABASE_HOME=/tmp/codex-supabase npm run supabase:start
```

Use the same `SUPABASE_HOME` prefix for DB/integration/E2E checks in this sandbox. The production build is currently served locally at `http://127.0.0.1:3101` against this Supabase stack.

## Latest bugs found and fixes applied

1. **Role-reveal race on separate public/private Realtime rows**
   A player could receive public `roleReveal` state before their private role, so the modal stayed closed.
   Fix: `gameStore.ts` now opens when the private role arrives and tracks acknowledgement by phase version.
   Test: `src/store/gameStore.test.ts`.

2. **Rematch skipped role reveal**
   Rematches reused room ID and phase version 0, allowing a prior acknowledgement to suppress the new modal.
   Fix: `startRematch` uses `previous.phaseVersion + 1`; it also clears `player_secrets` before rewriting shuffled roles to avoid the unique one-SM index collision.
   Integration test passed.

3. **Terminal win skipped QC window**
   Third success/failure ended immediately, preventing QC redo.
   Fix: terminal outcome is decided when the `sprintResult` 20-second window expires.
   Tests cover third failed Sprint and third good Sprint/QC redo.

4. **TTS display mismatch**
   UI showed raw named team-vote counts although outcome uses weighted totals.
   Fix: reveal now displays effective approve/reject totals plus a note that skills may alter weight.
   Test: `TeamVoteBoard.test.tsx`.

5. **Host controls disappeared after game start**
   Public game projection lacked `hostPlayerId`.
   Fix: server persists host/settings into game projection; store derives host status in lobby and game state.
   Store and integration coverage passed.

6. **Custom role set wrongly rejected multiple Developers**
   Server validation was treating every role as single-instance.
   Fix: only non-Developer roles must be unique; the legal six-player two-Developer integration test passed.

7. **Rematch test did not verify recreated secret roles**
   The integration test only checked the new phase/version although the handoff described phase-version and role-swap coverage.
   Fix: the rematch integration test verifies a monotonic phase version and safe secret-row recreation. The full integration suite passed.

## Remaining work / required next steps

### Required verification

All local verification gates requested by the plan are currently green. Rerun the command list below after any further source change. Production deployment and real-device/manual UAT remain separate operational steps.

### Product-scope items intentionally incomplete

- Voice chat and microphone control are not implemented. The spec mentions them, but the request explicitly allowed secure private text first and warned against adding a large unreliable WebRTC system.
- Automated durable scheduling while every player is offline is not implemented. Current phase catch-up occurs on authenticated snapshot/command/presence access or client ticks. Add Supabase Cron/Edge Function only if unattended real-time timer progression is a deployment requirement.
- There is no production migration execution, deployment, push, or PR yet.
- Existing active legacy rooms are intentionally invalidated by the migration; this is documented and must be communicated at deployment.

All local implementation and verification gates in the agreed plan are green. The four items above are explicit deferred/operational scope, not hidden passing claims.

### Code cleanup that may be worthwhile after green verification

- Full lint has only warnings, mostly raw `<img>` in avatar/logo use and one font loading warning. No lint errors. Do not convert remote avatars to `next/image` without configuring safe remote image patterns.
- Check the large `gameStore.ts` and game page after functional verification before splitting further. They are smaller than the old page but still substantial. Avoid refactoring during a verification pass unless a concrete defect appears.
- Keep `client/src/lib/types.ts` as UI copy/lobby count types only. Game rules must stay in `client/src/game/`; do not restore the deleted `client/src/lib/store.ts`.

## Useful commands

```bash
cd /home/tuananh/Documents/scrum/client

# local database lifecycle
SUPABASE_HOME=/tmp/codex-supabase npm run supabase:start
SUPABASE_HOME=/tmp/codex-supabase npm run test:db-policy
SUPABASE_HOME=/tmp/codex-supabase npm run test:integration
SUPABASE_HOME=/tmp/codex-supabase npm run test:e2e

# static checks
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
```

## Git and safety notes

- Current branch: `codex/secure-scrum-refactor`.
- There are dozens of modified/untracked files from this intentional large refactor. Do not use `git reset --hard`, `git checkout --`, or clean the working tree.
- No commit, push, PR, or deployment has been created for this refactor in the current session.
- Preserve the root `AGENTS.md` and this handoff file; both are part of the requested project memory/documentation update.
