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
# Terminal 1 - Start Socket.io server
cd server
npm install
node index.js

# Terminal 2 - Start Next.js client
cd client
npm install
npm run dev
```

Open http://localhost:3000

### Running Tests

```bash
# Backend tests (Vitest)
cd server && npm test

# E2E tests (Playwright) - requires both servers running
npx playwright test
```

## Deployment

### Step 1: Deploy Socket.io Server (Railway)

1. Go to https://railway.app
2. Connect your GitHub repo
3. Select the `server` folder as the root
4. Deploy - Railway automatically supports WebSockets

After deployment, copy the Railway URL (e.g., `https://scrum-server.up.railway.app`)

### Step 2: Deploy Frontend (Vercel)

1. Go to https://vercel.com
2. Import the `client` folder
3. Add environment variable:
   - `NEXT_PUBLIC_SOCKET_URL` = your Railway URL (e.g., `https://scrum-server.up.railway.app`)
4. Deploy

### Alternative: Deploy Both on Railway

Railway supports both Node.js and Next.js:

1. Create a `package.json` in root with `concurrently` to run both
2. Or deploy server on Railway and client separately on Vercel

## Tech Stack

- **Frontend**: Next.js, Tailwind CSS, Shadcn UI, Zustand
- **Backend**: Node.js, Express, Socket.io
- **Testing**: Vitest, Playwright
- **Hosting**: Vercel (frontend), Railway (backend with WebSocket)
