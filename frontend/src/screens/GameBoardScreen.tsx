import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  useBoard,
  ROOM_DISPLAY_NAMES,
  ROOM_BOUNDS,
  DOOR_POSITIONS,
  CHAR_STARTS,
  COLS,
  ROWS,
  getPlayerRoom,
} from '../hooks/useBoard'
import { ROOM_ACCENT } from '../components/GridCell'
import GridCell from '../components/GridCell'
import PlayerToken from '../components/PlayerToken'
import type { PlayerSetup, GameDeal } from '../types'

interface Props {
  players: PlayerSetup[]
  deal: GameDeal
  onExit: () => void
}

// ── Room visual config ────────────────────────────────────────────────────────
const ROOM_LABEL_COLORS: Record<string, string> = {
  auditorium:    '#cc66ee',
  swc:           '#44cc88',
  ae_hall:       '#ee5555',
  cafeteria:     '#ee9944',
  central_field: '#55cc55',
  it_park:       '#4488ee',
  br_hall:       '#cc66ee',
  lotus_pond:    '#44cccc',
  pocket_gate:   '#aaaaaa',
}

// Room label anchors — [centerCol, centerRow] within each room
const ROOM_LABEL_ANCHORS: Record<string, [number, number]> = {
  auditorium:    [3,    1.5],
  swc:           [11.5, 3  ],
  ae_hall:       [20,   2.5],
  cafeteria:     [3,    8  ],
  central_field: [2.5,  14 ],
  it_park:       [2.5,  21.5],
  br_hall:       [11.5, 20.5],
  lotus_pond:    [20.5, 21.5],
  pocket_gate:   [19.5, 12 ],
}

// ── Furniture definitions (all coords in cell units) ─────────────────────────
// rect: { shape:'rect', x, y, w, h, fill }  — x/y = top-left corner
// circ: { shape:'circ', cx, cy, r, fill }   — center + radius
type FItem =
  | { shape: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { shape: 'circ'; cx: number; cy: number; r: number; fill: string }

const FURNITURE: FItem[] = [
  // ── Auditorium: lecture desk + row of chairs ──────────────────────────────
  { shape: 'rect', x: 0.6, y: 0.2, w: 4.8, h: 0.7, fill: '#250018' },  // desk
  { shape: 'rect', x: 0.7, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 1.6, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 2.5, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 3.4, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 4.3, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 0.3, y: 2.6,  w: 6.0, h: 0.35, fill: '#160008' }, // stage edge

  // ── SWC: two long tables with chairs ─────────────────────────────────────
  { shape: 'rect', x: 9.4,  y: 0.9, w: 2.2, h: 1.2, fill: '#001e0c' },
  { shape: 'rect', x: 11.9, y: 0.9, w: 2.2, h: 1.2, fill: '#001e0c' },
  { shape: 'rect', x: 9.3,  y: 4.0, w: 4.8, h: 0.8, fill: '#001408' }, // counter

  // ── AE Hall: three bed/desk units ────────────────────────────────────────
  { shape: 'rect', x: 17.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 19.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 21.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },

  // ── Cafeteria: 4 dining tables ────────────────────────────────────────────
  { shape: 'rect', x: 0.4, y: 6.5, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 3.3, y: 6.5, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 0.4, y: 8.4, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 3.3, y: 8.4, w: 2.4, h: 1.4, fill: '#1c0c00' },

  // ── Central Field: grass centre circle ───────────────────────────────────
  { shape: 'circ', cx: 2.5, cy: 14.2, r: 1.5, fill: '#001c00' },

  // ── IT Park: 4 computer workstations ─────────────────────────────────────
  { shape: 'rect', x: 0.3, y: 19.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 2.7, y: 19.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 0.3, y: 21.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 2.7, y: 21.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 0.3, y: 23.4, w: 1.9, h: 1.0, fill: '#000014' },
  { shape: 'rect', x: 2.7, y: 23.4, w: 1.9, h: 1.0, fill: '#000014' },

  // ── BR Hall: large dining table + side unit ───────────────────────────────
  { shape: 'rect', x: 9.0,  y: 18.4, w: 5.5, h: 2.8, fill: '#1c001c' },
  { shape: 'rect', x: 9.0,  y: 22.2, w: 5.5, h: 0.9, fill: '#140014' },

  // ── Lotus Pond: water pool ────────────────────────────────────────────────
  { shape: 'circ', cx: 20.5, cy: 21.2, r: 2.2, fill: '#001c1c' },
  { shape: 'circ', cx: 20.5, cy: 21.2, r: 1.1, fill: '#001414' },

  // ── Pocket Gate: gate pillars + arch ─────────────────────────────────────
  { shape: 'rect', x: 17.0, y: 10.5, w: 1.2, h: 3.0, fill: '#1e1e1e' }, // left pillar
  { shape: 'rect', x: 21.8, y: 10.5, w: 1.2, h: 3.0, fill: '#1e1e1e' }, // right pillar
  { shape: 'rect', x: 17.0, y: 10.0, w: 6.0, h: 0.8, fill: '#242424' }, // arch top
]

// ── Start position labels ─────────────────────────────────────────────────────
// dir: which board edge the start cell touches
type StartLabel = {
  charId:   string
  col:      number
  row:      number
  dir:      'top' | 'bottom' | 'left' | 'right'
  label:    string
}
const START_LABELS: StartLabel[] = [
  { charId: 'chef',           col: 16, row: 0,  dir: 'top',    label: 'START\nCHEF'       },
  { charId: 'hallboy',        col: 23, row: 7,  dir: 'right',  label: 'START\nHALLBOY'    },
  { charId: 'security_guard', col: 15, row: 24, dir: 'bottom', label: 'START\nSEC.GUARD'  },
  { charId: 'shopkeeper',     col: 9,  row: 24, dir: 'bottom', label: 'START\nSHOPKEEPR'  },
  { charId: 'student_girl',   col: 0,  row: 17, dir: 'left',   label: 'START\nSTD.GIRL'   },
  { charId: 'student_boy',    col: 0,  row: 5,  dir: 'left',   label: 'START\nSTD.BOY'    },
]

// ── Secret passage corner arrows ──────────────────────────────────────────────
// Auditorium ↔ Pocket Gate,  Lotus Pond ↔ Begum Rokeya Hall
const SECRET_PASSAGES = [
  { col: 5.5, row: 2.8, arrow: '↘', label: 'SECRET' },  // Auditorium → Pocket Gate
  { col: 17,  row: 9.5, arrow: '↖', label: 'SECRET' },  // Pocket Gate → Auditorium
  { col: 18.5,row: 18.5,arrow: '↖', label: 'SECRET' },  // Lotus Pond → BR Hall
  { col: 14.5,row: 23.5,arrow: '↘', label: 'SECRET' },  // BR Hall → Lotus Pond
]

const SIDEBAR_W = 204
const HEADER_H  = 38
const PAD       = 6

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameBoardScreen({ players, deal, onExit }: Props) {
  const [vw, setVw] = useState(window.innerWidth)
  const [vh, setVh] = useState(window.innerHeight)

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const cellSize = Math.max(12, Math.floor(Math.min(
    (vw - SIDEBAR_W - PAD * 2) / COLS,
    (vh - HEADER_H - PAD * 2) / ROWS,
  )))

  const boardW = cellSize * COLS
  const boardH = cellSize * ROWS

  const { board, boardPlayers, selectedPlayerIndex, setSelectedPlayerIndex, movePlayer } =
    useBoard(players)

  const flatCells = useMemo(() => board.flat(), [board])

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      const colStr = target.getAttribute('data-col')
      const rowStr = target.getAttribute('data-row')
      if (colStr === null || rowStr === null) return
      const col = parseInt(colStr)
      const row = parseInt(rowStr)
      if (isNaN(col) || isNaN(row)) return
      const cell = board[row]?.[col]
      if (!cell || cell.type === 'void') return
      const p = boardPlayers[selectedPlayerIndex]
      if (p) movePlayer(p.id, [col, row])
    },
    [board, boardPlayers, selectedPlayerIndex, movePlayer]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1
      if (!isNaN(idx) && idx >= 0 && idx < boardPlayers.length) setSelectedPlayerIndex(idx)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [boardPlayers.length, setSelectedPlayerIndex])

  const selectedPlayer = boardPlayers[selectedPlayerIndex]

  // Build a lookup: charId → accent color (from boardPlayers)
  const charColors: Record<string, string> = {}
  boardPlayers.forEach(p => { charColors[p.id] = p.accentColor })

  // Label font size
  const lfs = Math.max(4, Math.floor(cellSize * 0.19))

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#020204' }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div
        className="font-pixel flex items-center justify-between px-4 shrink-0"
        style={{ height: HEADER_H, background: '#060308', borderBottom: '2px solid #180015' }}
      >
        <motion.button
          className="font-pixel"
          style={{ fontSize: '6px', color: '#4a1535', background: 'transparent',
            border: '1px solid #2a0820', padding: '3px 9px', cursor: 'pointer', letterSpacing: '1px' }}
          whileHover={{ color: '#cc2255', borderColor: '#660030' }}
          onClick={onExit}
        >
          ← EXIT
        </motion.button>
        <div style={{ fontSize: '7px', color: '#6a0030', letterSpacing: '4px' }}>
          MURDER IN KUET
        </div>
        <div style={{ fontSize: '5px', color: '#2a0818', letterSpacing: '2px' }}>
          KUET CAMPUS BOARD
        </div>
      </div>

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Board area — dark green felt surround ───────────────────────────── */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden"
          style={{ padding: PAD, background: '#040a04' }}
        >
          {/* Board container — overflow:visible so edge labels bleed out */}
          <div
            className="relative shrink-0"
            style={{ width: boardW, height: boardH, overflow: 'visible' }}
          >
            {/* ── Grid cells ───────────────────────────────────────────────── */}
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
                gridTemplateRows:    `repeat(${ROWS}, ${cellSize}px)`,
              }}
              onClick={handleGridClick}
            >
              {flatCells.map((cell, i) => (
                <GridCell
                  key={i}
                  cell={cell}
                  cellSize={cellSize}
                  col={i % COLS}
                  row={Math.floor(i / COLS)}
                />
              ))}
            </div>

            {/* ── SVG overlay — furniture, start labels, secret passages ────── */}
            <svg
              style={{ position: 'absolute', inset: 0, overflow: 'visible',
                width: boardW, height: boardH, pointerEvents: 'none', zIndex: 2 }}
            >
              {/* Furniture shapes */}
              {FURNITURE.map((item, i) => {
                if (item.shape === 'rect') {
                  return (
                    <rect key={i}
                      x={item.x * cellSize} y={item.y * cellSize}
                      width={item.w * cellSize} height={item.h * cellSize}
                      fill={item.fill} rx={1}
                    />
                  )
                }
                return (
                  <circle key={i}
                    cx={item.cx * cellSize} cy={item.cy * cellSize}
                    r={item.r * cellSize}
                    fill={item.fill}
                  />
                )
              })}

              {/* Door arch indicators — small bar on the hallway-facing edge of each door */}
              {Object.entries(DOOR_POSITIONS).flatMap(([roomId, doors]) =>
                doors.map(([dc, dr], di) => {
                  const bounds = ROOM_BOUNDS[roomId]
                  if (!bounds) return null
                  const [c0, c1, r0] = bounds
                  const accent = ROOM_ACCENT[roomId] ?? '#666'
                  const x0 = dc * cellSize, y0 = dr * cellSize
                  const gap = Math.max(1, cellSize * 0.18)
                  const thick = Math.max(2, cellSize * 0.18)

                  let rx = x0 + gap, ry = y0, rw = cellSize - gap * 2, rh = thick
                  if (dc === c0) { rx = x0; ry = y0 + gap; rw = thick; rh = cellSize - gap * 2 }
                  else if (dc === c1) { rx = x0 + cellSize - thick; ry = y0 + gap; rw = thick; rh = cellSize - gap * 2 }
                  else if (dr === r0) { rx = x0 + gap; ry = y0; rw = cellSize - gap * 2; rh = thick }
                  else { rx = x0 + gap; ry = y0 + cellSize - thick; rw = cellSize - gap * 2; rh = thick }

                  return (
                    <rect key={`door-${roomId}-${di}`}
                      x={rx} y={ry} width={rw} height={rh}
                      fill={accent} opacity={0.9} rx={1}
                    />
                  )
                })
              )}

              {/* Secret passage arrows at room corners */}
              {SECRET_PASSAGES.map((sp, i) => (
                <g key={i}>
                  <text
                    x={sp.col * cellSize} y={sp.row * cellSize}
                    fontSize={Math.max(6, cellSize * 0.4)}
                    fill="#ccaa00" opacity={0.85}
                    fontFamily="monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {sp.arrow}
                  </text>
                  <text
                    x={sp.col * cellSize} y={sp.row * cellSize + cellSize * 0.45}
                    fontSize={Math.max(3, cellSize * 0.15)}
                    fill="#887700" opacity={0.7}
                    fontFamily="'Press Start 2P', monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    letterSpacing="0.3"
                  >
                    {sp.label}
                  </text>
                </g>
              ))}

              {/* Start position labels around board perimeter */}
              {START_LABELS.map(({ charId, col, row, dir, label }) => {
                const color  = charColors[charId] ?? '#aaaaaa'
                const cx     = (col + 0.5) * cellSize
                const cy     = (row + 0.5) * cellSize
                const margin = cellSize * 0.6

                let tx = cx, ty = cy, anchor = 'middle', rot = 0
                if (dir === 'top')    { ty = -margin }
                if (dir === 'bottom') { ty = boardH + margin }
                if (dir === 'left')   { tx = -margin * 0.4; anchor = 'end'; rot = -90 }
                if (dir === 'right')  { tx = boardW + margin * 0.4; anchor = 'start'; rot = 90 }

                const lines = label.split('\n')
                return (
                  <g key={charId} transform={rot ? `rotate(${rot},${tx},${ty})` : undefined}>
                    {lines.map((line, li) => (
                      <text key={li}
                        x={tx} y={ty + li * (lfs + 2) - ((lines.length - 1) * (lfs + 2)) / 2}
                        fontSize={lfs}
                        fill={color} opacity={0.85}
                        fontFamily="'Press Start 2P', monospace"
                        textAnchor={anchor}
                        dominantBaseline="middle"
                        letterSpacing="0.5"
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                )
              })}

              {/* Start dot on each start cell */}
              {Object.entries(CHAR_STARTS).map(([charId, [sc, sr]]) => (
                <circle key={charId}
                  cx={(sc + 0.5) * cellSize} cy={(sr + 0.5) * cellSize}
                  r={Math.max(2, cellSize * 0.12)}
                  fill={charColors[charId] ?? '#888'}
                  opacity={0.55}
                />
              ))}
            </svg>

            {/* ── Room name labels ─────────────────────────────────────────── */}
            {Object.entries(ROOM_LABEL_ANCHORS).map(([roomId, [cx, cy]]) => (
              <div
                key={roomId}
                className="font-pixel pointer-events-none"
                style={{
                  position:  'absolute',
                  left:      cx * cellSize,
                  top:       cy * cellSize,
                  transform: 'translate(-50%, -50%)',
                  fontSize:  Math.max(5, Math.floor(cellSize * 0.22)),
                  color:     ROOM_LABEL_COLORS[roomId] ?? '#888',
                  letterSpacing: '0.5px',
                  textAlign: 'center',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                  textShadow: '1px 1px 0 #000, 0 0 6px #00000099',
                  zIndex: 3,
                  userSelect: 'none',
                }}
              >
                {ROOM_DISPLAY_NAMES[roomId]}
              </div>
            ))}

            {/* ── Center staircase / logo ───────────────────────────────────── */}
            {/* Void is cols 9-13, rows 10-16 — center at col 11, row 13 */}
            <div
              className="pointer-events-none"
              style={{
                position:  'absolute',
                left:      9 * cellSize,
                top:       10 * cellSize,
                width:     5 * cellSize,
                height:    6 * cellSize,
                display:   'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 4,
                background: '#020202',
                border: '1px solid #1a0010',
              }}
            >
              {/* Staircase tiers */}
              {[0.8, 0.65, 0.5].map((w, i) => (
                <div key={i} style={{
                  width:      `${w * 5 * cellSize}px`,
                  height:     Math.max(3, cellSize * 0.22),
                  background: `#${['2a0008', '1e0006', '140004'][i]}`,
                  marginBottom: 1,
                  flexShrink: 0,
                }} />
              ))}
              {/* X marker */}
              <div style={{
                fontFamily: 'monospace',
                fontSize:   Math.max(10, cellSize * 0.55),
                color:      '#660000',
                lineHeight: 1,
                margin:     '2px 0',
              }}>
                ✕
              </div>
              {/* Logo text */}
              <div className="font-pixel" style={{
                fontSize:     Math.max(3, Math.floor(cellSize * 0.14)),
                color:        '#440010',
                letterSpacing:'0.8px',
                textAlign:    'center',
                lineHeight:   1.7,
              }}>
                MURDER{'\n'}IN KUET
              </div>
            </div>

            {/* ── Outer board border ────────────────────────────────────────── */}
            <div style={{
              position: 'absolute', inset: 0,
              border: '3px solid #1a1200',
              outline: '2px solid #0a0a00',
              pointerEvents: 'none',
              zIndex: 5,
            }} />

            {/* ── Player tokens ────────────────────────────────────────────── */}
            {boardPlayers.map((p, i) => (
              <PlayerToken
                key={p.id}
                player={p}
                cellSize={cellSize}
                isSelected={i === selectedPlayerIndex}
                playerIndex={i}
                onClick={() => setSelectedPlayerIndex(i)}
              />
            ))}
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div
          className="font-pixel flex flex-col shrink-0"
          style={{
            width: SIDEBAR_W, background: '#050208',
            borderLeft: '2px solid #150012',
            padding: '14px 10px 12px', overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '5px', color: '#4a0020', letterSpacing: '2px', marginBottom: 14 }}>
            ── SUSPECTS ──
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {boardPlayers.map((p, i) => {
              const isActive = i === selectedPlayerIndex
              const roomId   = getPlayerRoom(p.position[0], p.position[1])
              const roomName = roomId
                ? (ROOM_DISPLAY_NAMES[roomId] ?? roomId).replace('\n', ' ')
                : 'HALLWAY'
              const pSetup = players[i]
              return (
                <motion.div
                  key={p.id}
                  style={{
                    background: isActive ? 'rgba(80,0,30,0.35)' : 'transparent',
                    border: isActive ? `1px solid ${p.accentColor}55` : '1px solid #120010',
                    padding: '7px 8px', cursor: 'pointer',
                  }}
                  onClick={() => setSelectedPlayerIndex(i)}
                  whileHover={{ background: 'rgba(60,0,25,0.25)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 15, color: p.accentColor,
                      textShadow: isActive ? `0 0 7px ${p.accentColor}88` : 'none',
                      lineHeight: 1, flexShrink: 0,
                    }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '5px',
                        color: isActive ? '#ffdd00' : '#5a4020',
                        letterSpacing: '1.2px', marginBottom: 2,
                      }}>P{i + 1} · {p.name}</div>
                      <div style={{ fontSize: '4px', color: '#2a1800', letterSpacing: '0.5px' }}>
                        {pSetup?.type.toUpperCase()} · {deal.playerHands[i]?.length ?? 0} CARDS
                      </div>
                    </div>
                    {isActive && (
                      <motion.span
                        style={{ fontSize: '7px', color: '#ff3344', flexShrink: 0 }}
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.65, repeat: Infinity }}
                      >●</motion.span>
                    )}
                  </div>
                  <div style={{ fontSize: '4px', color: isActive ? '#3a2200' : '#1e1200', letterSpacing: '0.5px' }}>
                    [{String(p.position[0]).padStart(2,'0')},{String(p.position[1]).padStart(2,'0')}] {roomName}
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div style={{
            height: 1,
            background: 'repeating-linear-gradient(90deg,#150012 0,#150012 4px,transparent 4px,transparent 8px)',
            margin: '14px 0',
          }} />

          {selectedPlayer && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '4px', color: '#3a0018', letterSpacing: '1px', marginBottom: 8 }}>ACTIVE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 18, color: selectedPlayer.accentColor }}>
                  {selectedPlayer.icon}
                </span>
                <div>
                  <div style={{ fontSize: '5px', color: '#cc9900', letterSpacing: '1px' }}>{selectedPlayer.name}</div>
                  <div style={{ fontSize: '4px', color: '#3a2800', marginTop: 2 }}>CLICK CELL TO MOVE</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: '4px', color: '#1e0e18', letterSpacing: '0.5px', lineHeight: 2.2 }}>
            <div style={{ color: '#30101a', marginBottom: 4 }}>── CONTROLS ──</div>
            <div>[1] [2] [3]  SELECT</div>
            <div>[CLICK CELL]  MOVE</div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{
            borderTop: '1px solid #150012', paddingTop: 10,
            fontSize: '4px', color: '#180a00', letterSpacing: '0.5px', lineHeight: 2,
          }}>
            <div>FIND THE KILLER</div>
            <div>SOLVE THE CASE</div>
          </div>
        </div>
      </div>
    </div>
  )
}
