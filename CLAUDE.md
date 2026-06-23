# Say Agile One More Time

Onboarding for this codebase.

## Project Overview

Real-time multiplayer social deduction game (Werewolf/Avalon clone) themed around Agile/Scrum. Players form Scrum teams for sprints, vote on proposals, then secretly vote success/fail. Good team wins 3 sprints; bad team wins via 3 failed sprints, 4 consecutive delays, or correctly guessing the Scrum Master.

## Tech Stack

- **Frontend**: Next.js 16.2.9 (App Router), React 19.2.4, TypeScript, Tailwind 4, shadcn/ui, Zustand 5
- **Backend**: Next.js API Routes (serverless on Vercel)
- **State**: Supabase Postgres + Realtime (postgres_changes)
- **Identity**: localStorage UUID (no auth system)
- **Chat**: In-game via Supabase `messages` table

## Dev Commands

```bash
cd client
cp .env.local.example .env.local   # add Supabase keys
npm install
npm run dev                        # http://localhost:3000
npm run build
```

## Core Logic Summary

- **Sprint sizes** defined in `SPRINT_SIZES` map (`client/src/lib/types.ts`): varies by player count (5-10) across 5 sprints
- **Role assignment**: 60% good roles, 40% bad; shuffled randomly
- **Team voting**: majority agree passes; 4 consecutive rejects → bad wins (consecutiveDelays)
- **Execution voting**: 1 fail fails sprint; sprint 3 of 7-10 players needs 2 fails (double fail)
- **Tech Lead** on team neutralizes 1 fail. **QC cẩu thả** bugs next sprint if on winning team.

## Key Constraints

- Never change `SPRINT_SIZES` values — hardcoded team size requirements per sprint
- Never remove `consecutiveDelays` counter or 4-reject win condition
- Never alter the 60/40 good/bad role distribution ratio
- Player identity is localStorage UUID only — no authentication
- Realtime subscription filters: `rooms` table (UPDATE) and `messages` table (INSERT)
- API responses include `state` JSON column from Supabase; client stores denormalized state in Zustand

## Additional Documentation

- [Architecture & Data Flow](./.claude/docs/architecture.md)
- [State Management (Zustand store)](./.claude/docs/state_management.md)
- [Game Logic & Role Rules](./.claude/docs/game_logic.md)
- [API Routes Reference](./.claude/docs/api_routes.md)