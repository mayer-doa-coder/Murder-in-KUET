// turnTimeout.test.ts — Verifies a disconnected current-turn player's turn is
// auto-skipped after the grace period, and that reconnecting or the turn
// already having moved on cancels/suppresses the auto-skip.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Room } from '../src/room'
import { TurnTimeoutManager, TURN_DISCONNECT_TIMEOUT_MS } from '../src/turnTimeout'

function newStartedRoom(players = 3): Room {
  const room = new Room('TEST')
  for (let i = 0; i < players; i++) room.addPlayer(`P${i + 1}`, `socket-${i}`)
  room.engine.startGame()
  return room
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('TurnTimeoutManager', () => {
  it('auto-ends the turn if the current-turn seat stays disconnected past the timeout', () => {
    const room = newStartedRoom(3)
    const seat = room.engine.currentTurnIndex
    const onExpire = vi.fn((r: Room, s: number) => r.engine.endTurn(s))
    const mgr = new TurnTimeoutManager(onExpire)

    room.handleDisconnect(seat)
    mgr.scheduleIfNeeded(room, seat)

    vi.advanceTimersByTime(TURN_DISCONNECT_TIMEOUT_MS - 1)
    expect(onExpire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(room.engine.currentTurnIndex).not.toBe(seat)
  })

  it('does not fire if the seat reconnects before the timeout', () => {
    const room = newStartedRoom(3)
    const seat = room.engine.currentTurnIndex
    const onExpire = vi.fn()
    const mgr = new TurnTimeoutManager(onExpire)

    const token = room.seatTokenAt(seat)
    room.handleDisconnect(seat)
    mgr.scheduleIfNeeded(room, seat)

    room.reconnect(token, 'new-socket-id')
    mgr.clear(room.code)

    vi.advanceTimersByTime(TURN_DISCONNECT_TIMEOUT_MS + 1000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('does nothing if the disconnected seat does not currently own the turn', () => {
    const room = newStartedRoom(3)
    const seat = room.engine.currentTurnIndex
    const otherSeat = (seat + 1) % 3
    const onExpire = vi.fn()
    const mgr = new TurnTimeoutManager(onExpire)

    room.handleDisconnect(otherSeat)
    mgr.scheduleIfNeeded(room, otherSeat)

    vi.advanceTimersByTime(TURN_DISCONNECT_TIMEOUT_MS + 1000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('does nothing if the game has not started yet', () => {
    const room = new Room('LOBBY')
    room.addPlayer('P1', 'socket-0')
    room.addPlayer('P2', 'socket-1')
    const onExpire = vi.fn()
    const mgr = new TurnTimeoutManager(onExpire)

    room.handleDisconnect(0)
    mgr.scheduleIfNeeded(room, 0)

    vi.advanceTimersByTime(TURN_DISCONNECT_TIMEOUT_MS + 1000)
    expect(onExpire).not.toHaveBeenCalled()
  })
})
