// index.ts — Express health endpoint + Socket.IO authoritative game server.
//
// Every gameplay decision is made by the per-room GameEngine. Clients only send
// intent (validated here with zod) and receive redacted per-seat snapshots. A
// socket may only act as the seat its token maps to, so no client can spoof
// another player or read hidden state.

import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server, type Socket } from 'socket.io'

import { RoomManager } from './rooms.js'
import type { Room } from './room.js'
import { buildRoomUpdate } from './redact.js'
import { EV, actionSchema, createRoomSchema, joinRoomSchema, reconnectSchema } from './protocol.js'
import { EngineError } from '../../frontend/src/shared/engine'
import type { Action } from './protocol.js'

const PORT = Number(process.env.PORT) || 8787

// Allowed browser origins. Extend via ALLOWED_ORIGINS="https://a.com,https://b.com".
const ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? []),
]
const originCheck = (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
  // Allow same-origin / server-to-server (no Origin header) and any *.vercel.app.
  if (!origin || ORIGINS.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
    return cb(null, true)
  }
  cb(null, false)
}

const app = express()
app.use(cors({ origin: originCheck }))
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }))
app.get('/', (_req, res) => res.send('Murder in KUET — realtime server'))

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: originCheck } })
const rooms = new RoomManager()

// ── Emit helpers ──────────────────────────────────────────────────────────────

function emitError(socket: Socket, message: string): void {
  socket.emit(EV.errorMsg, { message })
}

/** Pushes the correct redacted snapshot to every connected seat in a room. */
function syncRoom(room: Room): void {
  const started = room.engine.started
  const roomUpdate = started ? null : buildRoomUpdate(room)
  for (const seat of room.everySeat()) {
    const sid = room.socketIdAt(seat)
    if (!sid) continue
    if (started) io.to(sid).emit(EV.gameView, room.engine.buildView(seat))
    else io.to(sid).emit(EV.roomUpdate, roomUpdate)
  }
}

function sendPersonalState(socket: Socket, room: Room, seat: number): void {
  socket.emit(EV.youAre, { code: room.code, playerIndex: seat, token: room.seatTokenAt(seat) })
  if (room.engine.started) socket.emit(EV.gameView, room.engine.buildView(seat))
  else socket.emit(EV.roomUpdate, buildRoomUpdate(room))
}

// ── Action dispatch — maps a validated Action to the engine, for `seat`. ────────

function dispatch(room: Room, seat: number, action: Action): void {
  const e = room.engine
  switch (action.type) {
    case 'pickSuspect': e.pickSuspect(seat, action.suspectId); break
    case 'roll':        e.roll(seat); break
    case 'move':        e.move(seat, action.col, action.row); break
    case 'finishMove':  e.finishMove(seat); break
    case 'interrogate': e.interrogate(seat, action.weaponId); break
    case 'respond':     e.respond(seat, action.claim); break
    case 'challenge':   e.challenge(seat, action.challengedIndex, action.revealTargetIndex); break
    case 'accuse':      e.accuse(seat, action.suspectId, action.weaponId, action.locationId); break
    case 'endTurn':     e.endTurn(seat); break
    case 'continue':    e.continueAfterReveal(seat); break
  }
}

// ── Connection lifecycle ────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  socket.on(EV.createRoom, (raw) => {
    const parsed = createRoomSchema.safeParse(raw)
    if (!parsed.success) return emitError(socket, 'Invalid name')
    try {
      const room = rooms.create()
      const { seat, token } = room.addPlayer(parsed.data.name, socket.id)
      room.hostSeat = seat
      socket.data.code = room.code
      socket.emit(EV.youAre, { code: room.code, playerIndex: seat, token })
      syncRoom(room)
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : 'Could not create room')
    }
  })

  socket.on(EV.joinRoom, (raw) => {
    const parsed = joinRoomSchema.safeParse(raw)
    if (!parsed.success) return emitError(socket, 'Invalid join request')
    const room = rooms.get(parsed.data.code)
    if (!room) return emitError(socket, 'Room not found')
    if (room.engine.started) return emitError(socket, 'Game already started')
    try {
      const { seat, token } = room.addPlayer(parsed.data.name, socket.id)
      socket.data.code = room.code
      socket.emit(EV.youAre, { code: room.code, playerIndex: seat, token })
      syncRoom(room)
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : 'Could not join room')
    }
  })

  socket.on(EV.reconnect, (raw) => {
    const parsed = reconnectSchema.safeParse(raw)
    if (!parsed.success) return emitError(socket, 'Invalid reconnect request')
    const room = rooms.get(parsed.data.code)
    if (!room) return emitError(socket, 'Room no longer exists')
    const seat = room.reconnect(parsed.data.token, socket.id)
    if (seat === null) return emitError(socket, 'Seat not found — token expired')
    socket.data.code = room.code
    sendPersonalState(socket, room, seat)
    syncRoom(room)
  })

  socket.on(EV.startGame, () => {
    const room = currentRoom(socket)
    if (!room) return
    const seat = room.seatForSocket(socket.id)
    if (seat !== room.hostSeat) return emitError(socket, 'Only the host can start')
    try {
      room.engine.startGame()
      syncRoom(room)
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : 'Could not start')
    }
  })

  socket.on(EV.action, (raw) => {
    const room = currentRoom(socket)
    if (!room) return
    const seat = room.seatForSocket(socket.id)
    if (seat < 0) return emitError(socket, 'You are not seated in this room')
    const parsed = actionSchema.safeParse(raw)
    if (!parsed.success) return emitError(socket, 'Invalid action')
    try {
      dispatch(room, seat, parsed.data)
      room.touch()
      syncRoom(room)
    } catch (err) {
      if (err instanceof EngineError) emitError(socket, err.message)
      else { emitError(socket, 'Server error'); console.error(err) }
    }
  })

  socket.on(EV.leaveRoom, () => leave(socket))
  socket.on('disconnect', () => leave(socket))
})

function currentRoom(socket: Socket): Room | undefined {
  const code = socket.data.code as string | undefined
  return code ? rooms.get(code) : undefined
}

function leave(socket: Socket): void {
  const room = currentRoom(socket)
  if (!room) return
  const seat = room.seatForSocket(socket.id)
  if (seat < 0) return
  const wasHost = seat === room.hostSeat
  room.handleDisconnect(seat)
  socket.data.code = undefined

  if (room.seatCount === 0) { rooms.delete(room.code); return }

  // Transfer host to the first still-connected seat if the host left.
  if (wasHost && !room.engine.started) {
    const nextHost = room.everySeat().find(s => room.socketIdAt(s) !== null)
    room.hostSeat = nextHost ?? 0
  }
  syncRoom(room)
}

server.listen(PORT, () => {
  console.log(`Murder in KUET server listening on :${PORT}`)
})
