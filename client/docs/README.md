# Say Agile One More Time

> A real-time multiplayer social deduction game themed around Agile / Scrum.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.4-149eca)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ecf8e)](https://supabase.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

Werewolf / Avalon-style: each round the team forms a Scrum sprint, votes the team in, then secretly votes success / fail. Good team wins 3 sprints; bad team wins via 3 failed sprints, 4 consecutive delays, or correctly guessing the Scrum Master.

> 🎨 Brand assets live in [`client/public/brand/`](./client/public/brand/README.md) — drop your own logo in to rebrand.

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Game rules](#game-rules)
- [Roles](#roles)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Replacing the logo](#replacing-the-logo)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Real-time multiplayer** — Supabase Realtime pushes every state change to all clients in < 100 ms.
- **No accounts** — players are identified by a localStorage UUID. Join via a 6-character room code or a shared link.
- **Full role asymmetry** — 8 good roles, 7 bad roles, with once-per-game skills (PM override, QC redo, BA check, DA check, Saboteur silence, Deadline silence, …).
- **Reactive UI** — Tailwind 4 + shadcn/ui, mobile-first with bottom drawers and open ballots.
- **Self-healing** — automatic polling fallback if the Realtime socket drops, with a 2 s refresh interval.
- **End-game flow** — auto-opens a modal that lets the host reset the same room or leave to find a new one.

## Quick start

Requires **Node 20+** and a free [Supabase](https://supabase.com) project.

```bash
# 1. Clone & install
git clone <repo> say-agile && cd say-agile
cd client
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local and paste your Supabase URL + anon/service-role keys.

# 3. Set up the database (one time)
# In Supabase SQL editor, run the schema from SETUP.md.
# Two tables: rooms (PK id, state JSONB) and messages (FK room_id).

# 4. Run the dev server
npm run dev
# → http://localhost:3000

# 5. Smoke-test multiplayer
# Open the URL in two private windows; the second tab joins with
# the room code from the first.
```

For a deeper walk-through see **[SETUP.md](./SETUP.md)**.

## Game rules

| Win condition | Side |
|---|---|
| Complete 3 successful sprints | Good |
| Fail 2 sprints | Bad |
| Cause 4 consecutive team-vote rejections | Bad |
| Correctly guess the Scrum Master's identity after good wins | Bad |

Sprint size is fixed per player count and sprint index — see `SPRINT_SIZES` in [`client/src/lib/types.ts`](./client/src/lib/types.ts).

### Round flow

1. **Planning** — current PO proposes a team of `SPRINT_SIZES` size.
2. **Team vote** — alive players vote `agree` / `reject`. Majority wins. Reject rotates the PO; 4 in a row ends the game.
3. **Execution** — proposed team votes `success` / `fail` in secret. Good roles can only vote success. Sprint 3 of 7-10 player games needs 2 fails. A `Technical Leader` on the team cancels 1 fail.
4. **Sprint result** — 20 s window for QC redo / Data Analyst checks, then auto-advance.
5. **Between-sprint discussion** — 90 s open chat before the next night phase.
6. **Night** — bad-side skills (Saboteur silence, Deadline silence), then PM override, then back to planning.

## Roles

**Good (60%)** — Scrum Master, Project Manager, Developer (×N), Business Analyst, Quality Controller, Technical Leader, Data Analyst, Thực tập sinh.

**Bad (40%)** — Người trễ task (×N), Client, Ông sếp khó ưa, Kẻ fake CV, QC cẩu thả, Deadline, Technical Debt.

Full role descriptions and skill triggers live in `ROLE_DESCRIPTIONS` and `ROLE_SKILLS` in [`client/src/lib/types.ts`](./client/src/lib/types.ts).

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack) |
| UI | React 19.2.4 · TypeScript (strict) · Tailwind 4 · shadcn/ui · Material Symbols |
| State | Zustand 5 + sessionStorage cache + Supabase Realtime |
| Backend | Next.js API Routes (serverless) |
| DB | Supabase Postgres (rooms + messages tables) |
| Realtime | Supabase `postgres_changes` |
| Auth | localStorage UUID (no accounts) |
| Hosting | Vercel (recommended) |

## Project structure

```
.
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/rooms/          # REST endpoints (one folder per action)
│   │   │   ├── game/[roomId]/     # In-game page (the bulk of the UI)
│   │   │   ├── layout.tsx         # Root layout + favicon
│   │   │   └── page.tsx           # Lobby (create / join room)
│   │   ├── components/            # Reusable UI (ChatPanel, SkillFab, …)
│   │   │   └── ui/                # shadcn primitives
│   │   ├── lib/                   # types, Supabase client, server store, utils
│   │   └── store/                 # Zustand game store
│   └── public/brand/              # Drop-in logo assets (see below)
├── supabase/                      # SQL migrations / seed
├── SETUP.md                       # Step-by-step setup
├── game-rules.md                  # Original game spec (Vietnamese)
├── DESIGN.md                      # Visual design notes
└── README.md                      # ← you are here
```

## Architecture

```
┌──────────┐  fetch /api  ┌──────────────────┐   UPSERT    ┌──────────────┐
│  Browser │ ───────────► │ Next.js API      │ ──────────► │   Supabase   │
│  (Zust.) │ ◄─────────── │ (serverless)     │ ◄────────── │   Postgres   │
└────┬─────┘   JSON room  └──────────────────┘             └──────┬───────┘
     │                                                            │
     │  postgres_changes (UPDATE rooms, INSERT messages)          │
     └────────────────────────────────────────────────────────────┘
```

The room is a single `rooms` row whose `state` JSONB column holds the full game state. Each player action is one `UPSERT`; Realtime fans the new state out to every subscribed client. If the socket fails, a 2 s polling loop (`pollRoom`) takes over automatically.

## API reference

All endpoints live under `client/src/app/api/rooms/`. Every action accepts JSON `{ playerId, … }` and returns `{ room }`. Some also return caller-specific private data (e.g. role reveal).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/rooms` | Create a room |
| `POST` | `/api/rooms/[id]/join` | Join or rejoin |
| `GET`  | `/api/rooms/[id]` | Get current state |
| `POST` | `/api/rooms/[id]/start` | Host starts the game (assigns roles) |
| `POST` | `/api/rooms/[id]/propose` | PO proposes a team |
| `POST` | `/api/rooms/[id]/vote-team` | Vote on a proposed team |
| `POST` | `/api/rooms/[id]/vote-execution` | Sprint success / fail |
| `POST` | `/api/rooms/[id]/advance` | Acknowledge sprint result |
| `POST` | `/api/rooms/[id]/advance-discussion` | Move from discussion → night |
| `POST` | `/api/rooms/[id]/night-advance` | Move from night → planning |
| `POST` | `/api/rooms/[id]/auto-advance` | Tick-timeout auto-advance |
| `POST` | `/api/rooms/[id]/saboteur-guess` | Saboteur final guess |
| `POST` | `/api/rooms/[id]/chat` | Send a chat message |
| `GET`  | `/api/rooms/[id]/chat` | Fetch message history |
| `POST` | `/api/rooms/[id]/rename` | Change display name |
| `POST` | `/api/rooms/[id]/reset` | End-of-game → back to lobby |
| `POST` | `/api/rooms/[id]/skill-pm-override` | PM forces a team |
| `POST` | `/api/rooms/[id]/skill-pm-defer` | PM defers skill this sprint |
| `POST` | `/api/rooms/[id]/skill-ba-check` | BA yes/no on two targets |
| `POST` | `/api/rooms/[id]/skill-da-check` | DA reveals one past vote |
| `POST` | `/api/rooms/[id]/skill-qc-redo` | QC rewinds the last sprint |
| `POST` | `/api/rooms/[id]/skill-sep-silence` | Sếp silences one player |
| `POST` | `/api/rooms/[id]/skill-deadline-silence` | Deadline silences everyone |
| `POST` | `/api/rooms/[id]/skill-night-zero` | TTS picks a follow target |

## Replacing the logo

All brand assets live in **[`client/public/brand/`](./client/public/brand/README.md)**. Replace any file with the same name (and ideally the same viewBox) and the change is live — no code edits needed.

| File | Use |
|---|---|
| `favicon.svg` | Browser tab |
| `logo-mark.svg` | 64×64 icon |
| `logo.svg` | 200×48 nav bar logo |
| `logo-wordmark.svg` | 320×80 lobby splash |

If you rename a file, search the codebase for `/brand/` to update the references.

## Deployment

The app is designed for **[Vercel](https://vercel.com)**:

1. Push the repo to GitHub.
2. Import the `client/` directory as a Vercel project (Root Directory: `client`).
3. Add env vars in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed)
4. Deploy. Every `git push` to `main` redeploys automatically.

For other hosts, the only requirement is a Node 20+ runtime that supports Next.js 16 App Router (Vercel, Netlify, Cloudflare Pages with the Node adapter, etc.).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Console: `[realtime] falling back to polling: CLOSED` | Supabase Realtime not enabled for the `rooms` table, or row-level security blocking the channel. Check the **Realtime** tab in Supabase. |
| Form field warning about missing id/name | All inputs in the lobby now have ids; if you add a new input, give it a unique `id` and a matching `htmlFor` on its label. |
| Players see different state | Polling is on. Check your network and the Supabase status page. |
| Lobby never advances past `lobby` | The host's `playerId` is the first player; start requires exactly that UUID. Re-create the room if the host's localStorage was cleared. |

## Contributing

1. Fork the repo & create a feature branch.
2. Keep role logic in `client/src/lib/store.ts`, never on the client.
3. Add a system log entry for any new server action (`appendLog`).
4. Run `npm run build` before opening a PR — the type-check is strict.
5. For non-trivial changes, add a short note to the in-repo `CHANGELOG.md`.

## License

MIT — see `LICENSE` (add one before publishing).
