# Say Agile One More Time

A real-time multiplayer social deduction game themed around Agile/Scrum terminology.

## Game Rules

**Objective:**
- Good Guys (Scrum Team): Win 3 successful sprints
- Bad Guys (Saboteurs): Win by failing 3 sprints OR 4 consecutive delays

**Roles:**
- Good: Scrum Master, Project Manager, Developer, Business Analyst, Tech Lead, Data Analyst
- Bad: Người trễ task (Saboteur), QC cẩu thả

## Setup

### Local Development

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

### Frontend (Vercel)
```bash
cd client
vercel --prod
```
Set `NEXT_PUBLIC_SOCKET_URL` environment variable to your Socket.io server URL.

### Backend (Socket.io Server)
Requires a Node.js host with WebSocket support:
- **Railway**: `railway up`
- **Render**: Connect GitHub repo
- **Fly.io**: `fly launch`

### Environment Variables
```
NEXT_PUBLIC_SOCKET_URL=https://your-socket-server.railway.app
```

## Tech Stack

- **Frontend**: Next.js, Tailwind CSS, Shadcn UI, Zustand
- **Backend**: Node.js, Express, Socket.io
- **Testing**: Vitest, Playwright
