// room.ts — One game room: a GameEngine plus the per-seat bookkeeping that maps
// authoritative seats to session tokens and live sockets. All rules live in the
// engine; this class only tracks who is who and whether they're connected.

import { GameEngine } from '../../frontend/src/shared/engine'
import { newToken } from './tokens'

export interface Seat {
  token:    string
  socketId: string | null
}

export class Room {
  readonly code: string
  readonly engine: GameEngine
  hostSeat = 0
  lastActivityAt = Date.now()
  private seats: Seat[] = []

  constructor(code: string) {
    this.code = code
    this.engine = new GameEngine()
  }

  touch(): void { this.lastActivityAt = Date.now() }

  get seatCount(): number { return this.seats.length }

  /** Adds a player to the engine + a matching seat record. Returns seat + token. */
  addPlayer(name: string, socketId: string): { seat: number; token: string } {
    const seat = this.engine.addPlayer(name)  // throws EngineError if full/started/dup
    const token = newToken()
    this.seats[seat] = { token, socketId }
    this.touch()
    return { seat, token }
  }

  /** Rebinds a returning player's socket by token. Returns their seat or null. */
  reconnect(token: string, socketId: string): number | null {
    const seat = this.seats.findIndex(s => s?.token === token)
    if (seat < 0) return null
    this.seats[seat].socketId = socketId
    this.engine.setConnected(seat, true)
    this.touch()
    return seat
  }

  seatForSocket(socketId: string): number {
    return this.seats.findIndex(s => s?.socketId === socketId)
  }

  seatForToken(token: string): number {
    return this.seats.findIndex(s => s?.token === token)
  }

  socketIdAt(seat: number): string | null {
    return this.seats[seat]?.socketId ?? null
  }

  seatTokenAt(seat: number): string {
    return this.seats[seat]?.token ?? ''
  }

  everySeat(): number[] {
    return this.seats.map((_s, i) => i)
  }

  /** Marks a seat disconnected. In the lobby the seat is removed entirely. */
  handleDisconnect(seat: number): void {
    if (seat < 0 || seat >= this.seats.length) return
    if (!this.engine.started) {
      this.removeSeat(seat)
    } else {
      this.seats[seat].socketId = null
      this.engine.setConnected(seat, false)
    }
    this.touch()
  }

  private removeSeat(seat: number): void {
    if (!this.engine.removePlayer(seat)) return
    this.seats.splice(seat, 1)
    if (this.hostSeat === seat) this.hostSeat = 0
    else if (this.hostSeat > seat) this.hostSeat -= 1
  }

  /** Number of seats with a live socket. */
  connectedCount(): number {
    return this.seats.filter(s => s?.socketId !== null).length
  }
}
