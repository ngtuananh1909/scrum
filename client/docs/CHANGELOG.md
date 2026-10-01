# Changelog

## Unreleased

### Security and integrity
- Replaced editable player-ID authorization with Supabase Anonymous Auth and server-verified room membership.
- Separated server-only match state and ballots from RLS-filtered public room state, per-player secrets, and audience-scoped chat.
- Moved game commands into locked Postgres transactions with phase-version checks, command idempotency, unique vote rows, and server-checked deadlines.
- Archived legacy open-access room/message tables and retired old action-specific mutation routes with HTTP 410.

### Gameplay and interface
- Extracted a pure game engine with canonical role presets, corrected win thresholds and timeouts, and a fifth Sprint tiebreaker after a 2–2 result.
- Added separate planning and PO-selection stages, simultaneous team-vote reveal, anonymous execution cards, role guidance, private bad-team text chat, rate-limited public reactions, mobile action controls, presence/readiness, invite QR, and a rematch flow.
- Updated the canonical behavior specification for the explicitly approved tiebreaker, required roles, and final-guess timeout.

### Verification and docs
- Added unit, database policy, real-database integration, and five-browser E2E suites plus CI configuration.
- Rewrote the README, setup, architecture, state, API, and AGENTS guidance to reflect the secure design. Marked the older game-rules brief as historical.
