// OnlineGameBoardScreen — renders the authoritative server snapshot using the
// SAME board, token, card, and overlay components as the local hotseat game
// (GridCell, PlayerToken, CameraController, TurnOverlay, SelectionFlow,
// StoryScreen, RevealResultOverlay, VictoryScreen, GameOverPopup, ClueNotebook)
// so online play looks and feels identical to local play. This screen computes
// NO rules: reachable cells are derived only to draw highlights (the server
// re-validates every move), and every phase transition comes from the redacted
// GameView. Two components — the response and challenge overlays — cannot
// reuse the local versions verbatim (those are single-device, pass-the-device
// components that read every player's hand; the server correctly never sends
// that online), so they are rebuilt here with the same visual language
// (CardPill, claim colors/icons, hearts) restructured for per-client delivery.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { OnlineGame } from '../hooks/useOnlineGame'
import type { GameView } from '../shared/protocol'
import type { ResponseClaim } from '../shared/gameTypes'
import {
  initializeBoard, getReachableCells, getPassageDoors,
  ROOM_BOUNDS, DOOR_POSITIONS, CHAR_STARTS,
  ROOM_DISPLAY_NAMES, ROOM_TO_LOCATION_CARD, COLS, ROWS,
} from '../shared/board'
import {
  RESPONSE_CLAIMS, CLAIM_LABEL, CLAIM_ICON, CLAIM_COLOR,
  claimIsTruthful, truthfulClaimFor, heartsFor,
} from '../shared/bluffChallenge'
import GridCell from '../components/GridCell'
import PlayerToken from '../components/PlayerToken'
import TurnOverlay from '../components/TurnOverlay'
import HandOverlay from '../components/HandOverlay'
import Dice from '../components/Dice'
import PathDots from '../components/PathDots'
import CameraController from '../components/CameraController'
import CardPill from '../components/CardPill'
import GameCard from '../components/GameCard'
import SelectionFlow from '../components/SelectionFlow'
import type { SelectionFlowResult } from '../components/SelectionFlow'
import StoryScreen from '../components/StoryScreen'
import RevealResultOverlay from '../components/RevealResultOverlay'
import GameOverPopup from '../components/GameOverPopup'
import VictoryScreen from '../components/VictoryScreen'
import ClueNotebook from '../components/ClueNotebook'
import { useOnlineNotebook } from '../hooks/useOnlineNotebook'
import { generateStory } from '../lib/storyGenerator'
import { ALL_CARDS, SUSPECTS_CARDS, LOCATIONS_CARDS } from '../types'
import type { Card, BoardPlayer } from '../types'

interface Props {
  online:  OnlineGame
  onLeave: () => void
}

const board = initializeBoard()
const cardById = (id: string): Card | undefined => ALL_CARDS.find(c => c.id === id)

// ── Module-level visual constants (mirrors GameBoardScreen.tsx) ──────────────
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

// ── Small pixel button (used by the rebuilt response/challenge overlays) ─────
function PB({ label, onClick, color = '#e8c060', disabled }: { label: string; onClick: () => void; color?: string; disabled?: boolean }) {
  return (
    <motion.button className="font-pixel" onClick={onClick} disabled={disabled}
      whileHover={disabled ? {} : { y: -2 }} whileTap={disabled ? {} : { y: 2 }}
      style={{
        background: disabled ? '#1a1000' : '#2a1800',
        border: `2px solid ${disabled ? '#3a2600' : color}`,
        color: disabled ? '#5a4420' : color,
        padding: '8px 12px', fontSize: '9px', letterSpacing: '1px',
        cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: '3px 3px 0 #000',
      }}>
      {label}
    </motion.button>
  )
}

function WaitingList({ view, label, ids }: { view: GameView; label: string; ids: number[] }) {
  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <motion.div className="font-pixel" style={{ fontSize: '9px', color: '#ccaa00', letterSpacing: '2px' }}
        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>{label}</motion.div>
      <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', marginTop: 8, letterSpacing: '1px' }}>
        {ids.map(i => view.players[i]?.name.toUpperCase()).join(' · ')}
      </div>
    </div>
  )
}

// ── CardsOverlay — hold-to-reveal own hand (ported from GameBoardScreen) ─────
interface CardsOverlayProps {
  hand: Card[]
  playerName: string
  playerIcon: string
  playerColor: string
  onClose: () => void
}
function CardsOverlay({ hand, playerName, playerIcon, playerColor, onClose }: CardsOverlayProps) {
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
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Enter') setRevealed(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [onClose])

  const GAP  = Math.max(8, Math.floor(vw * 0.01))
  const cols = Math.min(hand.length, 3)
  const cardW = Math.min(Math.floor((vw * 0.72 - GAP * (cols - 1)) / Math.max(1, cols)), 180)
  const cardH = Math.floor(cardW * 1.375)
  const rows = [hand.slice(0, 3), hand.slice(3, 6)].filter(r => r.length > 0)

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0, background: '#030200',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: 46, overflow: 'hidden',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'linear' }}
      onMouseDown={() => setRevealed(true)}
      onMouseUp={() => setRevealed(false)}
      onMouseLeave={() => setRevealed(false)}
      onTouchStart={() => setRevealed(true)}
      onTouchEnd={() => setRevealed(false)}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.82) 100%)', zIndex: 0,
      }} />
      <motion.button
        className="font-pixel absolute"
        style={{
          top: 10, left: 12, zIndex: 10,
          background: '#1a0800', border: '2px solid #3d2000',
          color: '#6b4020', padding: '5px 10px', fontSize: '5px', letterSpacing: '1px', cursor: 'pointer',
        }}
        onClick={onClose}
        whileHover={{ backgroundColor: '#2a1000', color: '#aa6030' }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.08 }}
      >
        ◀ BACK
      </motion.button>

      <motion.div
        className="relative z-10 text-center"
        style={{ marginTop: Math.floor(vh * 0.05), marginBottom: Math.floor(vh * 0.03) }}
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      >
        <div className="font-pixel" style={{ fontSize: '6px', color: '#4a3010', letterSpacing: '3px', marginBottom: 8 }}>
          ─── PRIVATE FILES ───
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 22, color: playerColor }}>{playerIcon}</span>
          <div className="font-pixel" style={{ fontSize: 'clamp(9px, 1.8vw, 13px)', color: playerColor, letterSpacing: '2px' }}>
            {playerName.toUpperCase()}
          </div>
        </div>
      </motion.div>

      <div className="relative z-10" style={{ display: 'flex', flexDirection: 'column', gap: GAP, alignItems: 'center' }}>
        {rows.map((rowCards, ri) => (
          <div key={ri} style={{ display: 'flex', gap: GAP }}>
            {rowCards.map((card) => (
              <GameCard key={card.id} card={card} width={cardW} height={cardH} faceUp={revealed} />
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

// ── Response overlay — per-client (server already gates who sees the form) ──
function ResponseOverlay({ view, onRespond }: { view: GameView; onRespond: (claim: ResponseClaim) => void }) {
  const s = view.pendingSuggestion!
  const mine = view.awaitingResponders.includes(view.myIndex)
  const me = view.players[view.myIndex]
  const myLives = me?.lives ?? 0
  const mustTellTruth = myLives <= 0
  const truthful = truthfulClaimFor(view.myHand, s.suspectId, s.weaponId, s.locationCardId)
  const totalCount = view.responses.length + view.awaitingResponders.length

  return (
    <motion.div
      style={{ position: 'absolute', inset: 0, zIndex: 44, background: '#040207', display: 'flex', flexDirection: 'column' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <div style={{
        height: 46, flexShrink: 0, background: '#07030a', borderBottom: '2px solid #2a0025',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
      }}>
        <div className="font-pixel" style={{ fontSize: '8px', color: '#cc6699', letterSpacing: '3px' }}>♦ RESPONSE PHASE</div>
        <div className="font-pixel" style={{ fontSize: '7px', color: '#7a5566', letterSpacing: '1.5px' }}>
          RESPONDED {view.responses.length} / {totalCount}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0 6px', flexShrink: 0 }}>
        <CardPill cardId={s.suspectId}      width={64} imageHeight={80} />
        <CardPill cardId={s.weaponId}       width={64} imageHeight={80} />
        <CardPill cardId={s.locationCardId} width={64} imageHeight={80} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
        {mine ? (
          <div style={{ width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="font-pixel" style={{ fontSize: '9px', color: me?.color ?? '#e8c060', letterSpacing: '2px', marginBottom: 4 }}>
              {me?.icon} {me?.name} · {heartsFor(myLives)}
            </div>
            <div className="font-pixel" style={{ fontSize: '6px', color: '#886655', letterSpacing: '1px', marginBottom: 12 }}>
              {myLives > 0 ? 'YOU MAY BLUFF — OR TELL THE TRUTH' : 'NO LIVES LEFT — YOU MUST TELL THE TRUTH'}
            </div>

            <div className="font-pixel" style={{ fontSize: '5px', color: '#5a4433', letterSpacing: '1.5px', marginBottom: 6 }}>
              ── YOUR CARDS ──
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginBottom: 16, maxWidth: 560 }}>
              {view.myHand.length === 0 && (
                <div className="font-pixel" style={{ fontSize: '6px', color: '#665544', letterSpacing: '1px' }}>NO CARDS</div>
              )}
              {view.myHand.map(id => {
                const c = cardById(id)
                if (!c) return null
                const relevant = id === s.suspectId || id === s.weaponId || id === s.locationCardId
                return (
                  <div key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 5, background: c.bgColor,
                    border: `1px solid ${relevant ? c.accentColor : c.accentColor + '33'}`,
                    boxShadow: relevant ? `0 0 8px ${c.accentColor}66` : 'none', padding: '4px 7px',
                  }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: c.accentColor, lineHeight: 1 }}>{c.icon}</span>
                    <span className="font-pixel" style={{ fontSize: '5px', color: c.accentColor, letterSpacing: '0.4px' }}>
                      {c.name.toUpperCase()}
                    </span>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(150px, 240px))', gap: 10, width: '100%', justifyContent: 'center' }}>
              {RESPONSE_CLAIMS.map(claim => {
                const isTruth = claimIsTruthful(claim, view.myHand, s.suspectId, s.weaponId, s.locationCardId)
                const locked = mustTellTruth && !isTruth
                const color = CLAIM_COLOR[claim]
                return (
                  <motion.button
                    key={claim}
                    className="font-pixel"
                    disabled={locked}
                    onClick={() => !locked && onRespond(claim)}
                    style={{
                      background: '#0c0710',
                      border: `2px solid ${locked ? '#241a24' : color + '88'}`,
                      color: locked ? '#3a2f3a' : color,
                      padding: '12px 10px', cursor: locked ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 9,
                      letterSpacing: '1px', fontSize: '8px', opacity: locked ? 0.5 : 1,
                    }}
                    whileHover={locked ? {} : { background: `${color}22`, borderColor: color }}
                    whileTap={locked ? {} : { scale: 0.97 }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 15, lineHeight: 1 }}>{CLAIM_ICON[claim]}</span>
                    {CLAIM_LABEL[claim]}{claim === truthful ? ' ✓' : ''}
                  </motion.button>
                )
              })}
            </div>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#4a3a2a', letterSpacing: '1px', marginTop: 14 }}>
              ✓ = YOUR TRUTHFUL ANSWER · RESPONSES STAY HIDDEN UNTIL EVERYONE HAS ANSWERED
            </div>
          </div>
        ) : (
          <WaitingList view={view} label="WAITING FOR RESPONSES" ids={view.awaitingResponders} />
        )}
      </div>
    </motion.div>
  )
}

// ── Challenge overlay — investigator-only interactive, matches ChallengePanel
function ChallengeOverlay({ view, onResolve }: {
  view: GameView
  onResolve: (challengedIndex: number | null, revealTargetIndex: number | null) => void
}) {
  const s = view.pendingSuggestion!
  const investigator = view.players[s.investigatorIndex]
  const amInvestigator = view.myIndex === s.investigatorIndex
  const claimants = view.responses.filter(r => r.claim !== 'cannot')

  const [step, setStep] = useState<'challenge' | 'reveal'>('challenge')
  const [challengedIndex, setChallengedIndex] = useState<number | null>(null)

  const goToReveal = (chIdx: number | null) => {
    setChallengedIndex(chIdx)
    if (claimants.length === 0) onResolve(chIdx, null)
    else setStep('reveal')
  }

  if (!amInvestigator) {
    return (
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 44, background: '#040207', display: 'flex', flexDirection: 'column' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      >
        <div style={{
          height: 46, flexShrink: 0, background: '#07030a', borderBottom: '2px solid #2a0025',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
        }}>
          <div className="font-pixel" style={{ fontSize: '8px', color: '#cc6699', letterSpacing: '3px' }}>⚔ CHALLENGE PHASE</div>
          <div className="font-pixel" style={{ fontSize: '7px', color: '#7a5566', letterSpacing: '1.5px' }}>
            INVESTIGATOR: {investigator?.name.toUpperCase() ?? '—'}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WaitingList view={view} label="INVESTIGATOR IS DECIDING…" ids={[s.investigatorIndex]} />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      style={{ position: 'absolute', inset: 0, zIndex: 44, background: '#040207', display: 'flex', flexDirection: 'column' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <div style={{
        height: 46, flexShrink: 0, background: '#07030a', borderBottom: '2px solid #2a0025',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
      }}>
        <div className="font-pixel" style={{ fontSize: '8px', color: '#cc6699', letterSpacing: '3px' }}>⚔ CHALLENGE PHASE</div>
        <div className="font-pixel" style={{ fontSize: '7px', color: '#7a5566', letterSpacing: '1.5px' }}>YOU ARE THE INVESTIGATOR</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0 4px', flexShrink: 0 }}>
        <CardPill cardId={s.suspectId}      width={58} imageHeight={72} />
        <CardPill cardId={s.weaponId}       width={58} imageHeight={72} />
        <CardPill cardId={s.locationCardId} width={58} imageHeight={72} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="font-pixel" style={{ fontSize: '6px', color: '#7a5566', letterSpacing: '2px', margin: '4px 0 8px' }}>
          {step === 'challenge' ? '── RESPONSES ──' : '── DEMAND A CARD ──'}
        </div>

        {step === 'challenge' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 560 }}>
              {view.responses.map(r => {
                const p = view.players[r.playerIndex]
                return (
                  <motion.button
                    key={r.playerIndex}
                    className="font-pixel"
                    onClick={() => goToReveal(r.playerIndex)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, background: '#0b0710',
                      border: `1px solid ${(p?.color ?? '#333') + '44'}`, padding: '7px 10px', cursor: 'pointer',
                    }}
                    whileHover={{ borderColor: '#cc4466', background: '#2a0012' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: p?.color ?? '#ccc', flexShrink: 0 }}>{p?.icon}</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="font-pixel" style={{ fontSize: '7px', color: p?.color ?? '#ccc', letterSpacing: '1px' }}>
                        {p?.name} <span style={{ color: '#cc4466' }}>{heartsFor(p?.lives ?? 0)}</span>
                      </div>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, color: CLAIM_COLOR[r.claim], flexShrink: 0 }}>{CLAIM_ICON[r.claim]}</span>
                    <span className="font-pixel" style={{ fontSize: '7px', color: CLAIM_COLOR[r.claim], letterSpacing: '0.5px', width: 150, textAlign: 'right', flexShrink: 0 }}>
                      {CLAIM_LABEL[r.claim]}
                    </span>
                    <span className="font-pixel" style={{ flexShrink: 0, color: '#cc6688', fontSize: '6px', letterSpacing: '1px' }}>⚔ CHALLENGE</span>
                  </motion.button>
                )
              })}
            </div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 18, textAlign: 'center' }}>
              <div className="font-pixel" style={{ fontSize: '6px', color: '#886655', letterSpacing: '1px', lineHeight: 2, marginBottom: 12 }}>
                CATCH A LIAR: RIGHT → THEY LOSE A LIFE · WRONG → YOU DO.<br />CLICK A RESPONSE TO CHALLENGE IT, OR SKIP.
              </div>
              <PB label="▶ SKIP CHALLENGE" color="#b8860b" onClick={() => goToReveal(null)} />
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 4, textAlign: 'center', width: '100%', maxWidth: 560 }}
          >
            <div className="font-pixel" style={{ fontSize: '6px', color: '#886655', letterSpacing: '1px', marginBottom: 14 }}>
              CHOOSE A CLAIMANT TO PRIVATELY SHOW YOU A CARD
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {claimants.map(r => {
                const p = view.players[r.playerIndex]
                const color = CLAIM_COLOR[r.claim]
                return (
                  <motion.button
                    key={r.playerIndex}
                    className="font-pixel"
                    onClick={() => onResolve(challengedIndex, r.playerIndex)}
                    style={{
                      background: '#0c0710', border: `2px solid ${color}88`, color,
                      padding: '10px 14px', fontSize: '7px', letterSpacing: '1px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                    whileHover={{ background: `${color}22`, borderColor: color }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{p?.icon}</span>
                    {p?.name} · {CLAIM_ICON[r.claim]} {CLAIM_LABEL[r.claim].replace('DISPROVE ', '')}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnlineGameBoardScreen({ online, onLeave }: Props) {
  const view = online.view
  const send = online.send
  const { status: connectionStatus, error: connectionError, clearError } = online

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
  const flatCells = useMemo(() => board.flat(), [])

  const nb = useOnlineNotebook()

  // ── Local UI-only state (no rules computed — server is authoritative) ──────
  const [weaponPick, setWeaponPick]           = useState(false)
  const [accuse, setAccuse]                   = useState(false)
  const [showCards, setShowCards]             = useState(false)
  const [rollGestureActive, setRollGestureActive] = useState(false)
  const [diceRollingAnim, setDiceRollingAnim] = useState(false)
  const [suspectPicker, setSuspectPicker]     = useState<BoardPlayer[] | null>(null)
  const [storyDismissedForTurn, setStoryDismissedForTurn] = useState<number | null>(null)
  const [roomToast, setRoomToast]             = useState<string | null>(null)
  const prevLocationsRef = useRef<(string | null)[]>([])
  const prevDiceRef      = useRef<number | null>(null)

  const boardSuspects: BoardPlayer[] = useMemo(() => {
    if (!view) return []
    return view.suspects.map(s => {
      const card = SUSPECTS_CARDS.find(c => c.id === s.id)
      return {
        id: s.id,
        name: card?.name ?? s.id,
        icon: card?.icon ?? '?',
        imageSrc: card?.imageSrc,
        accentColor: card?.accentColor ?? '#888888',
        position: s.position,
        currentLocation: s.currentLocation,
      }
    })
  }, [view])

  const stackCounts = useMemo(() => {
    const m: Record<string, number> = {}
    boardSuspects.forEach(s => { const k = `${s.position[0]},${s.position[1]}`; m[k] = (m[k] ?? 0) + 1 })
    return m
  }, [boardSuspects])

  const me         = view ? view.players[view.myIndex] : undefined
  const isMyTurn   = !!view && view.currentTurnIndex === view.myIndex && view.phase === 'turn'
  const token      = view ? boardSuspects.find(s => s.id === view.selectedSuspectId) : undefined
  const midMove    = !!view && view.dice !== null && !view.hasMovedThisTurn

  // Reachable highlights (drawing only — server is authoritative).
  const highlights = useMemo(() => {
    const empty = { cells: [] as [number, number][], passage: [] as [number, number][] }
    if (!view || !isMyTurn || view.dice === null || view.hasMovedThisTurn || !token) return empty
    const cells = getReachableCells(board, token.position, view.dice)
    const passage = token.currentLocation ? getPassageDoors(token.currentLocation) : []
    return { cells, passage }
  }, [view, isMyTurn, token])

  // Dice-roll settle animation: flip to "rolling" the instant the server
  // confirms a non-null value, let Dice's own interval randomize then settle.
  useEffect(() => {
    if (!view) return
    if (view.dice !== null && prevDiceRef.current === null) setDiceRollingAnim(true)
    if (view.dice === null) setDiceRollingAnim(false)
    prevDiceRef.current = view.dice
  }, [view?.dice])

  // Server error toast — auto-dismiss so a stale/transient error doesn't linger.
  useEffect(() => {
    if (!connectionError) return
    const t = setTimeout(() => clearError(), 4000)
    return () => clearTimeout(t)
  }, [connectionError, clearError])

  // Room-entry toast.
  useEffect(() => {
    const prev = prevLocationsRef.current
    for (let i = 0; i < boardSuspects.length; i++) {
      const loc = boardSuspects[i].currentLocation
      if (prev[i] === null && loc !== null) {
        setRoomToast((ROOM_DISPLAY_NAMES[loc] ?? loc).replace('\n', ' '))
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

  const canSelectSuspect = isMyTurn && view?.dice === null && !view?.hasMovedThisTurn
  const handleSuspectClick = useCallback((suspectId: string) => {
    if (!canSelectSuspect) return
    const clicked = boardSuspects.find(s => s.id === suspectId)
    if (!clicked) return
    const [cc, cr] = clicked.position
    const stacked = boardSuspects.filter(s => s.position[0] === cc && s.position[1] === cr)
    if (stacked.length > 1) setSuspectPicker(stacked)
    else send({ type: 'pickSuspect', suspectId })
  }, [canSelectSuspect, boardSuspects, send])
  const pickStackedSuspect = useCallback((suspectId: string) => {
    send({ type: 'pickSuspect', suspectId })
    setSuspectPicker(null)
  }, [send])
  useEffect(() => { if (!canSelectSuspect && suspectPicker) setSuspectPicker(null) }, [canSelectSuspect, suspectPicker])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMyTurn || !view || view.dice === null || view.hasMovedThisTurn) return
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / cellSize)
    const row = Math.floor((e.clientY - rect.top) / cellSize)
    const reachable = highlights.cells.some(([c, r]) => c === col && r === row) ||
                       highlights.passage.some(([c, r]) => c === col && r === row)
    if (!reachable) return
    send({ type: 'move', col, row })
  }, [isMyTurn, view, cellSize, highlights, send])

  if (!view) return null

  const locationCardLayers = (() => {
    const cardById2 = Object.fromEntries(LOCATIONS_CARDS.map(c => [c.id, c]))
    return Object.entries(ROOM_TO_LOCATION_CARD).flatMap(([roomId, cardId]) => {
      const card = cardById2[cardId]
      if (!card?.imageSrc) return []
      const bounds = ROOM_BOUNDS[roomId]
      if (!bounds) return []
      const [c0, c1, r0, r1] = bounds
      const s = cellSize
      const W = (c1 - c0 + 1) * s
      const H = (r1 - r0 + 1) * s
      let clipPath = `M0,0 H${W} V${H} H0 Z`
      for (const [dc, dr] of (DOOR_POSITIONS[roomId] ?? [])) {
        const dx = (dc - c0) * s
        const dy = (dr - r0) * s
        clipPath += ` M${dx},${dy} V${dy + s} H${dx + s} V${dy} H${dx} Z`
      }
      return [{ roomId, src: card.imageSrc, left: c0 * s, top: r0 * s, cardW: W, cardH: H, clipPath: `path('${clipPath}')` }]
    })
  })()

  const charColors: Record<string, string> = {}
  boardSuspects.forEach(p => { charColors[p.id] = p.accentColor })
  const lfs = Math.max(5, Math.floor(cellSize * 0.23))

  const disabledActions = (() => {
    const d: string[] = []
    if (!view.hasMovedThisTurn) {
      d.push('interrogation'); d.push('endturn')
      if (!view.selectedSuspectId || view.dice !== null) d.push('roll')
    } else {
      d.push('roll')
      if (!token?.currentLocation) d.push('interrogation')
    }
    if (me?.hasAccused || me?.eliminated) d.push('accusation')
    if (me?.eliminated) { d.push('roll'); d.push('interrogation') }
    return d
  })()

  const turnHint = !view.hasMovedThisTurn
    ? (view.selectedSuspectId ? `MOVING: ${token?.name?.toUpperCase() ?? ''}` : '► CLICK A SUSPECT TOKEN')
    : (token?.currentLocation ? '► GUESS THE WEAPON' : undefined)

  const lockedLocationCard = token?.currentLocation
    ? LOCATIONS_CARDS.find(c => c.id === (ROOM_TO_LOCATION_CARD[token.currentLocation!] ?? token.currentLocation))
    : undefined
  const lockedSuspectCard = SUSPECTS_CARDS.find(c => c.id === token?.id)

  const isZoomed = view.phase === 'turn' && !!token && !weaponPick && !accuse
  const showTurnOverlay = isMyTurn && !midMove && !rollGestureActive && !weaponPick && !accuse

  // ── Story → reveal sequencing (client-only beat; server phase stays 'reveal') ─
  const showStory  = view.phase === 'reveal' && !!view.reveal && storyDismissedForTurn !== view.turnCount
  const showReveal = view.phase === 'reveal' && !!view.reveal && storyDismissedForTurn === view.turnCount
  const storyText  = view.reveal ? generateStory(view.reveal.suspectId, view.reveal.weaponId, view.reveal.locationId) : ''

  const caseFileForReveal = (() => {
    const rv = view.reveal
    const src = view.caseFile ?? (rv ? { suspect: rv.suspectId, weapon: rv.weaponId, location: rv.locationId } : null)
    if (!src) return null
    const s = cardById(src.suspect), w = cardById(src.weapon), l = cardById(src.location)
    if (!s || !w || !l) return null
    return {
      suspect:  { id: s.id, icon: s.icon, name: s.name },
      weapon:   { id: w.id, icon: w.icon, name: w.name },
      location: { id: l.id, icon: l.icon, name: l.name },
    }
  })()

  const fullCaseFile = view.caseFile
    ? {
        suspect:  cardById(view.caseFile.suspect)!,
        weapon:   cardById(view.caseFile.weapon)!,
        location: cardById(view.caseFile.location)!,
      }
    : null

  const myHandCards = view.myHand.map(id => cardById(id)).filter((c): c is Card => !!c)

  const handleContinueReveal = () => {
    if (view.myIndex === view.currentTurnIndex) send({ type: 'continue' })
  }

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
          }}
          whileHover={{ backgroundColor: '#3a0000', color: '#ff5555', borderColor: '#bb0000' }}
          whileTap={{ scale: 0.95 }}
          onClick={onLeave}
        >
          ◀ LEAVE
        </motion.button>
        <div style={{ fontSize: '9px', color: '#dd3366', letterSpacing: '4px' }}>
          MURDER IN KUET · ONLINE
        </div>
        <div className="font-pixel" style={{ fontSize: '7px', color: '#cc8844', letterSpacing: '1px' }}>
          {view.phase === 'turn'      && (isMyTurn ? 'YOUR TURN' : `${view.players[view.currentTurnIndex]?.name.toUpperCase() ?? ''}'S TURN`)}
          {view.phase === 'response'  && 'RESPONSE PHASE'}
          {view.phase === 'challenge' && 'CHALLENGE PHASE'}
          {view.phase === 'reveal'    && 'RESULT'}
          {view.phase === 'game_over' && (view.winnerIndex !== null ? `${view.players[view.winnerIndex]?.name ?? 'PLAYER'} WINS!` : 'GAME OVER')}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Board area */}
        <div className="flex-1 flex items-center justify-center overflow-hidden relative" style={{ padding: PAD, background: '#040a04' }}>
          <CameraController
            playerCol={token?.position[0] ?? 12}
            playerRow={token?.position[1] ?? 12}
            cellSize={cellSize}
            boardW={boardW}
            boardH={boardH}
            isZoomed={isZoomed}
          >
            <div className="relative shrink-0" style={{ width: boardW, height: boardH, overflow: 'visible' }}>

              {/* Grid cells */}
              <div
                style={{
                  position: 'absolute', inset: 0, display: 'grid',
                  gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
                  gridTemplateRows:    `repeat(${ROWS}, ${cellSize}px)`,
                  cursor: 'default',
                }}
                onClick={handleGridClick}
              >
                {flatCells.map((cell, i) => (
                  <GridCell key={i} cell={cell} cellSize={cellSize} col={i % COLS} row={Math.floor(i / COLS)} />
                ))}
              </div>

              {/* SVG overlay — door arches, secret-passage arrows, start labels/dots */}
              <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', width: boardW, height: boardH, pointerEvents: 'none', zIndex: 2 }}>
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
                    return <rect key={`door-${roomId}-${di}`} x={rx} y={ry} width={rw} height={rh} fill="#ffffff" opacity={0.9} rx={1} />
                  })
                )}

                {SECRET_PASSAGES.map((sp, i) => (
                  <g key={i}>
                    <text x={sp.col * cellSize} y={sp.row * cellSize} fontSize={Math.max(7, cellSize * 0.42)}
                      fill="#e2bf22" opacity={0.95} fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">
                      {sp.arrow}
                    </text>
                    <text x={sp.col * cellSize} y={sp.row * cellSize + cellSize * 0.45} fontSize={Math.max(4, cellSize * 0.17)}
                      fill="#b49312" opacity={0.9} fontFamily="'Press Start 2P', monospace" textAnchor="middle" dominantBaseline="middle" letterSpacing="0.4">
                      {sp.label}
                    </text>
                  </g>
                ))}

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

                {Object.entries(CHAR_STARTS).map(([charId, [sc, sr]]) => (
                  <circle key={charId} cx={(sc + 0.5) * cellSize} cy={(sr + 0.5) * cellSize}
                    r={Math.max(2, cellSize * 0.12)} fill={charColors[charId] ?? '#888'} opacity={0.75} />
                ))}
              </svg>

              {/* Location images — clipped to exclude door cells */}
              {locationCardLayers.map(({ roomId, src, left, top, cardW, cardH, clipPath }) => (
                <img
                  key={`loccard-${roomId}`} src={src} draggable={false}
                  style={{
                    position: 'absolute', left, top, width: cardW, height: cardH,
                    imageRendering: 'pixelated', objectFit: 'cover',
                    opacity: 0.78, pointerEvents: 'none', userSelect: 'none', zIndex: 1, clipPath,
                  }}
                />
              ))}

              {/* Center staircase / void decoration */}
              <div
                className="pointer-events-none"
                style={{
                  position: 'absolute', left: 9 * cellSize, top: 10 * cellSize,
                  width: 5 * cellSize, height: 6 * cellSize,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  zIndex: 4, background: '#020202', border: '1px solid #1a0010',
                }}
              >
                {[0.8, 0.65, 0.5].map((w, i) => (
                  <div key={i} style={{
                    width: `${w * 5 * cellSize}px`, height: Math.max(3, cellSize * 0.22),
                    background: `#${['2a0008', '1e0006', '140004'][i]}`, marginBottom: 1, flexShrink: 0,
                  }} />
                ))}
                <div style={{ fontFamily: 'monospace', fontSize: Math.max(10, cellSize * 0.55), color: '#992233', lineHeight: 1, margin: '2px 0' }}>✕</div>
                <div className="font-pixel" style={{
                  fontSize: Math.max(4, Math.floor(cellSize * 0.17)), color: '#aa3355', letterSpacing: '0.9px',
                  textAlign: 'center', lineHeight: 1.7, textShadow: '1px 1px 0 #000',
                }}>
                  MURDER{'\n'}IN KUET
                </div>
              </div>

              {/* Board border */}
              <div style={{ position: 'absolute', inset: 0, border: '3px solid #1a1200', outline: '2px solid #0a0a00', pointerEvents: 'none', zIndex: 5 }} />

              {/* Reachable-cell path dots */}
              {highlights.cells.length > 0 && <PathDots cells={highlights.cells} cellSize={cellSize} />}

              {/* Secret passage dots — gold, clickable */}
              {highlights.passage.map(([col, row]) => {
                const dotSize = Math.max(6, Math.round(cellSize * 0.35))
                return (
                  <motion.div
                    key={`passage-${col}-${row}`}
                    onClick={() => send({ type: 'move', col, row })}
                    style={{
                      position: 'absolute', left: (col + 0.5) * cellSize - dotSize / 2, top: (row + 0.5) * cellSize - dotSize / 2,
                      width: dotSize, height: dotSize, borderRadius: '50%', background: '#ffcc00',
                      cursor: 'pointer', zIndex: 9, boxShadow: '0 0 8px #ffcc0099',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0.8, 1, 0.8], scale: 1 }}
                    transition={{ opacity: { duration: 0.6, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.12 } }}
                    title="Secret Passage"
                  />
                )
              })}

              {/* Suspect tokens — all 6 always visible, movable by whoever's turn it is */}
              {boardSuspects.map((p, i) => (
                <PlayerToken
                  key={p.id}
                  player={p}
                  cellSize={cellSize}
                  isSelected={p.id === view.selectedSuspectId}
                  playerIndex={i}
                  stackCount={stackCounts[`${p.position[0]},${p.position[1]}`] ?? 1}
                  onClick={() => handleSuspectClick(p.id)}
                />
              ))}
            </div>
          </CameraController>

          {/* Turn overlay (my turn) */}
          <AnimatePresence>
            {showTurnOverlay && me && (
              <TurnOverlay
                key={view.currentTurnIndex}
                playerName={me.name}
                playerIcon={me.icon}
                playerColor={me.color}
                playerIndex={view.myIndex}
                onAction={(id) => {
                  if (id === 'roll') { if (!view.hasMovedThisTurn && view.selectedSuspectId) setRollGestureActive(true) }
                  else if (id === 'interrogation') { if (view.hasMovedThisTurn && token?.currentLocation) setWeaponPick(true) }
                  else if (id === 'accusation') { if (!me.hasAccused && !me.eliminated) setAccuse(true) }
                  else if (id === 'endturn') { send({ type: 'endTurn' }) }
                  else if (id === 'cards') { setShowCards(true) }
                  else if (id === 'notes') { nb.setShowNotebook(true) }
                }}
                disabledActions={disabledActions as ('roll' | 'interrogation' | 'accusation' | 'endturn' | 'cards' | 'notes')[]}
                hint={turnHint}
              />
            )}
          </AnimatePresence>

          {/* Waiting-for-other-player indicator */}
          <AnimatePresence>
            {view.phase === 'turn' && !isMyTurn && (
              <motion.div
                key={`waiting-${view.currentTurnIndex}`}
                style={{
                  position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.88)',
                  border: `1px solid ${view.players[view.currentTurnIndex]?.color ?? '#888'}44`,
                  padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 30,
                }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <motion.span
                  style={{ fontFamily: 'monospace', fontSize: 14, color: view.players[view.currentTurnIndex]?.color }}
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
                >⊛</motion.span>
                <div className="font-pixel" style={{ fontSize: '6px', color: view.players[view.currentTurnIndex]?.color, letterSpacing: '1px' }}>
                  WAITING FOR {view.players[view.currentTurnIndex]?.name.toUpperCase()}…
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stacked-suspect chooser */}
          <AnimatePresence>
            {suspectPicker && (
              <motion.div
                key="suspect-picker"
                style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(2,1,4,0.86)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                onClick={() => setSuspectPicker(null)}
              >
                <motion.div
                  onClick={e => e.stopPropagation()}
                  style={{ background: '#0a0510', border: '3px solid #5c3d00', boxShadow: '6px 6px 0 #000, 0 0 30px #b8860b22', padding: '18px 20px 20px', maxWidth: '92%' }}
                  initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 10 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="font-pixel" style={{ fontSize: '8px', color: '#e8c060', letterSpacing: '2px', textAlign: 'center', marginBottom: 4 }}>
                    CHOOSE A SUSPECT
                  </div>
                  <div className="font-pixel" style={{ fontSize: '6px', color: '#7a5522', letterSpacing: '1px', textAlign: 'center', marginBottom: 14 }}>
                    {suspectPicker.length} ON THIS BLOCK
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {suspectPicker.map(s => (
                      <motion.button
                        key={s.id} className="font-pixel" onClick={() => pickStackedSuspect(s.id)}
                        style={{ width: 92, background: '#0d0800', border: `2px solid ${s.accentColor}88`, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                        whileHover={{ borderColor: s.accentColor, backgroundColor: `${s.accentColor}22`, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.08 }}
                      >
                        {s.imageSrc ? (
                          <img src={s.imageSrc} alt="" style={{ width: 54, height: 54, objectFit: 'cover', imageRendering: 'pixelated', border: `1px solid ${s.accentColor}44` }} />
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontSize: 34, color: s.accentColor, lineHeight: 1 }}>{s.icon}</span>
                        )}
                        <span style={{ fontSize: '6px', color: s.accentColor, letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.4 }}>
                          {s.name.toUpperCase()}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="font-pixel" style={{ fontSize: '5px', color: '#4a3010', letterSpacing: '1px', textAlign: 'center', marginTop: 14 }}>
                    CLICK OUTSIDE TO CANCEL
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interrogation (weapon-only) / accusation card picker */}
          <AnimatePresence>
            {weaponPick && (
              <SelectionFlow
                key="interrogation"
                mode="interrogation"
                lockedLocationCard={lockedLocationCard}
                lockedSuspectCard={lockedSuspectCard}
                onComplete={(result: SelectionFlowResult) => { setWeaponPick(false); send({ type: 'interrogate', weaponId: result.weapon }) }}
                onCancel={() => setWeaponPick(false)}
              />
            )}
            {accuse && (
              <SelectionFlow
                key="accusation"
                mode="accusation"
                onComplete={(result: SelectionFlowResult) => {
                  setAccuse(false)
                  send({ type: 'accuse', suspectId: result.suspect, weaponId: result.weapon, locationId: result.location })
                }}
                onCancel={() => setAccuse(false)}
              />
            )}
          </AnimatePresence>

          {/* Response phase (Bluff & Challenge) */}
          <AnimatePresence>
            {view.phase === 'response' && view.pendingSuggestion && (
              <ResponseOverlay key="response" view={view} onRespond={(claim) => send({ type: 'respond', claim })} />
            )}
          </AnimatePresence>

          {/* Challenge phase (Bluff & Challenge) */}
          <AnimatePresence>
            {view.phase === 'challenge' && view.pendingSuggestion && (
              <ChallengeOverlay
                key="challenge"
                view={view}
                onResolve={(challengedIndex, revealTargetIndex) => send({ type: 'challenge', challengedIndex, revealTargetIndex })}
              />
            )}
          </AnimatePresence>

          {/* Story screen */}
          <AnimatePresence>
            {showStory && view.reveal && (
              <StoryScreen
                key="story"
                story={storyText}
                suspectId={view.reveal.suspectId}
                weaponId={view.reveal.weaponId}
                locationId={view.reveal.locationId}
                onContinue={() => setStoryDismissedForTurn(view.turnCount)}
              />
            )}
          </AnimatePresence>

          {/* Reveal result overlay */}
          <AnimatePresence>
            {showReveal && view.reveal && caseFileForReveal && (
              <RevealResultOverlay
                result={view.reveal}
                caseFile={caseFileForReveal}
                onContinue={handleContinueReveal}
              />
            )}
          </AnimatePresence>

          {/* Game over popup (all eliminated) */}
          <AnimatePresence>
            {view.phase === 'game_over' && view.winnerIndex === null && fullCaseFile && (
              <GameOverPopup key="game-over" caseFile={fullCaseFile} onExit={onLeave} onRestart={onLeave} />
            )}
          </AnimatePresence>

          {/* Victory screen (correct accusation) */}
          <AnimatePresence>
            {view.phase === 'game_over' && view.winnerIndex !== null && fullCaseFile && (
              <VictoryScreen
                key="victory"
                winnerName={view.players[view.winnerIndex]?.name ?? 'PLAYER'}
                winnerIcon={view.players[view.winnerIndex]?.icon ?? '?'}
                winnerColor={view.players[view.winnerIndex]?.color ?? '#22cc66'}
                caseFile={fullCaseFile}
                onRestart={onLeave}
                onExit={onLeave}
              />
            )}
          </AnimatePresence>

          {/* Clue notebook */}
          <AnimatePresence>
            {nb.showNotebook && (
              <ClueNotebook
                key="notebook"
                data={nb.notebook}
                hand={myHandCards}
                onChange={(cat, cardId, state) => nb.updateNotebookBox(cat, cardId, state)}
                onClose={() => nb.setShowNotebook(false)}
              />
            )}
          </AnimatePresence>

          {/* Cards overlay */}
          <AnimatePresence>
            {showCards && me && (
              <CardsOverlay
                key="cards-overlay"
                hand={myHandCards}
                playerName={me.name}
                playerIcon={me.icon}
                playerColor={me.color}
                onClose={() => setShowCards(false)}
              />
            )}
          </AnimatePresence>

          {/* Hand overlay (hold-to-roll gesture) */}
          <AnimatePresence>
            {rollGestureActive && (
              <HandOverlay onRelease={() => { send({ type: 'roll' }); setRollGestureActive(false) }} />
            )}
          </AnimatePresence>

          {/* Dice */}
          {view.dice !== null && (
            <motion.div
              style={{ position: 'absolute', top: 14, left: 14, zIndex: 20 }}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15, ease: 'linear' }}
            >
              <Dice value={view.dice} rolling={diceRollingAnim} onSettled={() => setDiceRollingAnim(false)} />
              {!diceRollingAnim && (
                <div className="font-pixel" style={{ marginTop: 8, fontSize: '11px', color: '#ffdd00', letterSpacing: '1px', textAlign: 'center' }}>
                  {isMyTurn ? 'CLICK A HIGHLIGHTED CELL' : `ROLLED ${view.dice}`}
                </div>
              )}
            </motion.div>
          )}

          {/* Room entry toast */}
          <AnimatePresence>
            {roomToast && (
              <motion.div
                key={roomToast}
                style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 25, pointerEvents: 'none' }}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.14, ease: 'linear' }}
              >
                <div style={{ background: 'rgba(0,0,0,0.86)', border: '1px solid #aa660044', padding: '6px 16px', boxShadow: '0 0 20px #cc880022' }}>
                  <div className="font-pixel" style={{ fontSize: '7px', color: '#cc9933', letterSpacing: '2px' }}>
                    ENTERED {roomToast.toUpperCase()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connection-lost banner — your own socket dropped; server auto-skips your
              turn after a grace period, but nothing tells you that without this. */}
          <AnimatePresence>
            {connectionStatus === 'disconnected' && (
              <motion.div
                key="reconnecting-banner"
                style={{
                  position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 70, background: 'rgba(40,0,0,0.94)', border: '2px solid #cc2200',
                  padding: '8px 18px', boxShadow: '0 0 20px #cc220044', pointerEvents: 'none',
                }}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              >
                <motion.div
                  className="font-pixel"
                  style={{ fontSize: '8px', color: '#ff6644', letterSpacing: '2px', textAlign: 'center' }}
                  animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}
                >
                  ⚠ CONNECTION LOST — RECONNECTING…
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Server error toast (e.g. a stale/rejected action) — click to dismiss */}
          <AnimatePresence>
            {connectionError && (
              <motion.div
                key="online-error-banner"
                onClick={clearError}
                style={{
                  position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 70, background: 'rgba(40,0,0,0.94)', border: '1px solid #cc4422',
                  padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              >
                <span className="font-pixel" style={{ fontSize: '7px', color: '#ff8866', letterSpacing: '1px' }}>
                  ⚠ {connectionError.toUpperCase()}
                </span>
                <span className="font-pixel" style={{ fontSize: '6px', color: '#885544' }}>✕</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div
          className="font-pixel flex flex-col shrink-0"
          style={{ width: SIDEBAR_W, background: '#050208', borderLeft: '2px solid #150012', padding: '14px 10px 12px', overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: '11px', color: '#cc3355', letterSpacing: '2px' }}>── PLAYERS ──</div>
            <div style={{ fontSize: '8px', color: '#7a3344', letterSpacing: '1.5px', flexShrink: 0 }}>
              TURN {String(view.turnCount + 1).padStart(2, '0')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {view.players.map((p) => {
              const isTurn = p.index === view.currentTurnIndex
              const isMe   = p.index === view.myIndex
              return (
                <div key={p.index} style={{
                  background: isTurn ? 'rgba(80,0,30,0.35)' : 'transparent',
                  border: isTurn ? `1px solid ${p.color}55` : '1px solid #120010',
                  padding: '7px 8px', opacity: p.eliminated ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: '10px', color: p.color, flexShrink: 0 }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '10px', color: p.eliminated ? '#553333' : isTurn ? '#ffdd00' : '#cc9944',
                        letterSpacing: '1.2px', marginBottom: 3, textDecoration: p.eliminated ? 'line-through' : 'none',
                      }}>
                        {p.name}{isMe ? ' (YOU)' : ''}
                      </div>
                      <div style={{ fontSize: '8px', color: '#aa7733', letterSpacing: '0.5px' }}>
                        {p.handCount} cards{!p.connected ? ' · ○ OFFLINE' : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#ff4466', letterSpacing: '1px', lineHeight: 1 }}>
                          {heartsFor(p.lives)}
                        </span>
                        {p.lives === 0 && <span style={{ fontSize: '7px', color: '#886655', letterSpacing: '0.5px' }}>NO BLUFF</span>}
                      </div>
                    </div>
                    {isTurn && !p.eliminated && (
                      <motion.span style={{ fontSize: '10px', color: '#ff3344', flexShrink: 0 }}
                        animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.65, repeat: Infinity }}>●</motion.span>
                    )}
                  </div>
                  {p.eliminated && (
                    <div style={{ fontSize: '8px', color: '#ee3333', letterSpacing: '0.5px', marginTop: 4 }}>✗ ELIMINATED</div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: '9px', color: '#8a5566', letterSpacing: '1.5px', margin: '14px 0 8px' }}>── SUSPECT TOKENS ──</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {boardSuspects.map((s) => {
              const roomName = s.currentLocation ? (ROOM_DISPLAY_NAMES[s.currentLocation] ?? s.currentLocation).replace('\n', ' ') : 'HALLWAY'
              const isMoving = s.id === view.selectedSuspectId
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
                  background: isMoving ? `${s.accentColor}18` : 'transparent',
                  border: isMoving ? `1px solid ${s.accentColor}55` : '1px solid transparent',
                }}>
                  <span style={{ fontSize: '9px', color: s.accentColor, flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ fontSize: '7px', color: '#cc9944', letterSpacing: '0.4px', flex: 1, minWidth: 0 }}>{s.name}</span>
                  <span style={{ fontSize: '7px', color: s.currentLocation ? '#66aa77' : '#665544', letterSpacing: '0.3px', flexShrink: 0 }}>{roomName}</span>
                </div>
              )
            })}
          </div>

          <div style={{ height: 1, background: 'repeating-linear-gradient(90deg,#551133 0,#551133 4px,transparent 4px,transparent 8px)', margin: '14px 0' }} />

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '10px', color: '#bb3355', letterSpacing: '1px', marginBottom: 10 }}>PHASE</div>
            <div style={{ fontSize: '10px', color: '#ff9944', letterSpacing: '1px' }}>
              {view.phase === 'turn'      && (isMyTurn ? 'YOUR ACTION' : 'AWAITING TURN')}
              {view.phase === 'response'  && 'RESPONSE PHASE'}
              {view.phase === 'challenge' && 'CHALLENGE PHASE'}
              {view.phase === 'reveal'    && 'RESULT'}
              {view.phase === 'game_over' && 'GAME OVER'}
            </div>
          </div>

          <div style={{ fontSize: '10px', color: '#8a5566', letterSpacing: '0.5px', lineHeight: 2.4 }}>
            <div style={{ color: '#bb4466', marginBottom: 6 }}>── CONTROLS ──</div>
            <div>CLICK  A  SUSPECT</div>
            <div>HOLD  ENTER  TO  ROLL</div>
            <div>CLICK  A  HIGHLIGHTED  CELL</div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ borderTop: '1px solid #331120', paddingTop: 12, fontSize: '9px', color: '#7a4422', letterSpacing: '0.5px', lineHeight: 2.2 }}>
            <div>FIND THE KILLER</div>
            <div>SOLVE THE CASE</div>
          </div>
        </div>
      </div>
    </div>
  )
}
