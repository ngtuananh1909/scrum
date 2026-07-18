PROJECT: Say Agile One More Time (Real-time Multiplayer Web Game)

TECH STACK: Next.js, Tailwind CSS, Shadcn UI, Socket.io, Node.js, Express, Zustand.

1. CORE LOOP

The game has exactly 4 Sprints (Rounds).

Good Guys (Scrum Team) need 3 successful sprints to win.

Bad Guys need 3 failed Sprints OR 4 consecutive rejected team proposals to win. If Scrum Team does not reach 3 successes after Sprint 4, Bad Guys win.

2. SPRINT PHASES

Phase 1: Planning. Current PO (Product Owner) selects players for the Sprint.

Phase 2: Team Voting. ALL players vote "Agree" or "Reject" on the proposed team. Majority wins. If rejected, PO role passes to the next person. 4 consecutive delays = Bad Guys win.

Phase 3: Execution. Only the selected players vote secretly: "Success" or "Fail". Only Người trễ task and QC cẩu thả may vote Fail. 1 "Fail" vote = Sprint Fails (unless Technical Leader is present or specific player count rules apply).

3. PLAYER COUNT MATRIX (Sprint 1, 2, 3, 4 team sizes)

5 players: 2, 3, 2, 3

6 players: 2, 3, 4, 3

7 players: 2, 3, 3 (requires 2 fails to fail), 4

8 players: 3, 4, 4 (requires 2 fails to fail), 5

9 players: 3, 4, 4 (requires 2 fails to fail), 5

10 players: 3, 4, 5 (requires 2 fails to fail), 6

4. ROLES

[GOOD GUYS]

Scrum Master (SM): Knows who the Saboteurs are at the start.

Project Manager (PM): Once per game, can override the PO and pick the team.

Developer: Standard role, no special ability.

Business Analyst (BA): Once per game checks two players; the result is Yes if either is bad. Kẻ fake CV appears good.

Technical Leader: If on a team, exactly one Fail is converted to Success.

Data Analyst: Once per game, secretly checks a player's past vote.

[BAD GUYS]

Người trễ task (Saboteur): Can vote Fail. If Good Guys win 3 Sprints, they can guess who the SM is to steal the win.

QC cẩu thả: Its Fail vote counts as two Fail votes.

YOUR TASKS (Execute step-by-step, ask for user confirmation before moving to next step)

Init Monorepo: Setup /client (Next.js App Router) & /server (Node.js + Express). Set up basic Socket.io connection.

Backend State Machine: Handle Room creation, user join/leave, role assignment, turn rotation, and the 3 voting phases. Use in-memory data structures.

Frontend UI: Build Lobby, Game Board (track Sprints & Delays), Voting Modals, and Player Role Cards using Tailwind & Shadcn.

Advanced Rules: Implement specific role abilities (PM overrides, Tech Lead immunity, Saboteur SM-guessing phase).

5. TESTING & QUALITY ASSURANCE (NEW)

Please implement the following testing strategies to ensure game stability:

Backend Unit Tests (Jest/Vitest): Write tests for the Game State Engine. Specifically test:

Player role distribution logic based on the matrix.

Sprint voting logic (e.g., verifying 1 "Fail" vote fails the sprint, but Tech Lead prevents it).

Win/Loss condition triggers.

Multiplayer E2E Tests (Playwright): Set up Playwright to simulate multiple browser contexts.

Create a test suite that automatically opens 5 browser instances.

Simulate 5 players joining the same room.

Simulate a full dummy game round (Planning -> Team Voting -> Execution) to ensure Socket.io events broadcast correctly without race conditions.
