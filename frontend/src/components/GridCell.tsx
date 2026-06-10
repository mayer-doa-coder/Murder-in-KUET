import { memo } from 'react'
import { ROOM_BOUNDS } from '../hooks/useBoard'
import type { Cell } from '../types'

// Room base fill colors
const ROOM_BG: Record<string, string> = {
  auditorium:    '#0f000e',
  swc:           '#001208',
  ae_hall:       '#130000',
  cafeteria:     '#130700',
  central_field: '#000f00',
  it_park:       '#000013',
  br_hall:       '#130013',
  lotus_pond:    '#000f0f',
  pocket_gate:   '#0b0b0b',
}

// Floor stripe patterns via CSS repeating-gradient
const ROOM_PATTERN: Record<string, string> = {
  auditorium:    'repeating-linear-gradient(135deg,#130010 0,#130010 3px,#0d0008 3px,#0d0008 7px)',
  swc:           'repeating-linear-gradient(0deg,#001508 0,#001508 3px,#001008 3px,#001008 7px)',
  ae_hall:       'repeating-linear-gradient(90deg,#160000 0,#160000 3px,#100000 3px,#100000 7px)',
  cafeteria:     'repeating-linear-gradient(45deg,#160800 0,#160800 3px,#0f0500 3px,#0f0500 7px)',
  central_field: 'repeating-linear-gradient(0deg,#001300 0,#001300 4px,#000d00 4px,#000d00 8px)',
  it_park:       'repeating-linear-gradient(90deg,#000016 0,#000016 3px,#000011 3px,#000011 7px)',
  br_hall:       'repeating-linear-gradient(135deg,#140014 0,#140014 3px,#0f000f 3px,#0f000f 7px)',
  lotus_pond:    'repeating-linear-gradient(45deg,#001414 0,#001414 3px,#000f0f 3px,#000f0f 7px)',
  pocket_gate:   'repeating-linear-gradient(0deg,#131313 0,#131313 3px,#0d0d0d 3px,#0d0d0d 7px)',
}

// Room wall/grid border colors
const ROOM_BORDER: Record<string, string> = {
  auditorium:    '#240022',
  swc:           '#00260e',
  ae_hall:       '#2a0000',
  cafeteria:     '#2a0d00',
  central_field: '#002400',
  it_park:       '#000026',
  br_hall:       '#240024',
  lotus_pond:    '#002424',
  pocket_gate:   '#1e1e1e',
}

// Brighter accent colors used for door openings
export const ROOM_ACCENT: Record<string, string> = {
  auditorium:    '#880088',
  swc:           '#007744',
  ae_hall:       '#880000',
  cafeteria:     '#885500',
  central_field: '#008800',
  it_park:       '#000099',
  br_hall:       '#880088',
  lotus_pond:    '#008888',
  pocket_gate:   '#555555',
}

// Which side of the door cell faces the hallway
function doorFacing(col: number, row: number, roomId: string): 'top' | 'bottom' | 'left' | 'right' {
  const bounds = ROOM_BOUNDS[roomId]
  if (!bounds) return 'bottom'
  const [c0, c1, r0, r1] = bounds
  if (col === c0) return 'left'
  if (col === c1) return 'right'
  if (row === r0) return 'top'
  if (row === r1) return 'bottom'
  // Interior door — determine by closest wall
  const dLeft = col - c0, dRight = c1 - col
  const dTop = row - r0, dBottom = r1 - row
  const minD = Math.min(dLeft, dRight, dTop, dBottom)
  if (minD === dLeft) return 'left'
  if (minD === dRight) return 'right'
  if (minD === dTop) return 'top'
  return 'bottom'
}

interface GridCellProps {
  cell: Cell
  cellSize: number
  col: number
  row: number
}

function GridCell({ cell, cellSize, col, row }: GridCellProps) {
  const s = cellSize

  if (cell.type === 'void') {
    return (
      <div
        style={{
          width: s, height: s,
          background: '#030303',
          borderRight: '1px solid #060606',
          borderBottom: '1px solid #060606',
          boxSizing: 'border-box',
        }}
        data-col={col} data-row={row} data-cell="1"
      />
    )
  }

  if (cell.type === 'hallway' || cell.type === 'start') {
    // Amber/gold grid tiles — the iconic Cluedo hallway
    const bg = cell.type === 'start' ? '#201c00' : '#181400'
    return (
      <div
        style={{
          width: s, height: s,
          background: bg,
          borderRight: '1px solid #262000',
          borderBottom: '1px solid #262000',
          boxSizing: 'border-box',
          cursor: 'crosshair',
        }}
        data-col={col} data-row={row} data-cell="1"
      />
    )
  }

  if (cell.type === 'room') {
    const pattern = ROOM_PATTERN[cell.roomId!]
    const border  = ROOM_BORDER[cell.roomId!] ?? '#1a1a1a'
    return (
      <div
        style={{
          width: s, height: s,
          background: pattern ?? ROOM_BG[cell.roomId!] ?? '#0a0a0a',
          borderRight: `1px solid ${border}`,
          borderBottom: `1px solid ${border}`,
          boxSizing: 'border-box',
          cursor: 'crosshair',
        }}
        data-col={col} data-row={row} data-cell="1"
      />
    )
  }

  // door — hallway background + thick accent border on hallway-facing side (looks like an opening)
  if (cell.type === 'door') {
    const rid    = cell.roomId!
    const border = ROOM_BORDER[rid] ?? '#1a1a1a'
    const facing = doorFacing(col, row, rid)
    const thin   = `1px solid ${border}`
    const thick  = `3px solid #ffffff`

    return (
      <div
        style={{
          width: s, height: s,
          background: '#181400',
          borderTop:    facing === 'top'    ? thick : thin,
          borderBottom: facing === 'bottom' ? thick : thin,
          borderLeft:   facing === 'left'   ? thick : thin,
          borderRight:  facing === 'right'  ? thick : thin,
          boxSizing: 'border-box',
          cursor: 'crosshair',
        }}
        data-col={col} data-row={row} data-cell="1"
      />
    )
  }

  return (
    <div
      style={{ width: s, height: s, background: '#0a0a0a', boxSizing: 'border-box' }}
      data-col={col} data-row={row} data-cell="1"
    />
  )
}

export default memo(GridCell)
