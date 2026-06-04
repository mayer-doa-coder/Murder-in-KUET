import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useBoard,
  ROOM_DISPLAY_NAMES,
  ROOM_BOUNDS,
  DOOR_POSITIONS,
  CHAR_STARTS,
  COLS,
  ROWS,
  ROOM_TO_LOCATION_CARD,
} from '../hooks/useBoard'
import { ROOM_ACCENT } from '../components/GridCell'
import GridCell from '../components/GridCell'
import PlayerToken from '../components/PlayerToken'
import TurnOverlay from '../components/TurnOverlay'
import HandOverlay from '../components/HandOverlay'
import Dice from '../components/Dice'
import PathDots from '../components/PathDots'
import CameraController from '../components/CameraController'
import GameCard from '../components/GameCard'
import SelectionFlow from '../components/SelectionFlow'
import RevealResultOverlay from '../components/RevealResultOverlay'
import StoryScreen from '../components/StoryScreen'
import GameOverPopup from '../components/GameOverPopup'
import ClueNotebook from '../components/ClueNotebook'
import ProbabilityNotebook from '../components/ProbabilityNotebook'
import { useGameState } from '../hooks/useGameState'
import { useNotebooks } from '../hooks/useNotebooks'
import { useTurnActions } from '../hooks/useTurnActions'
import { useMovement } from '../hooks/useMovement'
import { useAITurn } from '../hooks/useAITurn'
import { useAudio } from '../hooks/useAudio'
import type { PlayerSetup, GameDeal, GameMode } from '../types'
import { LOCATIONS_CARDS } from '../types'

interface Props {
  players:   PlayerSetup[]
  deal:      GameDeal
  gameMode:  GameMode
  onExit:    () => void
  onRestart: () => void
}

// ── Module-level visual constants ─────────────────────────────────────────────
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

// ROOM_TO_CARD_ID used only for location card image layers (same values as ROOM_TO_LOCATION_CARD)
const ROOM_TO_CARD_ID = ROOM_TO_LOCATION_CARD

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

const SIDEBAR_W = 252
const HEADER_H  = 54
const PAD       = 6

// ── CardsOverlay ──────────────────────────────────────────────────────────────
interface CardsOverlayProps {
  hand: import('../types').Card[]
  playerName: string
  playerIcon: string
  playerImageSrc?: string
  playerColor: string
  playerIndex: number
  onClose: () => void
}

function CardsOverlay({ hand, playerName, playerIcon, playerImageSrc, playerColor, playerIndex, onClose }: CardsOverlayProps) {
  const [revealed, setRevealed] = useState(false)
  const [vw, setVw] = useState(window.innerWidth)
  const [vh, setVh] = useState(window.innerHeight)

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === ' ') { e.preventDefault(); setRevealed(true) }
      if (e.key === 'Escape' || e.key === 'Enter') onClose()
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === ' ') setRevealed(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [onClose])

  const GAP  = Math.max(8, Math.floor(vw * 0.01))
  const cols = Math.min(hand.length, 3)
  const cardW = Math.min(Math.floor((vw * 0.72 - GAP * (cols - 1)) / cols), 180)
  const cardH = Math.floor(cardW * 1.375)
  const rows = [hand.slice(0, 3), hand.slice(3, 6)].filter(r => r.length > 0)

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: '#030200',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: 46, overflow: 'hidden',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'linear' }}
      onMouseDown={() => setRevealed(true)}
      onMouseUp={() => setRevealed(false)}
      onMouseLeave={() => setRevealed(false)}
      onTouchStart={() => setRevealed(true)}
      onTouchEnd={() => setRevealed(false)}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.82) 100%)',
        zIndex: 0,
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)',
        zIndex: 0,
      }} />

      <motion.button
        className="font-pixel absolute"
        style={{
          top: 10, left: 12, zIndex: 10,
          background: '#1a0800', border: '2px solid #3d2000',
          color: '#6b4020', padding: '5px 10px',
          fontSize: '5px', letterSpacing: '1px', cursor: 'pointer',
        }}
        onClick={onClose}
        whileHover={{ backgroundColor: '#2a1000', color: '#aa6030' }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.08 }}
      >
        ◀ BACK
      </motion.button>

      <motion.div
        className="absolute font-pixel"
        style={{
          top: 10, right: 12, zIndex: 10,
          background: '#0d0800', border: `2px solid ${playerColor}44`,
          padding: '5px 9px', fontSize: '5px', color: playerColor, letterSpacing: '1px',
        }}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        P{playerIndex + 1}
      </motion.div>

      <motion.div
        className="relative z-10 text-center"
        style={{ marginTop: Math.floor(vh * 0.05), marginBottom: Math.floor(vh * 0.03) }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="font-pixel" style={{ fontSize: '6px', color: '#4a3010', letterSpacing: '3px', marginBottom: 8 }}>
          ─── PRIVATE FILES ───
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {playerImageSrc ? (
            <img src={playerImageSrc} alt="" style={{ width: 28, height: 28, objectFit: 'cover', imageRendering: 'pixelated', border: `1px solid ${playerColor}44` }} />
          ) : (
            <span style={{ fontFamily: 'monospace', fontSize: 22, color: playerColor }}>{playerIcon}</span>
          )}
          <div className="font-pixel" style={{ fontSize: 'clamp(9px, 1.8vw, 13px)', color: playerColor, letterSpacing: '2px' }}>
            {playerName.toUpperCase()}
          </div>
        </div>
      </motion.div>

      <div className="relative z-10" style={{ display: 'flex', flexDirection: 'column', gap: GAP, alignItems: 'center' }}>
        {rows.map((rowCards, ri) => (
          <div key={ri} style={{ display: 'flex', gap: GAP }}>
            {rowCards.map((card) => (
              <GameCard
                key={card.id}
                card={card}
                width={cardW}
                height={cardH}
                faceUp={revealed}
              />
            ))}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div key="hint" className="font-pixel"
            style={{ fontSize: 'clamp(6px, 1vw, 8px)', color: '#5c3d00', letterSpacing: '2px', marginTop: Math.floor(vh * 0.04) }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }}
            initial={{ opacity: 0 }} exit={{ opacity: 0 }}
          >
            HOLD  [A]  TO  REVEAL  ALL
          </motion.div>
        ) : (
          <motion.div key="revealed" className="font-pixel"
            style={{ fontSize: 'clamp(6px, 1vw, 8px)', color: '#cc8833', letterSpacing: '2px', marginTop: Math.floor(vh * 0.04) }}
            initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            ★  CARDS  REVEALED  ★
          </motion.div>
        )}
      </AnimatePresence>
      <div className="font-pixel" style={{ fontSize: 'clamp(4px, 0.7vw, 6px)', color: '#2a1600', letterSpacing: '1.5px', marginTop: 6 }}>
        ESC / ENTER  —  CLOSE
      </div>
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameBoardScreen({ players, deal, gameMode, onExit, onRestart }: Props) {
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

  const locationCardLayers = useMemo(() => {
    const cardById = Object.fromEntries(LOCATIONS_CARDS.map(c => [c.id, c]))
    return Object.entries(ROOM_TO_CARD_ID).flatMap(([roomId, cardId]) => {
      const card = cardById[cardId]
      if (!card?.imageSrc) return []
      const bounds = ROOM_BOUNDS[roomId]
      if (!bounds) return []
      const [c0, c1, r0, r1] = bounds
      return [{
        roomId,
        src: card.imageSrc,
        left: c0 * cellSize,
        top: r0 * cellSize,
        cardW: (c1 - c0 + 1) * cellSize,
        cardH: (r1 - r0 + 1) * cellSize,
        accentColor: card.accentColor,
      }]
    })
  }, [cellSize])

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const gs = useGameState(players)
  const nb = useNotebooks(players, deal)

  const currentPlayer = boardPlayers[gs.currentTurnIndex]
  const currentSetup  = players[gs.currentTurnIndex]
  const isAiTurn      = currentSetup?.type === 'computer'

  // Keep positionRef in sync with current player's grid position
  useEffect(() => {
    if (currentPlayer) gs.positionRef.current = currentPlayer.position
  }, [currentPlayer, gs.positionRef])

  const actions = useTurnActions({ gs, nb, boardPlayers, deal, exitRoom, onRestart })

  const { handleDiceRelease, handleDiceSettled, handleGridClick } = useMovement({
    gs, nb, board, boardPlayers, currentPlayer, isAiTurn,
    currentSetup, cellSize, movePlayer, enterRoom, exitRoom,
    advanceTurn: actions.advanceTurn,
  })

  useAITurn({ gs, nb, boardPlayers, actions, currentSetup, isAiTurn })

  // ── Audio ─────────────────────────────────────────────────────────────────
  const { muted, toggleMute, playDiceRoll, playStep, playInterrogation, playAccusation, playReveal } = useAudio()

  useEffect(() => { if (gs.diceRolling) playDiceRoll() }, [gs.diceRolling, playDiceRoll])
  useEffect(() => { if (gs.moveStep > 0) playStep() }, [gs.moveStep, playStep])
  useEffect(() => { if (gs.gamePhase === 'interrogation') playInterrogation() }, [gs.gamePhase, playInterrogation])
  useEffect(() => { if (gs.gamePhase === 'accusation') playAccusation() }, [gs.gamePhase, playAccusation])
  useEffect(() => { if (gs.revealResult) playReveal() }, [gs.revealResult, playReveal])

  // ── Derived values ────────────────────────────────────────────────────────
  const currentRoomId = currentPlayer?.currentLocation ?? null

  const disabledActions = useMemo(() => {
    const d: string[] = []
    const status = gs.playerStatus[gs.currentTurnIndex]
    if (!currentRoomId) d.push('interrogation')
    if (status?.hasAccused || status?.eliminated) d.push('accusation')
    if (status?.eliminated) { d.push('roll'); d.push('interrogation') }
    return d
  }, [currentRoomId, gs.playerStatus, gs.currentTurnIndex])

  const lockedLocationCard = useMemo(() => {
    if (!currentRoomId) return undefined
    const cardId = ROOM_TO_LOCATION_CARD[currentRoomId] ?? currentRoomId
    return LOCATIONS_CARDS.find(c => c.id === cardId)
  }, [currentRoomId])

  const isZoomed = gs.gamePhase === 'idle' && !!currentPlayer

  const charColors: Record<string, string> = {}
  boardPlayers.forEach(p => { charColors[p.id] = p.accentColor })

  const lfs = Math.max(5, Math.floor(cellSize * 0.23))

  // Inline passage-dot click handler (duplicates handleGridClick for direct dot clicks)
  const handlePassageDotClick = useCallback((col: number, row: number) => {
    const destRoomId = Object.entries(DOOR_POSITIONS).find(([, doors]) =>
      doors.some(([dc, dr]) => dc === col && dr === row)
    )?.[0]
    if (destRoomId && currentPlayer) {
      movePlayer(currentPlayer.id, [col, row])
      enterRoom(currentPlayer.id, destRoomId)
      gs.setPassageCells([])
      gs.setPathCells([])
      gs.remainingMovesRef.current = 0
      gs.setRemainingMoves(0)
      actions.advanceTurn()
    }
  }, [currentPlayer, movePlayer, enterRoom, gs, actions])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {players.some(p => p.type === 'computer') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {([1, 4, 16] as const).map(s => (
                <motion.button
                  key={s}
                  className="font-pixel"
                  onClick={() => gs.setSimSpeed(s)}
                  style={{
                    fontSize: '6px', letterSpacing: '0.5px',
                    padding: '3px 7px', cursor: 'pointer',
                    background: gs.simSpeed === s ? '#cc8844' : 'transparent',
                    border: `1px solid ${gs.simSpeed === s ? '#cc8844' : '#3a2200'}`,
                    color: gs.simSpeed === s ? '#000' : '#664400',
                  }}
                  whileHover={{ borderColor: '#cc8844', color: '#cc8844' }}
                  transition={{ duration: 0.06 }}
                >
                  {s}×
                </motion.button>
              ))}
              <motion.button
                className="font-pixel"
                onClick={() => {
                  if (gs.isPaused) {
                    gs.setIsPaused(false)
                  } else {
                    gs.setIsPaused(true)
                    gs.setPauseViewIdx(gs.currentTurnIndex)
                  }
                }}
                style={{
                  fontSize: '6px', letterSpacing: '0.5px',
                  padding: '3px 9px', cursor: 'pointer',
                  background: gs.isPaused ? '#cc4488' : 'transparent',
                  border: `1px solid ${gs.isPaused ? '#cc4488' : '#550033'}`,
                  color: gs.isPaused ? '#000' : '#884466',
                }}
                whileHover={{ borderColor: '#cc4488', color: gs.isPaused ? '#000' : '#cc4488' }}
                transition={{ duration: 0.06 }}
              >
                {gs.isPaused ? '▶ RESUME' : '⏸ PAUSE'}
              </motion.button>
            </div>
          )}
          <motion.button
            className="font-pixel"
            onClick={toggleMute}
            title={muted ? 'Unmute' : 'Mute'}
            style={{
              fontSize: '7px', padding: '3px 8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid #3a1a00',
              color: muted ? '#444' : '#cc8844', letterSpacing: '0.5px',
            }}
            whileHover={{ borderColor: '#cc8844', color: muted ? '#888' : '#ffaa44' }}
            transition={{ duration: 0.06 }}
          >
            {muted ? '♪ OFF' : '♪ ON'}
          </motion.button>
          <div className="font-pixel" style={{ fontSize: '7px', color: '#cc8844', letterSpacing: '1px' }}>
            {gs.gamePhase === 'idle'          && (isAiTurn ? 'AI THINKING...' : 'SELECT ACTION')}
            {gs.gamePhase === 'rolling'       && 'ROLLING...'}
            {gs.gamePhase === 'dice'          && gs.diceValue !== null && `ROLLED: ${gs.diceValue} — ${isAiTurn ? 'AI MOVING' : 'USE ARROWS'}`}
            {gs.gamePhase === 'moving'        && 'MOVING...'}
            {gs.gamePhase === 'interrogation' && 'INTERROGATION'}
            {gs.gamePhase === 'accusation'    && 'ACCUSATION'}
            {gs.gamePhase === 'story'         && 'CRIME THEORY'}
            {gs.gamePhase === 'reveal_result' && 'RESULT'}
            {gs.gamePhase === 'game_over'     && (
              gs.gameWinner !== null
                ? `${boardPlayers[gs.gameWinner]?.name ?? 'PLAYER'} WINS!`
                : 'GAME OVER'
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Board area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{ padding: PAD, background: '#040a04' }}
        >
          <CameraController
            playerCol={currentPlayer?.position[0] ?? 12}
            playerRow={currentPlayer?.position[1] ?? 12}
            cellSize={cellSize}
            boardW={boardW}
            boardH={boardH}
            isZoomed={isZoomed}
          >
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
                      fontSize={Math.max(7, cellSize * 0.42)}
                      fill="#e2bf22" opacity={0.95}
                      fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
                    >
                      {sp.arrow}
                    </text>
                    <text
                      x={sp.col * cellSize} y={sp.row * cellSize + cellSize * 0.45}
                      fontSize={Math.max(4, cellSize * 0.17)}
                      fill="#b49312" opacity={0.9}
                      fontFamily="'Press Start 2P', monospace"
                      textAnchor="middle" dominantBaseline="middle" letterSpacing="0.4"
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
                          fontSize={lfs} fill={color} opacity={0.96}
                          fontFamily="'Press Start 2P', monospace"
                          textAnchor={anchor as 'middle' | 'end' | 'start'}
                          dominantBaseline="middle" letterSpacing="0.5"
                          stroke="#000000" strokeWidth={Math.max(0.4, cellSize * 0.018)}
                          paintOrder="stroke"
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
                    fill={charColors[charId] ?? '#888'} opacity={0.75}
                  />
                ))}
              </svg>

              {/* Location images */}
              {locationCardLayers.map(({ roomId, src, left, top, cardW, cardH }) => (
                <img
                  key={`loccard-${roomId}`}
                  src={src}
                  draggable={false}
                  style={{
                    position: 'absolute', left, top,
                    width: cardW, height: cardH,
                    imageRendering: 'pixelated', objectFit: 'cover',
                    opacity: 0.78, pointerEvents: 'none', userSelect: 'none', zIndex: 1,
                  }}
                />
              ))}

              {/* Room name labels */}
              {Object.entries(ROOM_LABEL_ANCHORS).map(([roomId, [cx, cy]]) => (
                <div
                  key={roomId}
                  className="font-pixel pointer-events-none"
                  style={{
                    position: 'absolute',
                    left: cx * cellSize, top: cy * cellSize,
                    transform: 'translate(-50%, -50%)',
                    fontSize: Math.max(8, Math.floor(cellSize * 0.3)),
                    color: ROOM_LABEL_COLORS[roomId] ?? '#aaaaaa',
                    letterSpacing: '0.6px', textAlign: 'center',
                    lineHeight: 1.55, whiteSpace: 'pre-line',
                    textShadow: '1px 1px 0 #000, 0 0 10px #000000dd',
                    opacity: 0.97, zIndex: 3, userSelect: 'none',
                  }}
                >
                  {ROOM_DISPLAY_NAMES[roomId]}
                </div>
              ))}

              {/* Center staircase / void decoration */}
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
                <div style={{ fontFamily: 'monospace', fontSize: Math.max(10, cellSize * 0.55), color: '#992233', lineHeight: 1, margin: '2px 0' }}>✕</div>
                <div className="font-pixel" style={{
                  fontSize: Math.max(4, Math.floor(cellSize * 0.17)),
                  color: '#aa3355', letterSpacing: '0.9px', textAlign: 'center', lineHeight: 1.7,
                  textShadow: '1px 1px 0 #000',
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
              {gs.gamePhase === 'dice' && !isAiTurn && (
                <PathDots cells={gs.pathCells} cellSize={cellSize} />
              )}

              {/* Secret passage dots — gold, shown for human during dice phase */}
              {gs.gamePhase === 'dice' && !isAiTurn && gs.passageCells.map(([col, row]) => {
                const dotSize = Math.max(6, Math.round(cellSize * 0.35))
                return (
                  <motion.div
                    key={`passage-${col}-${row}`}
                    onClick={() => handlePassageDotClick(col, row)}
                    style={{
                      position: 'absolute',
                      left: (col + 0.5) * cellSize - dotSize / 2,
                      top:  (row + 0.5) * cellSize - dotSize / 2,
                      width: dotSize, height: dotSize,
                      borderRadius: '50%',
                      background: '#ffcc00',
                      cursor: 'pointer', zIndex: 9,
                      boxShadow: '0 0 8px #ffcc0099',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0.8, 1, 0.8], scale: 1 }}
                    transition={{
                      opacity: { duration: 0.6, repeat: Infinity, ease: 'linear' },
                      scale: { duration: 0.12 },
                    }}
                    title="Secret Passage"
                  />
                )
              })}

              {/* Player tokens */}
              {boardPlayers.map((p, i) =>
                p.currentLocation === null ? (
                  <PlayerToken
                    key={p.id}
                    player={p}
                    cellSize={cellSize}
                    isSelected={i === gs.currentTurnIndex}
                    playerIndex={i}
                    onClick={() => {}}
                  />
                ) : null
              )}
            </div>
          </CameraController>

          {/* Turn overlay (human) */}
          <AnimatePresence>
            {gs.gamePhase === 'idle' && currentPlayer && !isAiTurn && (
              <TurnOverlay
                key={gs.currentTurnIndex}
                playerName={currentPlayer.name}
                playerIcon={currentPlayer.icon}
                playerImageSrc={currentPlayer.imageSrc}
                playerColor={currentPlayer.accentColor}
                playerIndex={gs.currentTurnIndex}
                onAction={actions.handleAction}
                disabledActions={disabledActions as ('roll' | 'interrogation' | 'accusation' | 'cards')[]}
              />
            )}
          </AnimatePresence>

          {/* AI turn indicator */}
          <AnimatePresence>
            {gs.gamePhase === 'idle' && currentPlayer && isAiTurn && (
              <motion.div
                key={`ai-indicator-${gs.currentTurnIndex}`}
                style={{
                  position: 'absolute', bottom: 20, left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.88)',
                  border: `1px solid ${currentPlayer.accentColor}44`,
                  padding: '8px 18px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  zIndex: 30,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  style={{ fontFamily: 'monospace', fontSize: 14, color: currentPlayer.accentColor }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                >
                  ⊛
                </motion.span>
                <div className="font-pixel" style={{ fontSize: '6px', color: currentPlayer.accentColor, letterSpacing: '1px' }}>
                  {currentPlayer.name} (AI) IS THINKING...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selection flow (human) */}
          <AnimatePresence>
            {(gs.gamePhase === 'interrogation' || gs.gamePhase === 'accusation') && !isAiTurn && (
              <SelectionFlow
                key={gs.gamePhase}
                mode={gs.gamePhase}
                onComplete={gs.gamePhase === 'interrogation'
                  ? actions.handleInterrogationComplete
                  : actions.handleAccusationComplete}
                onCancel={actions.handleSelectionCancel}
                lockedLocationCard={gs.gamePhase === 'interrogation' ? lockedLocationCard : undefined}
              />
            )}
          </AnimatePresence>

          {/* Story screen */}
          <AnimatePresence>
            {gs.gamePhase === 'story' && gs.pendingReveal && (
              <StoryScreen
                key="story"
                story={gs.storyText}
                suspectId={gs.pendingReveal.suspectId}
                weaponId={gs.pendingReveal.weaponId}
                locationId={gs.pendingReveal.locationId}
                onContinue={actions.handleStoryComplete}
              />
            )}
          </AnimatePresence>

          {/* Reveal result overlay */}
          <AnimatePresence>
            {(gs.gamePhase === 'reveal_result' ||
              (gs.gamePhase === 'game_over' && gs.gameWinner !== null)
            ) && gs.revealResult && (
              <RevealResultOverlay
                result={gs.revealResult}
                caseFile={{
                  suspect:  { id: deal.caseFile.suspect.id,  icon: deal.caseFile.suspect.icon,  name: deal.caseFile.suspect.name  },
                  weapon:   { id: deal.caseFile.weapon.id,   icon: deal.caseFile.weapon.icon,   name: deal.caseFile.weapon.name   },
                  location: { id: deal.caseFile.location.id, icon: deal.caseFile.location.icon, name: deal.caseFile.location.name },
                }}
                onContinue={actions.handleRevealContinue}
              />
            )}
          </AnimatePresence>

          {/* Game over popup */}
          <AnimatePresence>
            {gs.gamePhase === 'game_over' && gs.gameWinner === null && (
              <GameOverPopup
                key="game-over"
                caseFile={deal.caseFile}
                onExit={onExit}
                onRestart={onRestart}
              />
            )}
          </AnimatePresence>

          {/* Clue notebook (human) */}
          <AnimatePresence>
            {nb.showNotebook && !isAiTurn && (
              <ClueNotebook
                key="notebook"
                data={nb.notebooks[gs.currentTurnIndex] ?? nb.notebooks[0]}
                hand={deal.playerHands[gs.currentTurnIndex] ?? []}
                onChange={(cat, cardId, state) =>
                  nb.updateNotebookBox(gs.currentTurnIndex, cat, cardId, state)
                }
                onClose={() => nb.setShowNotebook(false)}
              />
            )}
          </AnimatePresence>

          {/* AI probability notebook overlay */}
          <AnimatePresence>
            {nb.showAiNotebook && (
              <ProbabilityNotebook
                key="ai-notebook"
                data={nb.probNotebooks[gs.currentTurnIndex]}
                algorithm={currentSetup?.aiAlgorithm ?? 'rule_based'}
                onClose={() => nb.setShowAiNotebook(false)}
              />
            )}
          </AnimatePresence>

          {/* Cards overlay */}
          <AnimatePresence>
            {nb.showCards && (
              <CardsOverlay
                key="cards-overlay"
                hand={deal.playerHands[gs.currentTurnIndex] ?? []}
                playerName={currentPlayer?.name ?? ''}
                playerIcon={currentPlayer?.icon ?? ''}
                playerImageSrc={currentPlayer?.imageSrc}
                playerColor={currentPlayer?.accentColor ?? '#cc3355'}
                playerIndex={gs.currentTurnIndex}
                onClose={() => nb.setShowCards(false)}
              />
            )}
          </AnimatePresence>

          {/* Pause inspector */}
          <AnimatePresence>
            {gs.isPaused && (
              <motion.div
                key="pause-inspector"
                style={{
                  position: 'absolute', inset: 0, zIndex: 60,
                  background: 'rgba(0,0,0,0.94)',
                  display: 'flex', flexDirection: 'column',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: '1px solid #330022',
                  background: '#0a0008', flexShrink: 0,
                }}>
                  <div className="font-pixel" style={{ fontSize: '8px', color: '#cc4488', letterSpacing: '3px' }}>
                    ⏸ PAUSED — INSPECT PLAYERS
                  </div>
                  <motion.button
                    className="font-pixel"
                    onClick={() => gs.setIsPaused(false)}
                    style={{
                      background: '#2a0018', border: '2px solid #cc4488',
                      color: '#cc4488', fontSize: '7px',
                      letterSpacing: '1px', padding: '5px 14px', cursor: 'pointer',
                    }}
                    whileHover={{ background: '#cc4488', color: '#000' }}
                    transition={{ duration: 0.08 }}
                  >
                    ▶ RESUME
                  </motion.button>
                </div>

                <div style={{
                  display: 'flex', gap: 4, padding: '8px 12px',
                  background: '#060006', borderBottom: '1px solid #220014',
                  flexShrink: 0, flexWrap: 'wrap',
                }}>
                  {boardPlayers.map((p, i) => {
                    const isActive = i === gs.pauseViewIdx
                    const isElim   = gs.playerStatus[i]?.eliminated
                    const pSetup   = players[i]
                    return (
                      <motion.button
                        key={p.id}
                        className="font-pixel"
                        onClick={() => gs.setPauseViewIdx(i)}
                        style={{
                          background: isActive ? p.accentColor : 'transparent',
                          border: `1px solid ${isActive ? p.accentColor : p.accentColor + '44'}`,
                          color: isActive ? '#000' : (isElim ? '#444' : p.accentColor),
                          fontSize: '5px', letterSpacing: '0.8px',
                          padding: '4px 10px', cursor: 'pointer',
                          opacity: isElim ? 0.5 : 1,
                        }}
                        whileHover={!isActive ? { background: p.accentColor + '22' } : {}}
                        transition={{ duration: 0.06 }}
                      >
                        {p.icon} P{i + 1} · {p.name.slice(0, 8)}
                        {pSetup?.type === 'computer' ? ' ⊛' : ' ◇'}
                        {isElim ? ' ✗' : ''}
                      </motion.button>
                    )
                  })}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {(() => {
                    const pi     = gs.pauseViewIdx
                    const p      = boardPlayers[pi]
                    const pSetup = players[pi]
                    const isElim = gs.playerStatus[pi]?.eliminated
                    const roomName = p?.currentLocation
                      ? (ROOM_DISPLAY_NAMES[p.currentLocation] ?? p.currentLocation).replace('\n', ' ')
                      : 'HALLWAY'
                    return (
                      <div style={{ maxWidth: 700, margin: '0 auto' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          marginBottom: 18, paddingBottom: 12,
                          borderBottom: `1px solid ${p?.accentColor ?? '#444'}33`,
                        }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 28,
                            color: isElim ? '#444' : (p?.accentColor ?? '#fff'),
                            textShadow: isElim ? 'none' : `0 0 12px ${p?.accentColor}88`,
                          }}>
                            {p?.icon}
                          </span>
                          <div>
                            <div className="font-pixel" style={{
                              fontSize: '9px', letterSpacing: '2px',
                              color: isElim ? '#553333' : (p?.accentColor ?? '#fff'),
                              marginBottom: 4,
                            }}>
                              P{pi + 1} · {p?.name}
                              {pSetup?.type === 'computer' ? ` · AI (${(pSetup.aiAlgorithm ?? 'rule_based').toUpperCase().replace('_', '-')})` : ' · HUMAN'}
                              {isElim ? ' · ELIMINATED' : ''}
                            </div>
                            <div className="font-pixel" style={{ fontSize: '5px', color: '#664444', letterSpacing: '0.8px' }}>
                              [{String(p?.position[0] ?? 0).padStart(2,'0')},{String(p?.position[1] ?? 0).padStart(2,'0')}] {roomName}
                              {' · '}{deal.playerHands[pi]?.length ?? 0} CARDS
                              {gs.playerStatus[pi]?.hasAccused ? ' · ACCUSED' : ''}
                            </div>
                          </div>
                        </div>

                        {pSetup?.type === 'computer' && pSetup.aiAlgorithm ? (
                          <ProbabilityNotebook
                            data={nb.probNotebooks[pi]}
                            algorithm={pSetup.aiAlgorithm}
                            compact={false}
                          />
                        ) : (
                          <div>
                            <div className="font-pixel" style={{
                              fontSize: '6px', color: '#44cc88', letterSpacing: '1.5px',
                              marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #1a3322',
                            }}>
                              ── HAND CARDS
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {(deal.playerHands[pi] ?? []).map(card => (
                                <div key={card.id} style={{
                                  background: card.bgColor,
                                  border: `2px solid ${card.accentColor}44`,
                                  padding: '10px 14px',
                                  display: 'flex', alignItems: 'center', gap: 9,
                                  minWidth: 140,
                                }}>
                                  <span style={{
                                    fontFamily: 'monospace', fontSize: 18,
                                    color: card.accentColor,
                                    textShadow: `0 0 8px ${card.accentColor}55`,
                                    lineHeight: 1, flexShrink: 0,
                                  }}>
                                    {card.icon}
                                  </span>
                                  <div>
                                    <div className="font-pixel" style={{ fontSize: '5px', color: '#666', letterSpacing: '0.5px', marginBottom: 3 }}>
                                      {card.category.toUpperCase()}
                                    </div>
                                    <div className="font-pixel" style={{ fontSize: '6px', color: card.accentColor }}>
                                      {card.name.toUpperCase()}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {(deal.playerHands[pi]?.length ?? 0) === 0 && (
                                <div className="font-pixel" style={{ fontSize: '7px', color: '#554433' }}>
                                  NO CARDS DEALT
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hand overlay (human dice roll) */}
          <AnimatePresence>
            {gs.gamePhase === 'rolling' && !isAiTurn && (
              <HandOverlay onRelease={handleDiceRelease} />
            )}
          </AnimatePresence>

          {/* Dice */}
          {(gs.gamePhase === 'dice' || gs.gamePhase === 'moving') && gs.diceValue !== null && (
            <motion.div
              style={{ position: 'absolute', top: 14, left: 14, zIndex: 20 }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15, ease: 'linear' }}
            >
              <Dice value={gs.diceValue} rolling={gs.diceRolling} onSettled={handleDiceSettled} />
              {!gs.diceRolling && gs.diceValue !== null && (
                <>
                  <div className="font-pixel" style={{
                    marginTop: 6, fontSize: '7px', color: '#ffdd00',
                    letterSpacing: '1px', textAlign: 'center',
                  }}>
                    STEPS: {gs.remainingMoves}
                  </div>
                  {gs.gamePhase === 'dice' && gs.remainingMoves > 0 && !isAiTurn && (
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
                  {players.some(p => p.type === 'computer') && (
                    <motion.button
                      className="font-pixel"
                      onClick={() => { gs.setIsPaused(true); gs.setPauseViewIdx(gs.currentTurnIndex) }}
                      style={{
                        marginTop: 8, width: '100%',
                        background: '#1a0010', border: '1px solid #660044',
                        color: '#cc4488', fontSize: '6px',
                        letterSpacing: '1px', padding: '4px 0', cursor: 'pointer',
                      }}
                      whileHover={{ background: '#330020', color: '#ff66aa' }}
                      transition={{ duration: 0.06 }}
                    >
                      ⏸ PAUSE
                    </motion.button>
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
              const isTurn   = i === gs.currentTurnIndex
              const roomName = p.currentLocation
                ? (ROOM_DISPLAY_NAMES[p.currentLocation] ?? p.currentLocation).replace('\n', ' ')
                : 'HALLWAY'
              const pSetup = players[i]
              const isElim = gs.playerStatus[i]?.eliminated
              const isAi   = pSetup?.type === 'computer'
              const algo   = pSetup?.aiAlgorithm
              return (
                <div
                  key={p.id}
                  style={{
                    background: isTurn ? 'rgba(80,0,30,0.35)' : 'transparent',
                    border: isTurn ? `1px solid ${p.accentColor}55` : '1px solid #120010',
                    padding: '7px 8px',
                    opacity: isElim ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 15, color: isElim ? '#444' : p.accentColor,
                      textShadow: isTurn && !isElim ? `0 0 7px ${p.accentColor}88` : 'none',
                      lineHeight: 1, flexShrink: 0,
                    }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '6px',
                        color: isElim ? '#553333' : isTurn ? '#ffdd00' : '#cc9944',
                        letterSpacing: '1.2px', marginBottom: 2,
                      }}>P{i + 1} · {p.name}</div>
                      <div style={{ fontSize: '5px', color: '#aa7733', letterSpacing: '0.5px' }}>
                        {isAi ? `AI${algo ? ` · ${algo.toUpperCase().replace('_','-')}` : ''}` : 'HUMAN'} · {deal.playerHands[i]?.length ?? 0}♠
                      </div>
                    </div>
                    {isTurn && !isElim && (
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
                  {isElim && (
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

          {isAiTurn && currentSetup?.aiAlgorithm && (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <div style={{ fontSize: '6px', color: '#44cc88', letterSpacing: '1px' }}>
                    AI NOTEBOOK
                  </div>
                  <motion.button
                    className="font-pixel"
                    style={{
                      fontSize: '4px', color: '#44cc88',
                      background: 'transparent', border: '1px solid #44cc8833',
                      padding: '2px 6px', cursor: 'pointer', letterSpacing: '0.5px',
                    }}
                    whileHover={{ background: '#44cc8822' }}
                    onClick={() => nb.setShowAiNotebook(true)}
                  >
                    EXPAND ▸
                  </motion.button>
                </div>
                <ProbabilityNotebook
                  data={nb.probNotebooks[gs.currentTurnIndex]}
                  algorithm={currentSetup.aiAlgorithm}
                  compact
                />
              </div>
              <div style={{
                height: 1,
                background: 'repeating-linear-gradient(90deg,#224433 0,#224433 4px,transparent 4px,transparent 8px)',
                margin: '8px 0 14px',
              }} />
            </>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '6px', color: '#bb3355', letterSpacing: '1px', marginBottom: 8 }}>
              PHASE
            </div>
            <div style={{ fontSize: '6px', color: '#ff9944', letterSpacing: '1px' }}>
              {gs.gamePhase === 'idle'          && '⬥ AWAITING ACTION'}
              {gs.gamePhase === 'rolling'       && '⬥ ROLLING DICE'}
              {gs.gamePhase === 'dice'          && `⬥ MOVING (${gs.remainingMoves} LEFT)`}
              {gs.gamePhase === 'moving'        && '⬥ MOVING'}
              {gs.gamePhase === 'interrogation' && '⬥ INTERROGATION'}
              {gs.gamePhase === 'accusation'    && '⬥ ACCUSATION'}
              {gs.gamePhase === 'story'         && '⬥ CRIME THEORY'}
              {gs.gamePhase === 'reveal_result' && '⬥ RESULT'}
              {gs.gamePhase === 'game_over'     && '⬥ GAME OVER'}
            </div>
            {gs.gamePhase === 'dice' && gs.remainingMoves > 0 && !isAiTurn && (
              <div style={{ fontSize: '5px', color: '#cc9933', marginTop: 6, letterSpacing: '0.5px' }}>
                ↑↓←→ TO MOVE · SPC TO SKIP
              </div>
            )}
          </div>

          {!isAiTurn && (
            <div style={{ fontSize: '6px', color: '#8a5566', letterSpacing: '0.5px', lineHeight: 2.2 }}>
              <div style={{ color: '#bb4466', marginBottom: 4 }}>── CONTROLS ──</div>
              <div>[ENTER]  CONFIRM</div>
              <div>[↑↓←→]  MOVE</div>
              <div>[SPC]   SKIP MOVE</div>
            </div>
          )}

          {gameMode === 'ai_vs_ai' && (
            <div style={{ fontSize: '5px', color: '#334433', letterSpacing: '0.5px', lineHeight: 2, marginTop: 8 }}>
              <div style={{ color: '#446644', marginBottom: 4 }}>── OBSERVATION MODE ──</div>
              <div>AI VS AI — WATCH & ANALYZE</div>
              <div>PROBABILITY UPDATES LIVE</div>
            </div>
          )}

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
