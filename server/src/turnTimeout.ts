// turnTimeout.ts — Prevents a disconnected current-turn player from stalling a
// room forever. If the seat whose turn it is disconnects, a timer starts; if
// they haven't reconnected by the time it fires, their turn is auto-ended so
// play continues. Kept separate from index.ts (no Socket.IO/HTTP dependency)
// so the scheduling logic can be unit-tested with fake timers.

import type { Room } from './room.js'

export const TURN_DISCONNECT_TIMEOUT_MS = 90_000

export class TurnTimeoutManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly onExpire: (room: Room, seat: number) => void,
    private readonly ms: number = TURN_DISCONNECT_TIMEOUT_MS,
  ) {}

  /** Call after a seat disconnects. No-op unless that seat currently owns the turn. */
  scheduleIfNeeded(room: Room, seat: number): void {
    if (!room.engine.started) return
    if (room.engine.phase !== 'turn' || room.engine.currentTurnIndex !== seat) return
    this.clear(room.code)
    const timer = setTimeout(() => {
      this.timers.delete(room.code)
      // Re-check: the seat may have reconnected or the turn may have moved on
      // by other means since the timer was scheduled.
      if (
        room.engine.phase === 'turn' &&
        room.engine.currentTurnIndex === seat &&
        room.socketIdAt(seat) === null
      ) {
        this.onExpire(room, seat)
      }
    }, this.ms)
    this.timers.set(room.code, timer)
  }

  /** Call on reconnect (any seat) and on room deletion to cancel a pending auto-skip. */
  clear(code: string): void {
    const timer = this.timers.get(code)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(code)
    }
  }
}
