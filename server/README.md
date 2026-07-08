# Murder in KUET — Realtime Server

Authoritative Node + Socket.IO server for online multiplayer (3–6 players). It
holds the full secret game state per room and reuses the shared TypeScript rules
in [`../frontend/src/shared`](../frontend/src/shared) via a headless `GameEngine`,
so the online and local games play by identical rules — one codebase, no drift.

## Why authoritative

The single-device build keeps the solution and every hand in the browser, so any
client could read hidden state. Here the server is the only holder of the truth:

- **Redaction** — each client receives a per-seat snapshot (`GameEngine.buildView`)
  with the solution, other hands, and privately-revealed cards stripped out.
- **Server-side rules** — dice, move reachability, bluff/challenge resolution,
  accusation checking, and life deltas are all validated on the server.
- **Token auth** — every action is authorized against an opaque per-player token;
  only the seat the FSM currently expects may act.

## Run locally

```bash
npm install
npm run dev        # tsx watch on :8787 (override with PORT)
npm test           # engine unit tests (vitest)
npm run typecheck
npm run build      # esbuild bundle → dist/index.js (bundles shared rules)
npm start          # node dist/index.js
```

Point the frontend at it with `VITE_WS_URL=http://localhost:8787` (see
`../frontend/.env.example`).

## Protocol

Client → server: `createRoom`, `joinRoom`, `reconnect`, `startGame`, `leaveRoom`,
`action{type,...}` (zod-validated in `src/protocol.ts`).

Server → client: `youAre{code,playerIndex,token}`, `roomUpdate` (lobby roster),
`gameView` (redacted per-seat snapshot), `errorMsg`.

## Deploy (Render free tier)

Use [`../render.yaml`](../render.yaml). Set `ALLOWED_ORIGINS` to your Vercel domain.
Note: the free tier sleeps when idle and loses in-memory rooms on restart.
