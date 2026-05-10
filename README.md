# Jester's Grid

Realtime 1v1 browser version of the tactical card duel.

## Run Locally

```bash
node server.js
```

Open `http://localhost:3000`, create a duel, then send the invite link or room code to the second player.

## Multiplayer Shape

- Node's built-in HTTP server serves the browser app.
- Native WebSockets keep both players in sync.
- The server owns decks, hands, board state, turns, shots, stuns, tokens, sweeps, locks, and win checks.
- Opponent hands are hidden from each player and exposed only as counts.

## Deploy

Use any Node host that supports WebSockets. Render, Railway, Fly.io, and a small VPS are good fits. The server reads `PORT` from the environment and has no runtime npm dependencies.
