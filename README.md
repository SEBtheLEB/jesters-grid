# Jester's Grid

Realtime 1v1 browser version of the tactical card duel.

## Run Locally

```bash
npm start
```

Open `http://localhost:3000`, create a duel, then send the invite link or room code to the second player.

Run the automated two-player flow with:

```bash
npm run test:multiplayer
```

## Multiplayer Architecture

- Node's built-in HTTP server serves the browser app.
- Native WebSockets keep both players in sync.
- HTTP polling is available as a Vercel-compatible fallback when WebSocket upgrades are not supported.
- Supabase is the canonical room store in production, so requests can safely land on different Vercel instances.
- Every room mutation uses an optimistic revision. Conflicting requests reload and retry instead of overwriting newer state.
- Client-generated action IDs make card, token, ready, and turn actions idempotent across reconnect retries.
- Heartbeats reserve each seat and restore the same player after tab suspension or a temporary connection loss.
- The server owns decks, hands, board state, turns, shots, stuns, tokens, sweeps, locks, and win checks.
- Opponent hands are hidden from each player and exposed only as counts.

## Supabase

Run [supabase/schema.sql](supabase/schema.sql) once in the Supabase SQL editor. Then configure these server-only environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SECRET_OR_SERVICE_ROLE_KEY
SUPABASE_ROOM_TABLE=jesters_grid_rooms
```

The room table has RLS enabled and grants no browser role access. Never put `SUPABASE_SECRET_KEY` in `client.js`, the HTML, or a public environment variable.

## Deploy

Use any Node host that supports WebSockets for the lowest-latency transport. Vercel uses the resilient HTTP sync path with Supabase-backed rooms. A deployment health check is available at `/healthz`; production should report `"roomStore":"supabase"` and `"durableRooms":true`.
