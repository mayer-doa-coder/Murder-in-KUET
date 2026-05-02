import { useMemo, useState } from 'react'
import type { Cell, CellType, BoardPlayer } from '../types'
import type { PlayerSetup } from '../types'

export const ROWS = 25
export const COLS = 24

// [colStart, colEnd, rowStart, rowEnd] — all inclusive
export const ROOM_BOUNDS: Record<string, [number, number, number, number]> = {
  auditorium:    [0,  6,  0,  3],
  swc:           [9,  14, 0,  6],
  ae_hall:       [17, 23, 0,  5],
  cafeteria:     [0,  6,  6,  10],
  central_field: [0,  5,  12, 16],
  it_park:       [0,  5,  19, 24],
  br_hall:       [8,  15, 17, 24],
  lotus_pond:    [18, 23, 18, 24],
  pocket_gate:   [16, 23, 9,  15],
}

export const VOID_BOUNDS: [number, number, number, number] = [9, 13, 10, 15]

export const CHAR_STARTS: Record<string, [number, number]> = {
  chef:           [16, 0],
  hallboy:        [23, 7],
  security_guard: [15, 24],
  shopkeeper:     [9,  24],
  student_girl:   [0,  17],
  student_boy:    [0,  5],
}

// Door cells — boundary cells where players enter/exit rooms
// Each entry is [col, row] at the room wall facing a hallway
export const DOOR_POSITIONS: Record<string, [number, number][]> = {
  auditorium:    [[6, 1], [4, 3]],
  swc:           [[9, 4], [14, 2]],
  ae_hall:       [[17, 3], [20, 5]],
  cafeteria:     [[6, 8], [3, 10]],
  central_field: [[5, 14], [2, 12]],
  it_park:       [[5, 21], [3, 19]],
  br_hall:       [[11, 17], [8, 20]],
  lotus_pond:    [[20, 18], [18, 21]],
  pocket_gate:   [[16, 12], [19, 9]],
}

export const ROOM_DISPLAY_NAMES: Record<string, string> = {
  auditorium:    'AUDITORIUM',
  swc:           'STUDENT\nWELFARE CTR',
  ae_hall:       'AMAR\nEKUSHEY HALL',
  cafeteria:     'CAFETERIA',
  central_field: 'CENTRAL\nFIELD',
  it_park:       'IT PARK',
  br_hall:       'BEGUM\nROKEYA HALL',
  lotus_pond:    'LOTUS\nPOND',
  pocket_gate:   'POCKET\nGATE',
}

export function initializeBoard(): Cell[][] {
  const board: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ type: 'hallway' as CellType, roomId: null }))
  )

  for (const [roomId, [c0, c1, r0, r1]] of Object.entries(ROOM_BOUNDS)) {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        board[r][c] = { type: 'room', roomId }
      }
    }
  }

  const [vc0, vc1, vr0, vr1] = VOID_BOUNDS
  for (let r = vr0; r <= vr1; r++) {
    for (let c = vc0; c <= vc1; c++) {
      board[r][c] = { type: 'void', roomId: null }
    }
  }

  // Punch-out individual cells back to hallway (room shape exceptions)
  const ROOM_EXCLUSIONS: [number, number][] = [
    [8, 24],  // BR Hall — bottom-left corner cell removed
  ]
  for (const [col, row] of ROOM_EXCLUSIONS) {
    board[row][col] = { type: 'hallway', roomId: null }
  }

  // Mark door cells (after rooms, so they override room type)
  for (const [roomId, doors] of Object.entries(DOOR_POSITIONS)) {
    for (const [col, row] of doors) {
      board[row][col] = { type: 'door', roomId }
    }
  }

  for (const [col, row] of Object.values(CHAR_STARTS)) {
    board[row][col] = { type: 'start', roomId: board[row][col].roomId }
  }

  return board
}

export function getPlayerRoom(col: number, row: number): string | null {
  for (const [roomId, [c0, c1, r0, r1]] of Object.entries(ROOM_BOUNDS)) {
    if (col >= c0 && col <= c1 && row >= r0 && row <= r1) return roomId
  }
  return null
}

export function useBoard(players: PlayerSetup[]) {
  const board = useMemo(() => initializeBoard(), [])

  const initialBoardPlayers: BoardPlayer[] = useMemo(
    () =>
      players.map((p) => ({
        id: p.character.id,
        name: p.character.name,
        icon: p.character.icon,
        accentColor: p.character.accentColor,
        position: (CHAR_STARTS[p.character.id] ?? [12, 12]) as [number, number],
      })),
    [players]
  )

  const [boardPlayers, setBoardPlayers] = useState<BoardPlayer[]>(initialBoardPlayers)
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0)

  const movePlayer = (playerId: string, newPos: [number, number]) => {
    setBoardPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, position: newPos } : p))
    )
  }

  return { board, boardPlayers, selectedPlayerIndex, setSelectedPlayerIndex, movePlayer }
}
