// redact.ts — Builds the two outbound snapshots. The in-game per-seat GameView is
// produced by the engine itself (GameEngine.buildView strips the solution, other
// hands, and the private revealed card). This module builds the lobby roster,
// which carries no hidden info, and re-exports the engine's redactor for clarity.

import type { GameEngine } from '../../frontend/src/shared/engine'
import type { GameView, RoomUpdate } from '../../frontend/src/shared/protocol'
import { MIN_PLAYERS, MAX_PLAYERS } from '../../frontend/src/shared/engine'
import type { Room } from './room'

export function buildRoomUpdate(room: Room): RoomUpdate {
  const view = room.engine.buildView(0)
  return {
    code: room.code,
    players: view.players.map(p => ({
      index: p.index,
      name: p.name,
      connected: p.connected,
      isHost: p.index === room.hostSeat,
    })),
    hostIndex: room.hostSeat,
    started: room.engine.started,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
  }
}

export function viewForSeat(engine: GameEngine, seat: number): GameView {
  return engine.buildView(seat)
}
