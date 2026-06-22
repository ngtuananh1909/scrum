# Say Agile One More Time

A real-time multiplayer social deduction game themed around Agile/Scrum terminology.

## Game Rules

**Objective:**
- Good Guys (Scrum Team): Win 3 successful sprints
- Bad Guys (Saboteurs): Win by failing 3 sprints OR 4 consecutive delays

**Roles:**
- Good: Scrum Master, Project Manager, Developer, Business Analyst, Tech Lead, Data Analyst
- Bad: Người trễ task (Saboteur), QC cẩu thả

## Local Development

```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000

## Deployment (Vercel Fullstack)

### 1. Create Vercel KV (Free Tier)

1. Go to https://vercel.com/dashboard
2. Create a new project (import this repo)
3. Go to Storage tab → Create KV Database
4. Copy the `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### 2. Deploy to Vercel

```bash
cd client
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

### 3. Set Environment Variables

In Vercel project settings, add:
- `KV_REST_API_URL` = your KV REST API URL
- `KV_REST_API_TOKEN` = your KV REST API token

## Tech Stack

- **Frontend**: Next.js (App Router), Tailwind CSS, Shadcn UI, Zustand
- **Backend**: Next.js API Routes (Serverless)
- **State**: Vercel KV (Redis)
- **Real-time**: Server-Sent Events (SSE) + Polling fallback

## Architecture

```
Client (Browser)
    │
    ├──── REST API (createRoom, joinRoom, vote, etc.)
    │
    └──── SSE Stream (real-time state updates)
              │
              ▼
         Vercel KV (Redis)
```

For multiplayer to work, users must be on the same Vercel deployment with KV configured.
