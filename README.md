# Say Agile One More Time

A real-time multiplayer social deduction game themed around Agile/Scrum terminology. Werewolf/Avalon-style: pick a Scrum team for each sprint, vote them in, then secretly vote success/fail.

## Quick start

See **[SETUP.md](./SETUP.md)** for the full step-by-step.

```bash
cd client
cp .env.local.example .env.local      # paste your Supabase keys
npm install
npm run dev
```

Open http://localhost:3000 in two browsers to test multiplayer.

## Game Rules

**Objective:**
- Good Guys (Scrum Team): Win 3 successful sprints
- Bad Guys (Saboteurs): Win by failing 3 sprints OR 4 consecutive delays OR correctly guessing the Scrum Master

**Roles:**
- Good: Scrum Master, Project Manager, Developer, Business Analyst, Tech Lead, Data Analyst
- Bad: Người trễ task (Saboteur), QC cẩu thả

**Loop (up to 5 sprints):**
1. **Planning** — current PO picks a team (size per `SPRINT_SIZES` matrix in `src/lib/types.ts`).
2. **Team Vote** — all alive players vote agree/reject. Majority wins. Reject rotates PO; 4 consecutive rejects = bad wins.
3. **Execution** — team members secretly vote success/fail (good forced to success). 1 fail = sprint fails (2 fails needed in sprint 3 of 7-10 player games). Tech Lead on team prevents fail. QC cẩu thả on team bugs the NEXT sprint.
4. **Win** at 3 good sprints, 3 bad sprints, or 4 consecutive delays. Saboteur can also guess the SM after good wins to steal.

## Tech stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn UI, Zustand
- **Backend**: Next.js API Routes (serverless on Vercel)
- **State**: Supabase Postgres + Realtime (free tier)
- **Real-time**: Supabase Realtime (Postgres Changes), polling fallback
- **Identity**: localStorage UUID (no accounts)
- **Chat**: in-game room chat via Supabase

## Architecture

```
Browser ──── REST API (create/join/vote/chat) ──► Next.js API Routes ──► Supabase Postgres
   ▲                                                                              │
   └──── Realtime WebSocket (postgres_changes on rooms UPDATE + messages INSERT) ──┘
```

## Deploy

See [SETUP.md](./SETUP.md) → step 5 for Vercel deployment. Set the three Supabase env vars in the Vercel project settings.
