import { useMemo, useState, useCallback } from 'react'
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

// Secret passage pairs — mirrors board.py passages dict
export const SECRET_PASSAGE_MAP: Record<string, string> = {
  auditorium:  'pocket_gate',
  pocket_gate: 'auditorium',
  lotus_pond:  'br_hall',
  br_hall:     'lotus_pond',
}

// Returns the door cells for the passage destination of a given room, or []
export function getPassageDoors(fromRoomId: string): [number, number][] {
  const destRoom = SECRET_PASSAGE_MAP[fromRoomId]
  if (!destRoom) return []
  return (DOOR_POSITIONS[destRoom] ?? []) as [number, number][]
}

// Maps board room IDs → LOCATIONS_CARDS IDs (shared by board rendering and suggestion logic)
export const ROOM_TO_LOCATION_CARD: Record<string, string> = {
  auditorium:    'auditorium',
  swc:           'student_welfare',
  ae_hall:       'amar_ekushey',
  cafeteria:     'cafeteria',
  central_field: 'central_field',
  it_park:       'it_park',
  br_hall:       'begum_rokeya',
  lotus_pond:    'lotus_pond',
  pocket_gate:   'pocket_gate',
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

function cellWalkable(type: CellType): boolean {
  return type === 'hallway' || type === 'door' || type === 'start'
}

export function initializeBoard(): Cell[][] {
  const board: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => ({ type: 'hallway', roomId: null, isWalkable: true }))
  )

  // Fill room interiors — non-walkable solid areas
  for (const [roomId, [c0, c1, r0, r1]] of Object.entries(ROOM_BOUNDS)) {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        board[r][c] = { type: 'room', roomId, isWalkable: false }
      }
    }
  }

  // Fill void — non-walkable centre block
  const [vc0, vc1, vr0, vr1] = VOID_BOUNDS
  for (let r = vr0; r <= vr1; r++) {
    for (let c = vc0; c <= vc1; c++) {
      board[r][c] = { type: 'void', roomId: null, isWalkable: false }
    }
  }

  // Punch-out individual cells back to hallway (room shape exceptions)
  const ROOM_EXCLUSIONS: [number, number][] = [
    [8, 24],  // BR Hall — bottom-left corner cell removed
  ]
  for (const [col, row] of ROOM_EXCLUSIONS) {
    board[row][col] = { type: 'hallway', roomId: null, isWalkable: true }
  }

  // Mark door cells — walkable entry points that belong to their room
  for (const [roomId, doors] of Object.entries(DOOR_POSITIONS)) {
    for (const [col, row] of doors) {
      board[row][col] = { type: 'door', roomId, isWalkable: true }
    }
  }

  // Mark character start cells — walkable, may inherit roomId if inside a room bound
  for (const [col, row] of Object.values(CHAR_STARTS)) {
    board[row][col] = { type: 'start', roomId: board[row][col].roomId, isWalkable: true }
  }

  return board
}

// BFS — only traverses isWalkable cells; returns every reachable cell within `steps`
export function getReachableCells(
  board: Cell[][],
  from: [number, number],
  steps: number
): [number, number][] {
  const [sc, sr] = from
  const dist = new Map<string, number>([[`${sc},${sr}`, 0]])
  const queue: [number, number, number][] = [[sc, sr, 0]]
  const reachable: [number, number][] = []

  while (queue.length > 0) {
    const [col, row, d] = queue.shift()!
    if (d >= steps) continue
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nc = col + dc, nr = row + dr
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
      const key = `${nc},${nr}`
      if (dist.has(key)) continue
      const cell = board[nr]?.[nc]
      if (!cell || !cell.isWalkable) continue   // rooms, walls, void blocked
      dist.set(key, d + 1)
      reachable.push([nc, nr])
      queue.push([nc, nr, d + 1])
    }
  }
  return reachable
}

// BFS path — only traverses isWalkable cells; returns empty if no path found
export function findPath(
  board: Cell[][],
  from: [number, number],
  to: [number, number]
): [number, number][] {
  const [sc, sr] = from
  const [tc, tr] = to
  if (sc === tc && sr === tr) return []

  const parent = new Map<string, string>([[`${sc},${sr}`, '']])
  const queue: [number, number][] = [[sc, sr]]
  let found = false

  outer: while (queue.length > 0) {
    const [col, row] = queue.shift()!
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nc = col + dc, nr = row + dr
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
      const key = `${nc},${nr}`
      if (parent.has(key)) continue
      const cell = board[nr]?.[nc]
      if (!cell || !cell.isWalkable) continue   // rooms, walls, void blocked
      parent.set(key, `${col},${row}`)
      if (nc === tc && nr === tr) { found = true; break outer }
      queue.push([nc, nr])
    }
  }

  if (!found) return []

  const path: [number, number][] = []
  let cur = `${tc},${tr}`
  while (cur !== `${sc},${sr}`) {
    const [c, r] = cur.split(',').map(Number)
    path.unshift([c, r])
    const prev = parent.get(cur)
    if (!prev) break
    cur = prev
  }
  return path
}

// Returns the roomId for a given grid position using ROOM_BOUNDS lookup
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
        imageSrc: p.character.imageSrc,
        accentColor: p.character.accentColor,
        position: (CHAR_STARTS[p.character.id] ?? [12, 12]) as [number, number],
        currentLocation: null,
      })),
    [players]
  )

  const [boardPlayers, setBoardPlayers] = useState<BoardPlayer[]>(initialBoardPlayers)
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0)

  const movePlayer = useCallback((playerId: string, newPos: [number, number]) => {
    setBoardPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, position: newPos } : p))
    )
  }, [])

  // Place the player inside a room — position stays at door (last grid cell)
  const enterRoom = useCallback((playerId: string, roomId: string) => {
    setBoardPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, currentLocation: roomId } : p))
    )
  }, [])

  // Return player to grid at their stored door position
  const exitRoom = useCallback((playerId: string) => {
    setBoardPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, currentLocation: null } : p))
    )
  }, [])

  return { board, boardPlayers, selectedPlayerIndex, setSelectedPlayerIndex, movePlayer, enterRoom, exitRoom }
}

// keep cellWalkable exported for tests / future use
export { cellWalkable }
