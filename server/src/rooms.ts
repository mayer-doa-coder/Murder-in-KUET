// rooms.ts — In-memory room registry. Creates rooms with unique codes, looks them
// up for join/reconnect, and sweeps idle/empty rooms so a free-tier instance does
// not leak memory. Rooms are ephemeral (lost on restart) — acceptable for v1.

import { Room } from './room'
import { newRoomCode } from './tokens'

const MAX_ROOMS = 500
const IDLE_TTL_MS = 60 * 60 * 1000       // 1h with no activity → reap
const EMPTY_TTL_MS = 5 * 60 * 1000       // 5m with nobody connected → reap

export class RoomManager {
  private rooms = new Map<string, Room>()

  constructor() {
    setInterval(() => this.sweep(), 60 * 1000).unref?.()
  }

  create(): Room {
    if (this.rooms.size >= MAX_ROOMS) throw new Error('Server is at capacity, try again later')
    let code = newRoomCode()
    while (this.rooms.has(code)) code = newRoomCode()
    const room = new Room(code)
    this.rooms.set(code, room)
    return room
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase())
  }

  delete(code: string): void {
    this.rooms.delete(code.toUpperCase())
  }

  get size(): number { return this.rooms.size }

  private sweep(): void {
    const now = Date.now()
    for (const [code, room] of this.rooms) {
      const idle = now - room.lastActivityAt
      const empty = room.connectedCount() === 0
      if (idle > IDLE_TTL_MS || (empty && idle > EMPTY_TTL_MS) || room.seatCount === 0) {
        this.rooms.delete(code)
      }
    }
  }
}
