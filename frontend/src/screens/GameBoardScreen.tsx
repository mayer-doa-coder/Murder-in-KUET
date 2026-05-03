import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useBoard,
  ROOM_DISPLAY_NAMES,
  ROOM_BOUNDS,
  DOOR_POSITIONS,
  CHAR_STARTS,
  COLS,
  ROWS,
  getReachableCells,
} from '../hooks/useBoard'
import { ROOM_ACCENT } from '../components/GridCell'
import GridCell from '../components/GridCell'
import PlayerToken from '../components/PlayerToken'
import TurnOverlay from '../components/TurnOverlay'
import HandOverlay from '../components/HandOverlay'
import Dice from '../components/Dice'
import PathDots from '../components/PathDots'
import CameraController from '../components/CameraController'
import SelectionFlow from '../components/SelectionFlow'
import type { SelectionFlowResult } from '../components/SelectionFlow'
import RevealResultOverlay from '../components/RevealResultOverlay'
import type { PlayerSetup, GameDeal, GamePhase, PlayerStatus, RevealResult } from '../types'
import { LOCATIONS_CARDS } from '../types'

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

// ── Furniture ────────────────────────────────────────────────────────────────
type FItem =
  | { shape: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { shape: 'circ'; cx: number; cy: number; r: number; fill: string }

const FURNITURE: FItem[] = [
  { shape: 'rect', x: 0.6, y: 0.2, w: 4.8, h: 0.7, fill: '#250018' },
  { shape: 'rect', x: 0.7, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 1.6, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 2.5, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 3.4, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 4.3, y: 0.85, w: 0.65, h: 0.6, fill: '#1a0010' },
  { shape: 'rect', x: 0.3, y: 2.6,  w: 6.0, h: 0.35, fill: '#160008' },
  { shape: 'rect', x: 9.4,  y: 0.9, w: 2.2, h: 1.2, fill: '#001e0c' },
  { shape: 'rect', x: 11.9, y: 0.9, w: 2.2, h: 1.2, fill: '#001e0c' },
  { shape: 'rect', x: 9.3,  y: 4.0, w: 4.8, h: 0.8, fill: '#001408' },
  { shape: 'rect', x: 17.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 19.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 21.5, y: 0.4, w: 1.6, h: 2.2, fill: '#1c0000' },
  { shape: 'rect', x: 0.4, y: 6.5, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 3.3, y: 6.5, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 0.4, y: 8.4, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'rect', x: 3.3, y: 8.4, w: 2.4, h: 1.4, fill: '#1c0c00' },
  { shape: 'circ', cx: 2.5, cy: 14.2, r: 1.5, fill: '#001c00' },
  { shape: 'rect', x: 0.3, y: 19.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 2.7, y: 19.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 0.3, y: 21.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 2.7, y: 21.4, w: 1.9, h: 1.5, fill: '#00001c' },
  { shape: 'rect', x: 0.3, y: 23.4, w: 1.9, h: 1.0, fill: '#000014' },
  { shape: 'rect', x: 2.7, y: 23.4, w: 1.9, h: 1.0, fill: '#000014' },
  { shape: 'rect', x: 9.0,  y: 18.4, w: 5.5, h: 2.8, fill: '#1c001c' },
  { shape: 'rect', x: 9.0,  y: 22.2, w: 5.5, h: 0.9, fill: '#140014' },
  { shape: 'circ', cx: 20.5, cy: 21.2, r: 2.2, fill: '#001c1c' },
  { shape: 'circ', cx: 20.5, cy: 21.2, r: 1.1, fill: '#001414' },
  { shape: 'rect', x: 17.0, y: 10.5, w: 1.2, h: 3.0, fill: '#1e1e1e' },
  { shape: 'rect', x: 21.8, y: 10.5, w: 1.2, h: 3.0, fill: '#1e1e1e' },
  { shape: 'rect', x: 17.0, y: 10.0, w: 6.0, h: 0.8, fill: '#242424' },
]

type StartLabel = {
  charId: string; col: number; row: number; dir: 'top' | 'bottom' | 'left' | 'right'; label: string
}
const START_LABELS: StartLabel[] = [
  { charId: 'chef',           col: 16, row: 0,  dir: 'top',    label: 'START\nCHEF'       },
  { charId: 'hallboy',        col: 23, row: 7,  dir: 'right',  label: 'START\nHALLBOY'    },
  { charId: 'security_guard', col: 15, row: 24, dir: 'bottom', label: 'START\nSEC.GUARD'  },
  { charId: 'shopkeeper',     col: 9,  row: 24, dir: 'bottom', label: 'START\nSHOPKEEPR'  },
  { charId: 'student_girl',   col: 0,  row: 17, dir: 'left',   label: 'START\nSTD.GIRL'   },
  { charId: 'student_boy',    col: 0,  row: 5,  dir: 'left',   label: 'START\nSTD.BOY'    },
]

const SECRET_PASSAGES = [
  { col: 5.5, row: 2.8, arrow: '↘', label: 'SECRET' },
  { col: 17,  row: 9.5, arrow: '↖', label: 'SECRET' },
  { col: 18.5,row: 18.5,arrow: '↖', label: 'SECRET' },
  { col: 14.5,row: 23.5,arrow: '↘', label: 'SECRET' },
]

const ROOM_TO_LOCATION_CARD: Record<string, string> = {
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

function runRevealLoop(
  hands: readonly (readonly string[])[],
  currentIdx: number,
  suspectId: string,
  weaponId: string,
  locationCardId: string,
): { revealedCardId: string | null; revealedByIdx: number | null } {
  const n = hands.length
  for (let offset = 1; offset < n; offset++) {
    const idx = (currentIdx + offset) % n
    const hand = hands[idx]
    const match = hand.find(c => c === suspectId || c === weaponId || c === locationCardId)
    if (match) return { revealedCardId: match, revealedByIdx: idx }
  }
  return { revealedCardId: null, revealedByIdx: null }
}

const SIDEBAR_W = 252
const HEADER_H  = 54
const PAD       = 6

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameBoardScreen({ players, deal, onExit }: Props) {
  const [vw, setVw] = useState(window.innerWidth)
  const [vh, setVh] = useState(window.innerHeight)

  useEffect(() => {
    const fn = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const cellSize = Math.max(12, Math.floor(Math.min(
    (vw - SIDEBAR_W - PAD * 2) / COLS,
    (vh - HEADER_H - PAD * 2) / ROWS,
  )))
  const boardW = cellSize * COLS
  const boardH = cellSize * ROWS

  const { board, boardPlayers, movePlayer, enterRoom, exitRoom } = useBoard(players)
  const flatCells = useMemo(() => board.flat(), [board])

  // ── Turn / phase state ────────────────────────────────────────────────────
  const [gamePhase, setGamePhase]       = useState<GamePhase>('idle')
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [diceValue, setDiceValue]       = useState<number | null>(null)
  const [diceRolling, setDiceRolling]   = useState(false)
  const [pathCells, setPathCells]       = useState<[number, number][]>([])
  const [movePath, setMovePath]         = useState<[number, number][]>([])
  const [moveStep, setMoveStep]         = useState(0)
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus[]>(
    () => players.map(() => ({ eliminated: false, hasAccused: false }))
  )
  const playerStatusRef = useRef(playerStatus)
  useEffect(() => { playerStatusRef.current = playerStatus }, [playerStatus])
  const [revealResult, setRevealResult] = useState<RevealResult | null>(null)
  const [gameWinner, setGameWinner]     = useState<number | null>(null)
  const [remainingMoves, setRemainingMoves] = useState(0)

  // Refs for immediate sync during rapid key presses
  const positionRef      = useRef<[number, number]>([12, 12])
  const remainingMovesRef = useRef(0)

  const currentPlayer = boardPlayers[currentTurnIndex]

  // Keep positionRef in sync
  useEffect(() => {
    if (currentPlayer) positionRef.current = currentPlayer.position
  }, [currentPlayer])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const advanceTurn = useCallback(() => {
    setDiceValue(null)
    setDiceRolling(false)
    setPathCells([])
    setMovePath([])
    setMoveStep(0)
    setRevealResult(null)
    setRemainingMoves(0)
    remainingMovesRef.current = 0
    setCurrentTurnIndex(prev => {
      const n = boardPlayers.length
      const status = playerStatusRef.current
      let next = (prev + 1) % n
      for (let i = 1; i < n; i++) {
        if (!status[next].eliminated) break
        next = (next + 1) % n
      }
      return next
    })
    setGamePhase('idle')
  }, [boardPlayers.length])

  const handleAction = useCallback((id: string) => {
    if (id === 'roll') {
      setGamePhase('rolling')
    } else if (id === 'interrogation') {
      const p = boardPlayers[currentTurnIndex]
      if (!p) return
      if (!p.currentLocation) return  // must be fully inside a room
      setGamePhase('interrogation')
    } else if (id === 'accusation') {
      if (playerStatusRef.current[currentTurnIndex]?.hasAccused) return
      setGamePhase('accusation')
    }
  }, [boardPlayers, currentTurnIndex])

  const handleInterrogationComplete = useCallback((result: SelectionFlowResult) => {
    const p = boardPlayers[currentTurnIndex]
    if (!p) return
    const roomId = p.currentLocation
    const locationCardId = roomId ? (ROOM_TO_LOCATION_CARD[roomId] ?? roomId) : result.location
    const roomName = roomId ? (ROOM_DISPLAY_NAMES[roomId] ?? roomId).replace('\n', ' ') : undefined
    const hands = deal.playerHands.map(h => h.map(c => c.id))
    const { revealedCardId, revealedByIdx } = runRevealLoop(
      hands, currentTurnIndex, result.suspect, result.weapon, locationCardId
    )
    setRevealResult({
      type: 'interrogation',
      suspectId: result.suspect,
      weaponId: result.weapon,
      locationId: locationCardId,
      roomName,
      revealedCardId,
      revealedByName: revealedByIdx !== null ? boardPlayers[revealedByIdx]?.name ?? null : null,
    })
    setGamePhase('reveal_result')
  }, [boardPlayers, currentTurnIndex, deal.playerHands])

  const handleAccusationComplete = useCallback((result: SelectionFlowResult) => {
    const p = boardPlayers[currentTurnIndex]
    if (!p) return
    setPlayerStatus(ps => ps.map((s, i) =>
      i === currentTurnIndex ? { ...s, hasAccused: true } : s
    ))
    const cf = deal.caseFile
    const correct =
      result.suspect  === cf.suspect.id &&
      result.weapon   === cf.weapon.id  &&
      result.location === cf.location.id
    if (correct) {
      setGameWinner(currentTurnIndex)
      setRevealResult({
        type: 'accusation',
        suspectId: result.suspect,
        weaponId: result.weapon,
        locationId: result.location,
        revealedCardId: null,
        revealedByName: null,
        correct: true,
        accusingPlayerName: p.name,
        accusingPlayerIcon: p.icon,
      })
      setGamePhase('game_over')
    } else {
      setPlayerStatus(ps => ps.map((s, i) =>
        i === currentTurnIndex ? { ...s, eliminated: true } : s
      ))
      setRevealResult({
        type: 'accusation',
        suspectId: result.suspect,
        weaponId: result.weapon,
        locationId: result.location,
        revealedCardId: null,
        revealedByName: null,
        correct: false,
        accusingPlayerName: p.name,
        accusingPlayerIcon: p.icon,
      })
      setGamePhase('reveal_result')
    }
  }, [boardPlayers, currentTurnIndex, deal.caseFile])

  const handleSelectionCancel = useCallback(() => {
    setGamePhase('idle')
  }, [])

  const handleDiceRelease = useCallback(() => {
    const value = Math.ceil(Math.random() * 6)
    setDiceValue(value)
    setDiceRolling(true)
    setGamePhase('dice')
  }, [])

  const handleDiceSettled = useCallback(() => {
    setDiceRolling(false)
    if (diceValue === null || !currentPlayer) return
    const cells = getReachableCells(board, currentPlayer.position, diceValue)
    if (cells.length === 0) {
      advanceTurn()
      return
    }
    // Show reachable cells as highlight; player navigates with arrow keys
    setPathCells(cells)
    remainingMovesRef.current = diceValue
    setRemainingMoves(diceValue)
  }, [diceValue, currentPlayer, board, advanceTurn])

  // Click-to-move disabled — movement is now arrow-key controlled
  const handleGridClick = useCallback(
    (_e: React.MouseEvent<HTMLDivElement>) => { /* arrow keys handle movement */ },
    []
  )

  // ── Arrow-key step-by-step movement ──────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'dice') return

    const handler = (e: KeyboardEvent) => {
      // [Escape] or [Space] ends movement early
      if (e.key === 'Escape' || e.key === ' ') {
        if (remainingMovesRef.current > 0) {
          e.preventDefault()
          setPathCells([])
          remainingMovesRef.current = 0
          setRemainingMoves(0)
          advanceTurn()
        }
        return
      }

      const DIRS: Record<string, [number, number]> = {
        ArrowUp:    [0, -1],
        ArrowDown:  [0, 1],
        ArrowLeft:  [-1, 0],
        ArrowRight: [1, 0],
      }
      const dir = DIRS[e.key]
      if (!dir) return
      e.preventDefault()

      if (remainingMovesRef.current <= 0) return
      const player = currentPlayer
      if (!player) return

      // Exit room first if player is currently inside one
      if (player.currentLocation !== null) {
        exitRoom(player.id)
      }

      const [dc, dr] = dir
      const [cc, cr] = positionRef.current
      const nc = cc + dc, nr = cr + dr

      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return
      const cell = board[nr]?.[nc]
      if (!cell || !cell.isWalkable) return

      // Update refs immediately so rapid key presses stay coherent
      positionRef.current = [nc, nr]
      remainingMovesRef.current -= 1

      movePlayer(player.id, [nc, nr])
      setRemainingMoves(remainingMovesRef.current)

      if (remainingMovesRef.current > 0) {
        const newReachable = getReachableCells(board, [nc, nr], remainingMovesRef.current)
        setPathCells(newReachable)
      } else {
        setPathCells([])
      }

      // Auto-enter room when stepping onto a door cell
      if (cell.type === 'door' && cell.roomId) {
        enterRoom(player.id, cell.roomId)
        setPathCells([])
        remainingMovesRef.current = 0
        setRemainingMoves(0)
        advanceTurn()
        return
      }

      if (remainingMovesRef.current <= 0) {
        advanceTurn()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gamePhase, currentPlayer, board, movePlayer, exitRoom, enterRoom, advanceTurn])

  // ── Step-by-step movement animation ──────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'moving' || movePath.length === 0) return
    const delay = moveStep >= movePath.length ? 0 : 130
    const t = setTimeout(() => {
      if (moveStep >= movePath.length) {
        // Auto-enter room if the final cell is a door
        const finalPos = movePath[movePath.length - 1]
        if (finalPos && currentPlayer) {
          const [fc, fr] = finalPos
          const cell = board[fr]?.[fc]
          if (cell?.type === 'door' && cell.roomId) {
            enterRoom(currentPlayer.id, cell.roomId)
          }
        }
        advanceTurn()
      } else {
        const [col, row] = movePath[moveStep]
        if (currentPlayer) movePlayer(currentPlayer.id, [col, row])
        setMoveStep(s => s + 1)
      }
    }, delay)
    return () => clearTimeout(t)
  }, [gamePhase, movePath, moveStep, currentPlayer, movePlayer, advanceTurn, board, enterRoom])

  // ── Derived values ────────────────────────────────────────────────────────
  // currentLocation is set only when the player is fully inside a room (entered via door)
  const currentRoomId = currentPlayer?.currentLocation ?? null

  const disabledActions = useMemo(() => {
    const d: string[] = []
    if (!currentRoomId) d.push('interrogation')
    if (playerStatus[currentTurnIndex]?.hasAccused) d.push('accusation')
    return d
  }, [currentRoomId, playerStatus, currentTurnIndex])

  const lockedLocationCard = useMemo(() => {
    if (!currentRoomId) return undefined
    const cardId = ROOM_TO_LOCATION_CARD[currentRoomId] ?? currentRoomId
    return LOCATIONS_CARDS.find(c => c.id === cardId)
  }, [currentRoomId])

  // ── Camera ────────────────────────────────────────────────────────────────
  const isZoomed = gamePhase === 'idle' && !!currentPlayer

  const charColors: Record<string, string> = {}
  boardPlayers.forEach(p => { charColors[p.id] = p.accentColor })

  const lfs = Math.max(4, Math.floor(cellSize * 0.19))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#020204' }}>

      {/* Header */}
      <div
        className="font-pixel flex items-center justify-between px-4 shrink-0"
        style={{ height: HEADER_H, background: '#060308', borderBottom: '2px solid #2a0025' }}
      >
        <motion.button
          className="font-pixel"
          style={{
            fontSize: '8px', color: '#aa3355', background: 'transparent',
            border: '1px solid #661130', padding: '4px 11px', cursor: 'pointer', letterSpacing: '1px',
          }}
          whileHover={{ color: '#ee2266', borderColor: '#aa0044' }}
          onClick={onExit}
        >
          ← EXIT
        </motion.button>
        <div style={{ fontSize: '9px', color: '#dd3366', letterSpacing: '4px' }}>
          MURDER IN KUET
        </div>
        <div className="font-pixel" style={{ fontSize: '7px', color: '#cc8844', letterSpacing: '1px' }}>
          {gamePhase === 'idle'          && 'SELECT ACTION'}
          {gamePhase === 'rolling'       && 'ROLLING...'}
          {gamePhase === 'dice'          && diceValue !== null && `ROLLED: ${diceValue} — USE ARROWS`}
          {gamePhase === 'moving'        && 'MOVING...'}
          {gamePhase === 'interrogation' && 'INTERROGATION'}
          {gamePhase === 'accusation'    && 'ACCUSATION'}
          {gamePhase === 'reveal_result' && 'RESULT'}
          {gamePhase === 'game_over'     && (gameWinner !== null ? `${boardPlayers[gameWinner]?.name ?? 'PLAYER'} WINS!` : 'GAME OVER')}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Board area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{ padding: PAD, background: '#040a04' }}
        >
          {/* Camera wrap */}
          <CameraController
            playerCol={currentPlayer?.position[0] ?? 12}
            playerRow={currentPlayer?.position[1] ?? 12}
            cellSize={cellSize}
            boardW={boardW}
            boardH={boardH}
            isZoomed={isZoomed}
          >
            {/* Board container */}
            <div
              className="relative shrink-0"
              style={{ width: boardW, height: boardH, overflow: 'visible' }}
            >
              {/* Grid cells */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
                  gridTemplateRows:    `repeat(${ROWS}, ${cellSize}px)`,
                  cursor: 'default',
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

              {/* SVG overlay */}
              <svg
                style={{
                  position: 'absolute', inset: 0, overflow: 'visible',
                  width: boardW, height: boardH, pointerEvents: 'none', zIndex: 2,
                }}
              >
                {FURNITURE.map((item, i) =>
                  item.shape === 'rect' ? (
                    <rect key={i}
                      x={item.x * cellSize} y={item.y * cellSize}
                      width={item.w * cellSize} height={item.h * cellSize}
                      fill={item.fill} rx={1}
                    />
                  ) : (
                    <circle key={i}
                      cx={item.cx * cellSize} cy={item.cy * cellSize}
                      r={item.r * cellSize} fill={item.fill}
                    />
                  )
                )}

                {/* Door arch bars */}
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

                {/* Secret passage arrows */}
                {SECRET_PASSAGES.map((sp, i) => (
                  <g key={i}>
                    <text
                      x={sp.col * cellSize} y={sp.row * cellSize}
                      fontSize={Math.max(6, cellSize * 0.4)}
                      fill="#ccaa00" opacity={0.85}
                      fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
                    >
                      {sp.arrow}
                    </text>
                    <text
                      x={sp.col * cellSize} y={sp.row * cellSize + cellSize * 0.45}
                      fontSize={Math.max(3, cellSize * 0.15)}
                      fill="#887700" opacity={0.7}
                      fontFamily="'Press Start 2P', monospace"
                      textAnchor="middle" dominantBaseline="middle" letterSpacing="0.3"
                    >
                      {sp.label}
                    </text>
                  </g>
                ))}

                {/* Start labels */}
                {START_LABELS.map(({ charId, col, row, dir, label }) => {
                  const color = charColors[charId] ?? '#aaaaaa'
                  const cx = (col + 0.5) * cellSize, cy = (row + 0.5) * cellSize
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
                          fontSize={lfs} fill={color} opacity={0.85}
                          fontFamily="'Press Start 2P', monospace"
                          textAnchor={anchor as 'middle' | 'end' | 'start'}
                          dominantBaseline="middle" letterSpacing="0.5"
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  )
                })}

                {/* Start dots */}
                {Object.entries(CHAR_STARTS).map(([charId, [sc, sr]]) => (
                  <circle key={charId}
                    cx={(sc + 0.5) * cellSize} cy={(sr + 0.5) * cellSize}
                    r={Math.max(2, cellSize * 0.12)}
                    fill={charColors[charId] ?? '#888'} opacity={0.55}
                  />
                ))}
              </svg>

              {/* Room name labels */}
              {Object.entries(ROOM_LABEL_ANCHORS).map(([roomId, [cx, cy]]) => (
                <div
                  key={roomId}
                  className="font-pixel pointer-events-none"
                  style={{
                    position: 'absolute',
                    left: cx * cellSize, top: cy * cellSize,
                    transform: 'translate(-50%, -50%)',
                    fontSize: Math.max(7, Math.floor(cellSize * 0.28)),
                    color: ROOM_LABEL_COLORS[roomId] ?? '#aaaaaa',
                    letterSpacing: '0.5px', textAlign: 'center',
                    lineHeight: 1.7, whiteSpace: 'pre-line',
                    textShadow: '1px 1px 0 #000, 0 0 8px #000000cc',
                    zIndex: 3, userSelect: 'none',
                  }}
                >
                  {ROOM_DISPLAY_NAMES[roomId]}
                </div>
              ))}

              {/* Center staircase */}
              <div
                className="pointer-events-none"
                style={{
                  position: 'absolute',
                  left: 9 * cellSize, top: 10 * cellSize,
                  width: 5 * cellSize, height: 6 * cellSize,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  zIndex: 4, background: '#020202', border: '1px solid #1a0010',
                }}
              >
                {[0.8, 0.65, 0.5].map((w, i) => (
                  <div key={i} style={{
                    width: `${w * 5 * cellSize}px`,
                    height: Math.max(3, cellSize * 0.22),
                    background: `#${['2a0008', '1e0006', '140004'][i]}`,
                    marginBottom: 1, flexShrink: 0,
                  }} />
                ))}
                <div style={{ fontFamily: 'monospace', fontSize: Math.max(10, cellSize * 0.55), color: '#660000', lineHeight: 1, margin: '2px 0' }}>✕</div>
                <div className="font-pixel" style={{
                  fontSize: Math.max(3, Math.floor(cellSize * 0.14)),
                  color: '#440010', letterSpacing: '0.8px', textAlign: 'center', lineHeight: 1.7,
                }}>
                  MURDER{'\n'}IN KUET
                </div>
              </div>

              {/* Board border */}
              <div style={{
                position: 'absolute', inset: 0,
                border: '3px solid #1a1200', outline: '2px solid #0a0a00',
                pointerEvents: 'none', zIndex: 5,
              }} />

              {/* Path dots */}
              {gamePhase === 'dice' && (
                <PathDots cells={pathCells} cellSize={cellSize} />
              )}

              {/* Player tokens — hidden while player is inside a room */}
              {boardPlayers.map((p, i) =>
                p.currentLocation === null ? (
                  <PlayerToken
                    key={p.id}
                    player={p}
                    cellSize={cellSize}
                    isSelected={i === currentTurnIndex}
                    playerIndex={i}
                    onClick={() => {}}
                  />
                ) : null
              )}
            </div>
          </CameraController>

          {/* Turn overlay — outside camera so it doesn't zoom */}
          <AnimatePresence>
            {gamePhase === 'idle' && currentPlayer && (
              <TurnOverlay
                key={currentTurnIndex}
                playerName={currentPlayer.name}
                playerIcon={currentPlayer.icon}
                playerColor={currentPlayer.accentColor}
                playerIndex={currentTurnIndex}
                onAction={handleAction}
                disabledActions={disabledActions as ('roll' | 'interrogation' | 'accusation' | 'cards')[]}
              />
            )}
          </AnimatePresence>

          {/* Selection flow — interrogation or accusation */}
          <AnimatePresence>
            {(gamePhase === 'interrogation' || gamePhase === 'accusation') && (
              <SelectionFlow
                key={gamePhase}
                mode={gamePhase}
                onComplete={gamePhase === 'interrogation' ? handleInterrogationComplete : handleAccusationComplete}
                onCancel={handleSelectionCancel}
                lockedLocationCard={gamePhase === 'interrogation' ? lockedLocationCard : undefined}
              />
            )}
          </AnimatePresence>

          {/* Reveal result overlay */}
          <AnimatePresence>
            {(gamePhase === 'reveal_result' || gamePhase === 'game_over') && revealResult && (
              <RevealResultOverlay
                result={revealResult}
                caseFile={{
                  suspect:  { id: deal.caseFile.suspect.id,  icon: deal.caseFile.suspect.icon,  name: deal.caseFile.suspect.name  },
                  weapon:   { id: deal.caseFile.weapon.id,   icon: deal.caseFile.weapon.icon,   name: deal.caseFile.weapon.name   },
                  location: { id: deal.caseFile.location.id, icon: deal.caseFile.location.icon, name: deal.caseFile.location.name },
                }}
                onContinue={gamePhase === 'game_over' ? onExit : advanceTurn}
              />
            )}
          </AnimatePresence>

          {/* Hand overlay */}
          <AnimatePresence>
            {gamePhase === 'rolling' && (
              <HandOverlay onRelease={handleDiceRelease} />
            )}
          </AnimatePresence>

          {/* Dice — top-left of board area */}
          {(gamePhase === 'dice' || gamePhase === 'moving') && diceValue !== null && (
            <motion.div
              style={{ position: 'absolute', top: 14, left: 14, zIndex: 20 }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15, ease: 'linear' }}
            >
              <Dice value={diceValue} rolling={diceRolling} onSettled={handleDiceSettled} />
              {!diceRolling && diceValue !== null && (
                <>
                  <div className="font-pixel" style={{
                    marginTop: 6, fontSize: '7px', color: '#ffdd00',
                    letterSpacing: '1px', textAlign: 'center',
                  }}>
                    STEPS: {remainingMoves}
                  </div>
                  {gamePhase === 'dice' && remainingMoves > 0 && (
                    <motion.div
                      className="font-pixel"
                      style={{
                        marginTop: 4, fontSize: '5px', color: '#cc9933',
                        letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.8,
                      }}
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <div>↑↓←→ MOVE</div>
                      <div>[SPC] SKIP</div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div
          className="font-pixel flex flex-col shrink-0"
          style={{
            width: SIDEBAR_W, background: '#050208',
            borderLeft: '2px solid #150012',
            padding: '14px 10px 12px', overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '7px', color: '#cc3355', letterSpacing: '2px', marginBottom: 14 }}>
            ── SUSPECTS ──
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {boardPlayers.map((p, i) => {
              const isTurn = i === currentTurnIndex
              const roomName = p.currentLocation
                ? (ROOM_DISPLAY_NAMES[p.currentLocation] ?? p.currentLocation).replace('\n', ' ')
                : 'HALLWAY'
              const pSetup = players[i]
              return (
                <div
                  key={p.id}
                  style={{
                    background: isTurn ? 'rgba(80,0,30,0.35)' : 'transparent',
                    border: isTurn ? `1px solid ${p.accentColor}55` : '1px solid #120010',
                    padding: '7px 8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 15, color: p.accentColor,
                      textShadow: isTurn ? `0 0 7px ${p.accentColor}88` : 'none',
                      lineHeight: 1, flexShrink: 0,
                    }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '6px',
                        color: isTurn ? '#ffdd00' : '#cc9944',
                        letterSpacing: '1.2px', marginBottom: 2,
                      }}>P{i + 1} · {p.name}</div>
                      <div style={{ fontSize: '5px', color: '#aa7733', letterSpacing: '0.5px' }}>
                        {pSetup?.type.toUpperCase()} · {deal.playerHands[i]?.length ?? 0} CARDS
                      </div>
                    </div>
                    {isTurn && (
                      <motion.span
                        style={{ fontSize: '7px', color: '#ff3344', flexShrink: 0 }}
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.65, repeat: Infinity }}
                      >●</motion.span>
                    )}
                  </div>
                  <div style={{ fontSize: '5px', color: isTurn ? '#998844' : '#776633', letterSpacing: '0.5px' }}>
                    [{String(p.position[0]).padStart(2,'0')},{String(p.position[1]).padStart(2,'0')}] {roomName}
                  </div>
                  {playerStatus[i]?.eliminated && (
                    <div style={{ fontSize: '5px', color: '#ee3333', letterSpacing: '0.5px', marginTop: 3 }}>
                      ✗ ELIMINATED
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{
            height: 1,
            background: 'repeating-linear-gradient(90deg,#551133 0,#551133 4px,transparent 4px,transparent 8px)',
            margin: '14px 0',
          }} />

          {/* Phase info */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '6px', color: '#bb3355', letterSpacing: '1px', marginBottom: 8 }}>
              PHASE
            </div>
            <div style={{ fontSize: '6px', color: '#ff9944', letterSpacing: '1px' }}>
              {gamePhase === 'idle'          && '⬥ AWAITING ACTION'}
              {gamePhase === 'rolling'       && '⬥ ROLLING DICE'}
              {gamePhase === 'dice'          && `⬥ MOVING (${remainingMoves} LEFT)`}
              {gamePhase === 'moving'        && '⬥ MOVING'}
              {gamePhase === 'interrogation' && '⬥ INTERROGATION'}
              {gamePhase === 'accusation'    && '⬥ ACCUSATION'}
              {gamePhase === 'reveal_result' && '⬥ RESULT'}
              {gamePhase === 'game_over'     && '⬥ GAME OVER'}
            </div>
            {gamePhase === 'dice' && remainingMoves > 0 && (
              <div style={{ fontSize: '5px', color: '#cc9933', marginTop: 6, letterSpacing: '0.5px' }}>
                ↑↓←→ TO MOVE · SPC TO SKIP
              </div>
            )}
          </div>

          <div style={{ fontSize: '6px', color: '#8a5566', letterSpacing: '0.5px', lineHeight: 2.2 }}>
            <div style={{ color: '#bb4466', marginBottom: 4 }}>── CONTROLS ──</div>
            <div>[ENTER]  CONFIRM</div>
            <div>[↑↓←→]  MOVE</div>
            <div>[SPC]   SKIP MOVE</div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{
            borderTop: '1px solid #331120', paddingTop: 10,
            fontSize: '6px', color: '#7a4422', letterSpacing: '0.5px', lineHeight: 2,
          }}>
            <div>FIND THE KILLER</div>
            <div>SOLVE THE CASE</div>
          </div>
        </div>
      </div>
    </div>
  )
}
