# Setup Guide — Say Agile One More Time

A real-time multiplayer social deduction game (Werewolf/Avalon-style, Agile-themed) deployed on Vercel + Supabase. Free tier friendly.

## 1. Local prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier): https://supabase.com
- A Vercel account (free tier): https://vercel.com — only needed for deployment

## 2. Create the Supabase project

1. Go to https://supabase.com/dashboard and click **New Project**.
2. Pick a name (e.g. `agile-game`), set a strong database password, choose the closest region.
3. Wait ~2 min for provisioning.
4. Go to **SQL Editor** → **New query**.
5. Paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) → click **Run**. You should see two tables created (`rooms`, `messages`), indexes, Realtime publication entries, and RLS policies.

## 3. Get your Supabase API keys

In your Supabase dashboard:

1. Go to **Project Settings** → **API**.
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose)

## 4. Local development

```bash
cd client
cp .env.local.example .env.local
# Edit .env.local and paste the three values from step 3.
npm install
npm run dev
```

Open http://localhost:3000. Open a second browser (incognito) to test multiplayer with two players.

### Try it out
1. In browser A, enter a name, click **Generate** for a room code, click **Create Room**. You'll be redirected to `/game/<code>`.
2. In browser B, enter a different name, type the same room code, click **Join Room**.
3. Once 5+ players are in, anyone can click **Start Game**. Roles are assigned.
4. Open the chat panel below the players grid — send a message in A, see it appear in B (Realtime).
5. Refresh browser A — you rejoin the same room with the same role (player ID persists in localStorage).

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. Go to https://vercel.com/new and **Import** the repo.
3. In **Configure Project**:
   - **Root Directory**: set to `client`
   - **Framework Preset**: Next.js (auto-detected)
4. In **Environment Variables**, add the three from step 3:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**. First deploy takes ~2 min.
6. Once live, share the Vercel URL. Anyone can create a room and play.

## 6. Verify it works

After deploy, open two browsers to your Vercel URL and run through:

- [ ] Create room in browser A, join same code in browser B
- [ ] Chat messages sync both ways within ~500ms
- [ ] Start game → roles appear in browser A and B at the same time
- [ ] Vote on a proposed team → tally broadcasts to both clients
- [ ] Hard-refresh one browser → same player rejoins, role preserved
- [ ] Supabase dashboard → Table Editor → rows appearing in `rooms` and `messages` in real time

## 7. How it works (architecture)

```
Browser                Next.js API (Vercel)         Supabase
   │                          │                        │
   ├── POST /api/rooms ───────►                        │
   │                          ├── UPSERT rooms ────────►
   │                          │                        │
   │   ◄── Realtime channel (postgres_changes) ────────┤
   │                          │                        │
   ├── POST /api/rooms/:id/chat ►                      │
   │                          ├── INSERT messages ─────►
   │                          │                        │
   │   ◄── Realtime channel (postgres_changes) ────────┤
   │                          │                        │
```

- **Persistence**: one Postgres row per room in `public.rooms`, full game state stored as JSONB in `state` column. Every action = one UPSERT.
- **Real-time**: Supabase broadcasts Postgres row changes via WebSocket. The browser subscribes once per room and updates its Zustand store.
- **Polling fallback**: if the Realtime channel errors, the client falls back to 2-second polling against `GET /api/rooms/:id`.
- **Identity**: a UUID v4 is generated in `localStorage` on first visit. Sent in every request body. The server matches on it for rejoins — refresh in the same room preserves your role.
- **Chat**: separate `public.messages` table. Realtime broadcasts new inserts to all subscribers of the same room channel.

## 8. Free-tier limits (Vercel + Supabase)

| Resource | Limit | Headroom |
|---|---|---|
| Vercel function invocations | 100k/day | ~400 full games/day |
| Supabase DB size | 500 MB | ~30k rooms or ~5M messages |
| Supabase Realtime connections | 200 concurrent | 200 simultaneous rooms |
| Supabase Realtime messages | 5M/month | ~50 events × 400 games = 20k/day = 600k/month |

Plenty for a public demo.

## 9. Troubleshooting

- **"Room not found"** — the room's row hasn't been created yet. Make sure step 2 (schema SQL) ran successfully.
- **Realtime never fires** — check that the `supabase_realtime` publication includes both tables. In Supabase dashboard → **Database** → **Publications** → `supabase_realtime` should list `public.rooms` and `public.messages`.
- **"Failed to create room"** — usually means a row with that `id` already exists in `rooms`. Pick a different code or delete the row in Supabase Table Editor.
- **Chat works but room state doesn't update** — Realtime UPDATE on `rooms` requires the row to actually change. Check that `writeRoom` is being called (look in Vercel function logs).
- **`supabaseAdmin` env errors at build time** — `.env.local` must exist before `npm run build` runs. For Vercel, set env vars in project settings, not in code.

## 10. Files of interest

- `client/src/lib/store.ts` — game state machine + Supabase read/write helpers
- `client/src/lib/supabase.ts` — server Supabase client (service role)
- `client/src/lib/supabaseBrowser.ts` — client Supabase client (anon)
- `client/src/lib/identity.ts` — localStorage UUID helper
- `client/src/store/gameStore.ts` — Zustand store with Realtime subscription
- `client/src/components/ChatPanel.tsx` — chat UI
- `supabase/schema.sql` — database schema (run once per Supabase project)
