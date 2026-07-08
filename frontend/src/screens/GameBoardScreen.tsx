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
  ROOM_TO_LOCATION_CARD,
} from '../hooks/useBoard'
import GridCell from '../components/GridCell'
import PlayerToken from '../components/PlayerToken'
import TurnOverlay from '../components/TurnOverlay'
import HandOverlay from '../components/HandOverlay'
import Dice from '../components/Dice'
import PathDots from '../components/PathDots'
import CameraController from '../components/CameraController'
import GameCard from '../components/GameCard'
import SelectionFlow from '../components/SelectionFlow'
import ResponsePhase from '../components/ResponsePhase'
import ChallengePanel from '../components/ChallengePanel'
import RevealResultOverlay from '../components/RevealResultOverlay'
import StoryScreen from '../components/StoryScreen'
import GameOverPopup from '../components/GameOverPopup'
import VictoryScreen from '../components/VictoryScreen'
import ClueNotebook from '../components/ClueNotebook'
import ProbabilityNotebook from '../components/ProbabilityNotebook'
import { useGameState } from '../hooks/useGameState'
import { useNotebooks } from '../hooks/useNotebooks'
import { useTurnActions } from '../hooks/useTurnActions'
import { useMovement } from '../hooks/useMovement'
import { useAITurn } from '../hooks/useAITurn'
import { useAudio } from '../hooks/useAudio'
import type { PlayerSetup, GameDeal, GameMode, BoardPlayer } from '../types'
import { LOCATIONS_CARDS, SUSPECTS_CARDS } from '../types'
import { heartsFor } from '../lib/bluffChallenge'

interface Props {
  players:         PlayerSetup[]
  deal:            GameDeal
  gameMode:        GameMode
  onExit:          () => void
  onRestart:       () => void
  bgMuted:         boolean
  onBgMuteToggle:  () => void
}

// ── Module-level visual constants ─────────────────────────────────────────────
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

const SIDEBAR_W = 290
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
      if (e.key === 'Enter') { e.preventDefault(); setRevealed(true) }
      if (e.key === 'Escape') onClose()
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter') setRevealed(false)
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
            HOLD  ENTER  TO  REVEAL  ALL
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
        ESC  —  GO  BACK
      </div>
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameBoardScreen({ players, deal, gameMode, onExit, onRestart, bgMuted, onBgMuteToggle }: Props) {
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

  const { board, boardSuspects, movePlayer, enterRoom, exitRoom } = useBoard()
  const flatCells = useMemo(() => board.flat(), [board])

  const locationCardLayers = useMemo(() => {
    const cardById = Object.fromEntries(LOCATIONS_CARDS.map(c => [c.id, c]))
    return Object.entries(ROOM_TO_CARD_ID).flatMap(([roomId, cardId]) => {
      const card = cardById[cardId]
      if (!card?.imageSrc) return []
      const bounds = ROOM_BOUNDS[roomId]
      if (!bounds) return []
      const [c0, c1, r0, r1] = bounds
      const s = cellSize
      const W = (c1 - c0 + 1) * s
      const H = (r1 - r0 + 1) * s

      // Build a clip-path that covers the full room but punches out each door cell.
      // Outer rectangle is CW; each door cutout is CCW (non-zero winding rule subtracts it).
      let clipPath = `M0,0 H${W} V${H} H0 Z`
      for (const [dc, dr] of (DOOR_POSITIONS[roomId] ?? [])) {
        const dx = (dc - c0) * s
        const dy = (dr - r0) * s
        clipPath += ` M${dx},${dy} V${dy + s} H${dx + s} V${dy} H${dx} Z`
      }

      return [{
        roomId,
        src: card.imageSrc,
        left: c0 * s,
        top: r0 * s,
        cardW: W,
        cardH: H,
        accentColor: card.accentColor,
        clipPath: `path('${clipPath}')`,
      }]
    })
  }, [cellSize])

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const gs = useGameState(players)
  const nb = useNotebooks(players, deal)

  // Identity of the player whose turn it is (abstract P1..Pn — no longer a suspect).
  const currentPlayer = players[gs.currentTurnIndex]
  const currentSetup  = currentPlayer
  const isAiTurn      = currentSetup?.type === 'computer'

  // The suspect token this player is moving this turn (chosen at turn start).
  const movingToken = boardSuspects.find(s => s.id === gs.selectedSuspectId)

  // Keep positionRef in sync with the moving token's grid position
  useEffect(() => {
    if (movingToken) gs.positionRef.current = movingToken.position
  }, [movingToken, gs.positionRef])

  const actions = useTurnActions({ gs, nb, players, boardSuspects, deal, exitRoom, onRestart })

  const [showVictory, setShowVictory] = useState(false)

  const handleRevealContinue = useCallback(() => {
    if (gs.gamePhase === 'game_over' && gs.gameWinner !== null) {
      setShowVictory(true)
    } else {
      actions.handleRevealContinue()
    }
  }, [gs.gamePhase, gs.gameWinner, actions])

  const { handleDiceRelease, handleDiceSettled, handleGridClick } = useMovement({
    gs, nb, board, movingToken, isAiTurn,
    currentSetup, cellSize, movePlayer, enterRoom, exitRoom,
    finishMove: actions.finishMove,
  })

  useAITurn({ gs, nb, boardSuspects, actions, currentSetup, isAiTurn })

  // ── Audio ─────────────────────────────────────────────────────────────────
  const { playDiceRoll, playStep, playInterrogation, playAccusation, playReveal } = useAudio()

  useEffect(() => { if (gs.diceRolling) playDiceRoll() }, [gs.diceRolling, playDiceRoll])
  useEffect(() => { if (gs.moveStep > 0) playStep() }, [gs.moveStep, playStep])
  useEffect(() => { if (gs.gamePhase === 'interrogation') playInterrogation() }, [gs.gamePhase, playInterrogation])
  useEffect(() => { if (gs.gamePhase === 'accusation') playAccusation() }, [gs.gamePhase, playAccusation])
  useEffect(() => { if (gs.revealResult) playReveal() }, [gs.revealResult, playReveal])

  // ── Room entry toast ──────────────────────────────────────────────────────
  const [roomToast, setRoomToast] = useState<string | null>(null)
  const prevLocationsRef = useRef<(string | null)[]>([])

  useEffect(() => {
    const prev = prevLocationsRef.current
    for (let i = 0; i < boardSuspects.length; i++) {
      const loc = boardSuspects[i].currentLocation
      if (prev[i] === null && loc !== null) {
        const label = (ROOM_DISPLAY_NAMES[loc] ?? loc).replace('\n', ' ')
        setRoomToast(label)
        break
      }
    }
    prevLocationsRef.current = boardSuspects.map(p => p.currentLocation)
  }, [boardSuspects])

  useEffect(() => {
    if (!roomToast) return
    const t = setTimeout(() => setRoomToast(null), 1800)
    return () => clearTimeout(t)
  }, [roomToast])

  // ── Derived values ────────────────────────────────────────────────────────
  // The room the moving suspect token is standing in (drives interrogation).
  const currentRoomId = (gs.hasMovedThisTurn ? movingToken?.currentLocation : null) ?? null

  const disabledActions = useMemo(() => {
    const d: string[] = []
    const status = gs.playerStatus[gs.currentTurnIndex]
    // Before moving: can roll (once a suspect is picked), not interrogate / end turn.
    // After moving: can interrogate (if token in a room) / end turn, not roll again.
    if (!gs.hasMovedThisTurn) {
      d.push('interrogation')
      d.push('endturn')
      if (!gs.selectedSuspectId) d.push('roll')
    } else {
      d.push('roll')
      if (!currentRoomId) d.push('interrogation')
    }
    if (status?.hasAccused || status?.eliminated) d.push('accusation')
    if (status?.eliminated) { d.push('roll'); d.push('interrogation') }
    return d
  }, [currentRoomId, gs.hasMovedThisTurn, gs.selectedSuspectId, gs.playerStatus, gs.currentTurnIndex])

  const turnHint = !gs.hasMovedThisTurn
    ? (gs.selectedSuspectId
        ? `MOVING: ${movingToken?.name?.toUpperCase() ?? ''}`
        : '► CLICK A SUSPECT TOKEN')
    : (currentRoomId ? '► GUESS THE WEAPON' : undefined)

  const lockedLocationCard = useMemo(() => {
    if (!currentRoomId) return undefined
    const cardId = ROOM_TO_LOCATION_CARD[currentRoomId] ?? currentRoomId
    return LOCATIONS_CARDS.find(c => c.id === cardId)
  }, [currentRoomId])

  const lockedSuspectCard = useMemo(
    () => SUSPECTS_CARDS.find(c => c.id === movingToken?.id),
    [movingToken?.id]
  )

  const isZoomed = gs.gamePhase === 'idle' && !!movingToken

  const charColors: Record<string, string> = {}
  boardSuspects.forEach(p => { charColors[p.id] = p.accentColor })

  const lfs = Math.max(5, Math.floor(cellSize * 0.23))

  // Count of suspect tokens sharing each cell — used to disambiguate stacks
  const stackCounts = useMemo(() => {
    const m: Record<string, number> = {}
    boardSuspects.forEach(s => { const k = `${s.position[0]},${s.position[1]}`; m[k] = (m[k] ?? 0) + 1 })
    return m
  }, [boardSuspects])

  // When multiple suspects share a cell, clicking opens a chooser popup
  const [suspectPicker, setSuspectPicker] = useState<BoardPlayer[] | null>(null)

  // Human clicks a suspect token to pick it (only before moving, on their turn)
  const canSelectSuspect = gs.gamePhase === 'idle' && !isAiTurn && !gs.hasMovedThisTurn
  const handleSuspectClick = useCallback((suspectId: string) => {
    if (!canSelectSuspect) return
    const clicked = boardSuspects.find(s => s.id === suspectId)
    if (!clicked) return
    const [cc, cr] = clicked.position
    const stacked = boardSuspects.filter(s => s.position[0] === cc && s.position[1] === cr)
    if (stacked.length > 1) {
      setSuspectPicker(stacked)      // ask which suspect on this block
    } else {
      gs.setSelectedSuspectId(suspectId)
    }
  }, [canSelectSuspect, boardSuspects, gs])

  const pickStackedSuspect = useCallback((suspectId: string) => {
    gs.setSelectedSuspectId(suspectId)
    setSuspectPicker(null)
  }, [gs])

  // Close the chooser if it is no longer the player's selection moment
  useEffect(() => {
    if (!canSelectSuspect && suspectPicker) setSuspectPicker(null)
  }, [canSelectSuspect, suspectPicker])

  // Inline passage-dot click handler (duplicates handleGridClick for direct dot clicks)
  const handlePassageDotClick = useCallback((col: number, row: number) => {
    const destRoomId = Object.entries(DOOR_POSITIONS).find(([, doors]) =>
      doors.some(([dc, dr]) => dc === col && dr === row)
    )?.[0]
    if (destRoomId && movingToken) {
      movePlayer(movingToken.id, [col, row])
      enterRoom(movingToken.id, destRoomId)
      gs.setPassageCells([])
      gs.setPathCells([])
      gs.remainingMovesRef.current = 0
      gs.setRemainingMoves(0)
      actions.finishMove()
    }
  }, [movingToken, movePlayer, enterRoom, gs, actions])

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
            fontSize: '8px', color: '#ff3333', background: '#2a0000',
            border: '2px solid #880000', padding: '6px 10px', cursor: 'pointer', letterSpacing: '1px',
            opacity: 1,
          }}
          whileHover={{ backgroundColor: '#3a0000', color: '#ff5555', borderColor: '#bb0000' }}
          whileTap={{ scale: 0.95 }}
          onClick={onExit}
        >
          ◀ EXIT
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
            onClick={onBgMuteToggle}
            title={bgMuted ? 'Unmute music' : 'Mute music'}
            style={{
              fontSize: '16px', padding: '4px 8px', cursor: 'pointer', lineHeight: 1,
              background: '#0d0800', border: `2px solid ${bgMuted ? '#3a1a00' : '#5c3d00'}`,
              color: bgMuted ? '#4a3010' : '#b8860b',
              boxShadow: '2px 2px 0 #000', opacity: 1,
            }}
            whileHover={{ borderColor: bgMuted ? '#5c3d00' : '#b8860b' }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.06 }}
          >
            {bgMuted ? '🔇' : '🔊'}
          </motion.button>
          <div className="font-pixel" style={{ fontSize: '7px', color: '#cc8844', letterSpacing: '1px' }}>
            {gs.gamePhase === 'idle'          && (isAiTurn ? 'AI THINKING...' : 'SELECT ACTION')}
            {gs.gamePhase === 'rolling'       && 'ROLLING...'}
            {gs.gamePhase === 'dice'          && gs.diceValue !== null && `ROLLED: ${gs.diceValue} — ${isAiTurn ? 'AI MOVING' : 'USE ARROWS'}`}
            {gs.gamePhase === 'moving'        && 'MOVING...'}
            {gs.gamePhase === 'interrogation' && 'INTERROGATION'}
            {gs.gamePhase === 'response'      && 'RESPONSE PHASE'}
            {gs.gamePhase === 'challenge'     && 'CHALLENGE PHASE'}
            {gs.gamePhase === 'accusation'    && 'ACCUSATION'}
            {gs.gamePhase === 'story'         && 'CRIME THEORY'}
            {gs.gamePhase === 'reveal_result' && 'RESULT'}
            {gs.gamePhase === 'game_over'     && (
              gs.gameWinner !== null
                ? `${players[gs.gameWinner]?.name ?? 'PLAYER'} WINS!`
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
            playerCol={movingToken?.position[0] ?? 12}
            playerRow={movingToken?.position[1] ?? 12}
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
                        fill="#ffffff" opacity={0.9} rx={1}
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

              {/* Location images — clipped to exclude door cells */}
              {locationCardLayers.map(({ roomId, src, left, top, cardW, cardH, clipPath }) => (
                <img
                  key={`loccard-${roomId}`}
                  src={src}
                  draggable={false}
                  style={{
                    position: 'absolute', left, top,
                    width: cardW, height: cardH,
                    imageRendering: 'pixelated', objectFit: 'cover',
                    opacity: 0.78, pointerEvents: 'none', userSelect: 'none', zIndex: 1,
                    clipPath,
                  }}
                />
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

              {/* Suspect tokens — all 6 always visible, movable by any player */}
              {boardSuspects.map((p, i) => (
                <PlayerToken
                  key={p.id}
                  player={p}
                  cellSize={cellSize}
                  isSelected={p.id === gs.selectedSuspectId}
                  playerIndex={i}
                  stackCount={stackCounts[`${p.position[0]},${p.position[1]}`] ?? 1}
                  onClick={() => handleSuspectClick(p.id)}
                />
              ))}
            </div>
          </CameraController>

          {/* Turn overlay (human) */}
          <AnimatePresence>
            {gs.gamePhase === 'idle' && currentPlayer && !isAiTurn && (
              <TurnOverlay
                key={gs.currentTurnIndex}
                playerName={currentPlayer.name}
                playerIcon={currentPlayer.icon}
                playerColor={currentPlayer.accentColor}
                playerIndex={gs.currentTurnIndex}
                onAction={actions.handleAction}
                disabledActions={disabledActions as ('roll' | 'interrogation' | 'accusation' | 'endturn' | 'cards' | 'notes')[]}
                hint={turnHint}
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

          {/* Stacked-suspect chooser — pick which suspect on a shared block */}
          <AnimatePresence>
            {suspectPicker && (
              <motion.div
                key="suspect-picker"
                style={{
                  position: 'absolute', inset: 0, zIndex: 40,
                  background: 'rgba(2,1,4,0.86)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSuspectPicker(null)}
              >
                <motion.div
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: '#0a0510',
                    border: '3px solid #5c3d00',
                    boxShadow: '6px 6px 0 #000, 0 0 30px #b8860b22',
                    padding: '18px 20px 20px',
                    maxWidth: '92%',
                  }}
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 10 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="font-pixel" style={{
                    fontSize: '8px', color: '#e8c060', letterSpacing: '2px',
                    textAlign: 'center', marginBottom: 4,
                  }}>
                    CHOOSE A SUSPECT
                  </div>
                  <div className="font-pixel" style={{
                    fontSize: '6px', color: '#7a5522', letterSpacing: '1px',
                    textAlign: 'center', marginBottom: 14,
                  }}>
                    {suspectPicker.length} ON THIS BLOCK
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {suspectPicker.map(s => (
                      <motion.button
                        key={s.id}
                        className="font-pixel"
                        onClick={() => pickStackedSuspect(s.id)}
                        style={{
                          width: 92,
                          background: '#0d0800',
                          border: `2px solid ${s.accentColor}88`,
                          padding: '8px 6px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          cursor: 'pointer',
                        }}
                        whileHover={{ borderColor: s.accentColor, backgroundColor: `${s.accentColor}22`, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.08 }}
                      >
                        {s.imageSrc ? (
                          <img src={s.imageSrc} alt="" style={{
                            width: 54, height: 54, objectFit: 'cover',
                            imageRendering: 'pixelated', border: `1px solid ${s.accentColor}44`,
                          }} />
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontSize: 34, color: s.accentColor, lineHeight: 1 }}>
                            {s.icon}
                          </span>
                        )}
                        <span style={{ fontSize: '6px', color: s.accentColor, letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.4 }}>
                          {s.name.toUpperCase()}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="font-pixel" style={{
                    fontSize: '5px', color: '#4a3010', letterSpacing: '1px',
                    textAlign: 'center', marginTop: 14,
                  }}>
                    CLICK OUTSIDE TO CANCEL
                  </div>
                </motion.div>
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
                lockedSuspectCard={gs.gamePhase === 'interrogation' ? lockedSuspectCard : undefined}
              />
            )}
          </AnimatePresence>

          {/* Response phase (Bluff & Challenge) */}
          <AnimatePresence>
            {gs.gamePhase === 'response' && gs.pendingSuggestion && (
              <ResponsePhase
                key="response"
                suggestion={gs.pendingSuggestion}
                players={players}
                playerStatus={gs.playerStatus}
                playerHands={deal.playerHands}
                onComplete={actions.handleResponsesComplete}
                ms={gs.ms}
                isPaused={gs.isPaused}
              />
            )}
          </AnimatePresence>

          {/* Challenge phase (Bluff & Challenge) */}
          <AnimatePresence>
            {gs.gamePhase === 'challenge' && gs.pendingSuggestion && (
              <ChallengePanel
                key="challenge"
                suggestion={gs.pendingSuggestion}
                players={players}
                playerStatus={gs.playerStatus}
                responses={gs.responses}
                interactive={players[gs.pendingSuggestion.investigatorIndex]?.type !== 'computer'}
                onResolve={actions.handleChallengeResolve}
                ms={gs.ms}
                isPaused={gs.isPaused}
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
                onContinue={handleRevealContinue}
              />
            )}
          </AnimatePresence>

          {/* Game over popup (all eliminated) */}
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

          {/* Victory screen (correct accusation) */}
          <AnimatePresence>
            {showVictory && gs.gameWinner !== null && (
              <VictoryScreen
                key="victory"
                winnerName={players[gs.gameWinner]?.name ?? 'PLAYER'}
                winnerIcon={players[gs.gameWinner]?.icon ?? '?'}
                winnerColor={players[gs.gameWinner]?.accentColor ?? '#22cc66'}
                caseFile={deal.caseFile}
                onRestart={onRestart}
                onExit={onExit}
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
                  {players.map((p, i) => {
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
                    const p      = players[pi]
                    const pSetup = players[pi]
                    const isElim = gs.playerStatus[pi]?.eliminated
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
                              {deal.playerHands[pi]?.length ?? 0} CARDS
                              {' · '}<span style={{ color: '#ff4466' }}>{heartsFor(gs.playerStatus[pi]?.lives ?? 2)}</span>
                              {(gs.playerStatus[pi]?.lives ?? 2) === 0 ? ' NO-BLUFF' : ''}
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
                    marginTop: 8, fontSize: '11px', color: '#ffdd00',
                    letterSpacing: '1px', textAlign: 'center',
                  }}>
                    STEPS: {gs.remainingMoves}
                  </div>
                  {gs.gamePhase === 'dice' && gs.remainingMoves > 0 && !isAiTurn && (
                    <motion.div
                      className="font-pixel"
                      style={{
                        marginTop: 6, fontSize: '8px', color: '#cc9933',
                        letterSpacing: '0.5px', textAlign: 'center', lineHeight: 2,
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

          {/* Room entry toast */}
          <AnimatePresence>
            {roomToast && (
              <motion.div
                key={roomToast}
                style={{
                  position: 'absolute', top: 14,
                  left: 0, right: 0,
                  display: 'flex', justifyContent: 'center',
                  zIndex: 25, pointerEvents: 'none',
                }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.14, ease: 'linear' }}
              >
                <div style={{
                  background: 'rgba(0,0,0,0.86)',
                  border: '1px solid #aa660044',
                  padding: '6px 16px',
                  boxShadow: '0 0 20px #cc880022',
                }}>
                  <div className="font-pixel" style={{
                    fontSize: '7px', color: '#cc9933',
                    letterSpacing: '2px',
                  }}>
                    ENTERED {roomToast.toUpperCase()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: '11px', color: '#cc3355', letterSpacing: '2px' }}>
              ── PLAYERS ──
            </div>
            <div style={{
              fontSize: '8px', color: '#7a3344',
              letterSpacing: '1.5px', flexShrink: 0,
            }}>
              TURN {String(gs.turnCount + 1).padStart(2, '0')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p, i) => {
              const isTurn = i === gs.currentTurnIndex
              const isElim = gs.playerStatus[i]?.eliminated
              const isAi   = p?.type === 'computer'
              const algo   = p?.aiAlgorithm
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: '10px', color: p.accentColor, flexShrink: 0 }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '10px',
                        color: isElim ? '#553333' : isTurn ? '#ffdd00' : '#cc9944',
                        letterSpacing: '1.2px', marginBottom: 3,
                        textDecoration: isElim ? 'line-through' : 'none',
                      }}>{p.name}</div>
                      <div style={{ fontSize: '8px', color: '#aa7733', letterSpacing: '0.5px' }}>
                        {isAi ? `AI${algo ? ` · ${algo.toUpperCase().replace('_','-')}` : ''}` : 'HUMAN'} · {deal.playerHands[i]?.length ?? 0} cards
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#ff4466', letterSpacing: '1px', lineHeight: 1 }}>
                          {heartsFor(gs.playerStatus[i]?.lives ?? 2)}
                        </span>
                        {(gs.playerStatus[i]?.lives ?? 2) === 0 && (
                          <span style={{ fontSize: '7px', color: '#886655', letterSpacing: '0.5px' }}>NO BLUFF</span>
                        )}
                      </div>
                    </div>
                    {isTurn && !isElim && (
                      <motion.span
                        style={{ fontSize: '10px', color: '#ff3344', flexShrink: 0 }}
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.65, repeat: Infinity }}
                      >●</motion.span>
                    )}
                  </div>
                  {isElim && (
                    <div style={{ fontSize: '8px', color: '#ee3333', letterSpacing: '0.5px', marginTop: 4 }}>
                      ✗ ELIMINATED
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Suspect token locations — the 6 shared tokens on the board */}
          <div style={{
            fontSize: '9px', color: '#8a5566', letterSpacing: '1.5px',
            margin: '14px 0 8px',
          }}>
            ── SUSPECT TOKENS ──
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {boardSuspects.map((s) => {
              const roomName = s.currentLocation
                ? (ROOM_DISPLAY_NAMES[s.currentLocation] ?? s.currentLocation).replace('\n', ' ')
                : 'HALLWAY'
              const isMoving = s.id === gs.selectedSuspectId
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 6px',
                  background: isMoving ? `${s.accentColor}18` : 'transparent',
                  border: isMoving ? `1px solid ${s.accentColor}55` : '1px solid transparent',
                }}>
                  <span style={{ fontSize: '9px', color: s.accentColor, flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ fontSize: '7px', color: '#cc9944', letterSpacing: '0.4px', flex: 1, minWidth: 0 }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: '7px', color: s.currentLocation ? '#66aa77' : '#665544', letterSpacing: '0.3px', flexShrink: 0 }}>
                    {roomName}
                  </span>
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
                  <div style={{ fontSize: '10px', color: '#44cc88', letterSpacing: '1px' }}>
                    AI NOTEBOOK
                  </div>
                  <motion.button
                    className="font-pixel"
                    style={{
                      fontSize: '8px', color: '#44cc88',
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

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '10px', color: '#bb3355', letterSpacing: '1px', marginBottom: 10 }}>
              PHASE
            </div>
            <div style={{ fontSize: '10px', color: '#ff9944', letterSpacing: '1px' }}>
              {gs.gamePhase === 'idle'          && 'AWAITING ACTION'}
              {gs.gamePhase === 'rolling'       && 'ROLLING DICE'}
              {gs.gamePhase === 'dice'          && `MOVING (${gs.remainingMoves} LEFT)`}
              {gs.gamePhase === 'moving'        && 'MOVING'}
              {gs.gamePhase === 'interrogation' && 'INTERROGATION'}
              {gs.gamePhase === 'response'      && 'RESPONSE PHASE'}
              {gs.gamePhase === 'challenge'     && 'CHALLENGE PHASE'}
              {gs.gamePhase === 'accusation'    && 'ACCUSATION'}
              {gs.gamePhase === 'story'         && 'CRIME THEORY'}
              {gs.gamePhase === 'reveal_result' && 'RESULT'}
              {gs.gamePhase === 'game_over'     && 'GAME OVER'}
            </div>
            {gs.gamePhase === 'dice' && gs.remainingMoves > 0 && !isAiTurn && (
              <div style={{ fontSize: '9px', color: '#cc9933', marginTop: 8, letterSpacing: '0.5px' }}>
                ↑↓←→ TO MOVE · SPC TO SKIP
              </div>
            )}
          </div>

          {!isAiTurn && (
            <div style={{ fontSize: '10px', color: '#8a5566', letterSpacing: '0.5px', lineHeight: 2.4 }}>
              <div style={{ color: '#bb4466', marginBottom: 6 }}>── CONTROLS ──</div>
              <div>[ENTER]  CONFIRM</div>
              <div>[↑↓←→]  MOVE</div>
              <div>[SPC]   SKIP MOVE</div>
            </div>
          )}

          {gameMode === 'ai_vs_ai' && (
            <div style={{ fontSize: '9px', color: '#446644', letterSpacing: '0.5px', lineHeight: 2, marginTop: 8 }}>
              <div style={{ color: '#55aa66', marginBottom: 6 }}>── OBSERVATION MODE ──</div>
              <div>AI VS AI — WATCH & ANALYZE</div>
              <div>PROBABILITY UPDATES LIVE</div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          <div style={{
            borderTop: '1px solid #331120', paddingTop: 12,
            fontSize: '9px', color: '#7a4422', letterSpacing: '0.5px', lineHeight: 2.2,
          }}>
            <div>FIND THE KILLER</div>
            <div>SOLVE THE CASE</div>
          </div>
        </div>
      </div>
    </div>
  )
}
