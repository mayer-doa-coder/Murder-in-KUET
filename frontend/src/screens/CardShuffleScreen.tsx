import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameCard from '../components/GameCard'
import type { Card, PlayerSetup, GameDeal } from '../types'
import {
  SUSPECTS_CARDS,
  WEAPONS_CARDS,
  LOCATIONS_CARDS,
  ALL_CARDS,
  shuffleDeck,
} from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────
type ShufflePhase =
  | 'show_all'
  | 'selecting'
  | 'case_file_show'
  | 'case_file_flip'
  | 'merge_deck'
  | 'await_shuffle'
  | 'shuffling'
  | 'dealing'
  | 'deal_complete'

interface CrimeFile {
  suspect: Card
  weapon: Card
  location: Card
}

interface CardShuffleScreenProps {
  players: PlayerSetup[]
  playerCount: number
  onComplete: (deal: GameDeal) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CW  = 78    // card width  px
const CH  = 107   // card height px
const CG  = 8     // gap between cards
const CS  = CH + CG
const HDR = 50
const GROUP_TOP = HDR + 48

const GROUP_CX = [0.19, 0.50, 0.81]

const CF_GAP = 20

const TOTAL_DEAL_CARDS = 18

// ── Position helpers ──────────────────────────────────────────────────────────
function groupCardPos(category: string, cardIdx: number, vw: number) {
  const gx = vw * GROUP_CX[category === 'suspect' ? 0 : category === 'weapon' ? 1 : 2]

  if (category !== 'location') {
    const col = cardIdx % 2
    const row = Math.floor(cardIdx / 2)
    const totalW = 2 * CW + CG
    return { x: gx - totalW / 2 + col * (CW + CG), y: GROUP_TOP + row * CS }
  } else {
    const col = cardIdx % 3
    const row = Math.floor(cardIdx / 3)
    const totalW = 3 * CW + 2 * CG
    return { x: gx - totalW / 2 + col * (CW + CG), y: GROUP_TOP + row * CS }
  }
}

function caseFilePos(slot: number, vw: number, vh: number) {
  const totalW = 3 * CW + 2 * CF_GAP
  const startX = vw / 2 - totalW / 2
  return { x: startX + slot * (CW + CF_GAP), y: vh / 2 - CH / 2 - 30 }
}

function deckPos(vw: number, vh: number) {
  return { x: vw / 2 - CW / 2, y: vh / 2 - CH / 2 }
}

// Spread N players evenly across the screen width with margins
function playerPos(playerIdx: number, count: number, vw: number, vh: number) {
  const margin = 0.08
  const cx = count === 1
    ? 0.5
    : margin + playerIdx * (1 - 2 * margin) / (count - 1)
  return { x: vw * cx - CW / 2, y: vh * 0.72 - CH / 2 }
}

// ── Column header label ───────────────────────────────────────────────────────
function GroupHeader({ label, x, color }: { label: string; x: number; color: string }) {
  return (
    <div
      className="font-pixel"
      style={{
        position: 'absolute',
        top: HDR + 18,
        left: x,
        transform: 'translateX(-50%)',
        fontSize: '7px',
        color,
        letterSpacing: '2px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
}

// ── Dagger selector ───────────────────────────────────────────────────────────
function DaggerSelector({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <motion.div
      className="font-pixel"
      style={{
        position: 'absolute',
        fontSize: '11px',
        color,
        pointerEvents: 'none',
        zIndex: 100,
        textShadow: `0 0 8px ${color}`,
      }}
      animate={{ x: x - 20, y: y + CH / 2 - 9 }}
      transition={{ duration: 0.15, ease: 'easeInOut' }}
    >
      ▶
    </motion.div>
  )
}

// ── Phase label overlay ───────────────────────────────────────────────────────
function PhaseLabel({ text, sub }: { text: string; sub?: string }) {
  return (
    <motion.div
      className="absolute left-0 right-0 text-center"
      style={{ top: '14px', zIndex: 200 }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
    >
      <div className="font-pixel" style={{ fontSize: 'clamp(9px,1.4vw,13px)', color: '#e8c060', letterSpacing: '4px', textShadow: '2px 2px 0 #3d2200' }}>
        {text}
      </div>
      {sub && (
        <motion.div
          className="font-pixel"
          style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '2px', marginTop: '4px' }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          {sub}
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Press button ──────────────────────────────────────────────────────────────
function PressButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="font-pixel"
      style={{
        background: '#3d2200',
        border: '3px solid #7a4c00',
        color: '#e8c060',
        padding: '10px 24px',
        fontSize: '9px',
        letterSpacing: '2px',
        cursor: 'pointer',
        boxShadow: '4px 4px 0 #1a0f00',
      }}
      animate={{ boxShadow: ['4px 4px 0 #1a0f00, 0 0 8px #b8860b44', '4px 4px 0 #1a0f00, 0 0 18px #b8860b99', '4px 4px 0 #1a0f00, 0 0 8px #b8860b44'] }}
      transition={{ duration: 1.4, repeat: Infinity }}
      whileHover={{ y: -2 }}
      whileTap={{ y: 4 }}
    >
      {label}
    </motion.button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CardShuffleScreen({ players, playerCount, onComplete }: CardShuffleScreenProps) {
  const [vw, setVw] = useState(window.innerWidth)
  const [vh, setVh] = useState(window.innerHeight)
  const [phase, setPhase] = useState<ShufflePhase>('show_all')

  const [dagSuspect,  setDagSuspect]  = useState(-1)
  const [dagWeapon,   setDagWeapon]   = useState(-1)
  const [dagLocation, setDagLocation] = useState(-1)

  const [suspectHighlit,  setSuspectHighlit]  = useState(false)
  const [weaponHighlit,   setWeaponHighlit]   = useState(false)
  const [locationHighlit, setLocationHighlit] = useState(false)

  const [caseFlipped,  setCaseFlipped]  = useState(false)
  const [deckShaking,  setDeckShaking]  = useState(false)
  const [dealStep,     setDealStep]     = useState(0)
  const dealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Pre-compute crime file and deck ───────────────────────────────────────
  const crimeFile = useMemo<CrimeFile>(() => ({
    suspect:  SUSPECTS_CARDS [Math.floor(Math.random() * SUSPECTS_CARDS.length)],
    weapon:   WEAPONS_CARDS  [Math.floor(Math.random() * WEAPONS_CARDS.length)],
    location: LOCATIONS_CARDS[Math.floor(Math.random() * LOCATIONS_CARDS.length)],
  }), [])

  const deck = useMemo<Card[]>(() => {
    const crimeIds = new Set([crimeFile.suspect.id, crimeFile.weapon.id, crimeFile.location.id])
    return shuffleDeck(ALL_CARDS.filter(c => !crimeIds.has(c.id)))
  }, [crimeFile])

  // Round-robin distribution across playerCount players
  const playerHands = useMemo<Card[][]>(() => {
    const hands: Card[][] = Array.from({ length: playerCount }, () => [])
    deck.forEach((card, i) => hands[i % playerCount].push(card))
    return hands
  }, [deck, playerCount])

  const crimeIdx = useMemo(() => ({
    suspect:  SUSPECTS_CARDS .findIndex(c => c.id === crimeFile.suspect.id),
    weapon:   WEAPONS_CARDS  .findIndex(c => c.id === crimeFile.weapon.id),
    location: LOCATIONS_CARDS.findIndex(c => c.id === crimeFile.location.id),
  }), [crimeFile])

  // ── Phase machine ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'show_all') return
    const t = setTimeout(() => setPhase('selecting'), 1600)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'selecting') return
    setDagSuspect(0)
    setDagWeapon(-1)
    setDagLocation(-1)
    setSuspectHighlit(false)
    setWeaponHighlit(false)
    setLocationHighlit(false)
  }, [phase])

  useEffect(() => {
    if (phase !== 'selecting' || dagSuspect < 0) return
    if (dagSuspect >= crimeIdx.suspect) { setSuspectHighlit(true); return }
    const t = setTimeout(() => setDagSuspect(s => s + 1), 130)
    return () => clearTimeout(t)
  }, [phase, dagSuspect, crimeIdx.suspect])

  useEffect(() => {
    if (!suspectHighlit || phase !== 'selecting') return
    const t = setTimeout(() => setDagWeapon(0), 400)
    return () => clearTimeout(t)
  }, [suspectHighlit, phase])

  useEffect(() => {
    if (phase !== 'selecting' || dagWeapon < 0) return
    if (dagWeapon >= crimeIdx.weapon) { setWeaponHighlit(true); return }
    const t = setTimeout(() => setDagWeapon(s => s + 1), 130)
    return () => clearTimeout(t)
  }, [phase, dagWeapon, crimeIdx.weapon])

  useEffect(() => {
    if (!weaponHighlit || phase !== 'selecting') return
    const t = setTimeout(() => setDagLocation(0), 400)
    return () => clearTimeout(t)
  }, [weaponHighlit, phase])

  useEffect(() => {
    if (phase !== 'selecting' || dagLocation < 0) return
    if (dagLocation >= crimeIdx.location) { setLocationHighlit(true); return }
    const t = setTimeout(() => setDagLocation(s => s + 1), 130)
    return () => clearTimeout(t)
  }, [phase, dagLocation, crimeIdx.location])

  useEffect(() => {
    if (!suspectHighlit || !weaponHighlit || !locationHighlit) return
    const t = setTimeout(() => setPhase('case_file_show'), 600)
    return () => clearTimeout(t)
  }, [suspectHighlit, weaponHighlit, locationHighlit])

  useEffect(() => {
    if (phase !== 'case_file_show') return
    const t = setTimeout(() => { setPhase('case_file_flip'); setCaseFlipped(true) }, 900)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'case_file_flip') return
    const t = setTimeout(() => setPhase('merge_deck'), 700)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'merge_deck') return
    const t = setTimeout(() => setPhase('await_shuffle'), 1000)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'dealing') return
    setDealStep(0)
    dealIntervalRef.current = setInterval(() => {
      setDealStep(prev => {
        if (prev >= TOTAL_DEAL_CARDS) {
          clearInterval(dealIntervalRef.current!)
          setPhase('deal_complete')
          return prev
        }
        return prev + 1
      })
    }, 220)
    return () => { if (dealIntervalRef.current) clearInterval(dealIntervalRef.current) }
  }, [phase])

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  const handleAwaitShuffle = useCallback(() => {
    if (phase !== 'await_shuffle') return
    setPhase('shuffling')
    setDeckShaking(true)
    setTimeout(() => {
      setDeckShaking(false)
      setTimeout(() => setPhase('dealing'), 400)
    }, 1400)
  }, [phase])

  const handleDealComplete = useCallback(() => {
    if (phase !== 'deal_complete') return
    onComplete({ caseFile: crimeFile, playerHands })
  }, [phase, crimeFile, playerHands, onComplete])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleAwaitShuffle()
        handleDealComplete()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleAwaitShuffle, handleDealComplete])

  // ── Per-card positions for column scene ───────────────────────────────────
  const inColumnScene = ['show_all','selecting','case_file_show','case_file_flip','merge_deck'].includes(phase)

  const columnCardData = useMemo(() => {
    return ALL_CARDS.map(card => {
      const colCards = card.category === 'suspect' ? SUSPECTS_CARDS
                     : card.category === 'weapon'  ? WEAPONS_CARDS
                     : LOCATIONS_CARDS
      const cardIdx = colCards.findIndex(c => c.id === card.id)
      const base    = groupCardPos(card.category, cardIdx, vw)

      const isCrimeCard =
        card.id === crimeFile.suspect.id  ||
        card.id === crimeFile.weapon.id   ||
        card.id === crimeFile.location.id

      const crimeSlot = card.id === crimeFile.suspect.id  ? 0
                      : card.id === crimeFile.weapon.id   ? 1
                      : card.id === crimeFile.location.id ? 2 : -1

      const isHighlit =
        (card.id === crimeFile.suspect.id  && suspectHighlit)  ||
        (card.id === crimeFile.weapon.id   && weaponHighlit)   ||
        (card.id === crimeFile.location.id && locationHighlit)

      let x = base.x, y = base.y
      let faceUp  = true
      let opacity = 1
      let zIndex  = 10 + cardIdx
      let selected = isHighlit

      if (phase === 'case_file_show' || phase === 'case_file_flip') {
        if (isCrimeCard) {
          const cf = caseFilePos(crimeSlot, vw, vh)
          x = cf.x; y = cf.y; zIndex = 30; selected = true
          faceUp = phase === 'case_file_show' ? true : !caseFlipped
        } else {
          opacity = 0.18
        }
      }

      if (phase === 'merge_deck') {
        if (isCrimeCard) {
          const cf = caseFilePos(crimeSlot, vw, vh)
          x = cf.x; y = cf.y; zIndex = 30; faceUp = false; selected = false
        } else {
          const d = deckPos(vw, vh)
          x = d.x + (cardIdx % 3) - 1
          y = d.y + (cardIdx % 3) - 1
          faceUp = false; zIndex = 5
        }
      }

      return { card, x, y, faceUp, opacity, zIndex, selected, cardIdx, isCrimeCard, crimeSlot }
    })
  }, [phase, crimeFile, suspectHighlit, weaponHighlit, locationHighlit, caseFlipped, vw, vh])  // eslint-disable-line

  const colSceneTitle = phase === 'show_all' || phase === 'selecting' ? 'SELECTING THE CRIME'
    : phase === 'case_file_show' ? 'CASE FILE'
    : phase === 'case_file_flip' ? 'EVIDENCE SEALED'
    : 'FORMING DECK...'

  const dk = () => deckPos(vw, vh)
  const pp = (pi: number) => playerPos(pi, playerCount, vw, vh)

  // Cards received by player pi after dealStep total cards dealt (round-robin)
  const cardsDealtTo = (pi: number, step: number): number => {
    const full = Math.floor(step / playerCount)
    const rem  = step % playerCount
    return Math.min(full + (pi < rem ? 1 : 0), playerHands[pi]?.length ?? 0)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#060400' }}>
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(60,40,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(60,40,0,0.06) 1px,transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <AnimatePresence mode="wait">

        {/* ══ COLUMN SCENE ══════════════════════════════════════════════════ */}
        {inColumnScene && (
          <motion.div
            key="column-scene"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Title */}
            <div className="absolute left-0 right-0 text-center" style={{ top: '12px', zIndex: 200 }}>
              <motion.div
                className="font-pixel"
                style={{ fontSize: 'clamp(9px,1.5vw,13px)', color: '#e8c060', letterSpacing: '4px', textShadow: '2px 2px 0 #3d2200' }}
                animate={{ opacity: [0.8,1,0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {colSceneTitle}
              </motion.div>
            </div>

            {/* Group headers */}
            <GroupHeader label="SUSPECTS"  x={vw * GROUP_CX[0]} color="#ff6633" />
            <GroupHeader label="WEAPONS"   x={vw * GROUP_CX[1]} color="#cccccc" />
            <GroupHeader label="LOCATIONS" x={vw * GROUP_CX[2]} color="#44cccc" />

            {/* All 21 cards */}
            {columnCardData.map(({ card, x, y, faceUp, opacity, zIndex, selected }) => (
              <motion.div
                key={card.id}
                style={{ position: 'absolute', zIndex }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ x, y, opacity, scale: selected ? 1.06 : 1 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
              >
                <GameCard card={card} faceUp={faceUp} selected={selected} dimmed={opacity < 0.5 && !selected} width={CW} height={CH} />
              </motion.div>
            ))}

            {/* Dagger selectors */}
            {phase === 'selecting' && dagSuspect >= 0 && !suspectHighlit && (() => {
              const p = groupCardPos('suspect', dagSuspect, vw)
              return <DaggerSelector x={p.x} y={p.y} color="#ff6633" />
            })()}
            {phase === 'selecting' && dagWeapon >= 0 && !weaponHighlit && (() => {
              const p = groupCardPos('weapon', dagWeapon, vw)
              return <DaggerSelector x={p.x} y={p.y} color="#cccccc" />
            })()}
            {phase === 'selecting' && dagLocation >= 0 && !locationHighlit && (() => {
              const p = groupCardPos('location', dagLocation, vw)
              return <DaggerSelector x={p.x} y={p.y} color="#44cccc" />
            })()}

            {/* CASE FILE label */}
            {(phase === 'case_file_show' || phase === 'case_file_flip' || phase === 'merge_deck') && (
              <motion.div
                className="font-pixel"
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: vh / 2 - CH / 2 - 24,
                  fontSize: '7px',
                  color: '#b8860b',
                  letterSpacing: '3px',
                  zIndex: 200,
                  whiteSpace: 'nowrap',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                ─ CASE FILE ─
              </motion.div>
            )}

            {/* Deck label during merge */}
            {phase === 'merge_deck' && (
              <motion.div
                className="font-pixel"
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: vh / 2 + CH / 2 + 16,
                  fontSize: '6px',
                  color: '#5c3d00',
                  letterSpacing: '2px',
                  zIndex: 200,
                  whiteSpace: 'nowrap',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                REMAINING CARDS → DECK
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ══ SHUFFLE SCENE ═════════════════════════════════════════════════ */}
        {(phase === 'await_shuffle' || phase === 'shuffling') && (
          <motion.div
            key="shuffle-scene"
            className="absolute inset-0 flex flex-col items-center justify-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <PhaseLabel text="DECK READY" />

            {/* Case file corner display */}
            <div className="absolute" style={{ top: '10px', left: '14px' }}>
              <div className="font-pixel" style={{ fontSize: '5px', color: '#5c3d00', letterSpacing: '2px', marginBottom: '4px' }}>
                CASE FILE
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[crimeFile.suspect, crimeFile.weapon, crimeFile.location].map(c => (
                  <GameCard key={c.id} card={c} faceUp={false} width={36} height={50} compact />
                ))}
              </div>
            </div>

            {/* Deck pile */}
            <motion.div
              className="relative"
              style={{ width: CW + 8, height: CH + 8 }}
              animate={deckShaking
                ? { x: [-4,4,-3,3,-2,2,0], rotate: [-2,2,-1,1,0], filter: ['blur(0px)','blur(2px)','blur(0px)','blur(3px)','blur(0px)'] }
                : {}
              }
              transition={{ duration: 0.2, repeat: deckShaking ? 6 : 0 }}
            >
              {[4,3,2,1,0].map(offset => (
                <div key={offset} style={{ position: 'absolute', top: offset, left: offset, opacity: 1 - offset * 0.12 }}>
                  <GameCard card={deck[offset] ?? deck[0]} faceUp={false} width={CW} height={CH} />
                </div>
              ))}
            </motion.div>

            <div className="font-pixel" style={{ fontSize: '8px', color: '#5c3d00', letterSpacing: '2px' }}>
              {TOTAL_DEAL_CARDS} CARDS · {playerCount} PLAYERS
            </div>

            {phase === 'await_shuffle' && (
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <PressButton label="► SHUFFLE DECK" onClick={handleAwaitShuffle} />
                <div className="font-pixel" style={{ fontSize: '6px', color: '#2e1e00', letterSpacing: '1px' }}>
                  PRESS ENTER TO SHUFFLE
                </div>
              </motion.div>
            )}

            {phase === 'shuffling' && (
              <motion.div
                className="font-pixel"
                style={{ fontSize: '10px', color: '#b8860b', letterSpacing: '4px' }}
                animate={{ opacity: [1,0.3,1], color: ['#b8860b','#ff8800','#b8860b'] }}
                transition={{ duration: 0.3, repeat: 5 }}
              >
                SHUFFLING...
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ══ DEAL SCENE ════════════════════════════════════════════════════ */}
        {(phase === 'dealing' || phase === 'deal_complete') && (
          <motion.div
            key="deal-scene"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <PhaseLabel text="DEALING CARDS" />

            {/* Case file corner */}
            <div className="absolute" style={{ top: '10px', left: '14px' }}>
              <div className="font-pixel" style={{ fontSize: '5px', color: '#5c3d00', letterSpacing: '2px', marginBottom: '4px' }}>
                CASE FILE
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[crimeFile.suspect, crimeFile.weapon, crimeFile.location].map(c => (
                  <GameCard key={c.id} card={c} faceUp={false} width={36} height={50} compact />
                ))}
              </div>
            </div>

            {/* Deck pile at center */}
            <motion.div
              style={{ position: 'absolute', ...dk() }}
              animate={{ opacity: dealStep >= TOTAL_DEAL_CARDS ? 0 : 1 - (dealStep / TOTAL_DEAL_CARDS) * 0.6 }}
            >
              {[2,1,0].map(o => (
                <div key={o} style={{ position: 'absolute', top: o, left: o }}>
                  <GameCard card={deck[0]} faceUp={false} width={CW} height={CH} />
                </div>
              ))}
            </motion.div>

            {/* Dynamic player labels */}
            {Array.from({ length: playerCount }, (_, pi) => {
              const p = pp(pi)
              const name = players[pi]?.character.name ?? `P${pi + 1}`
              return (
                <div key={pi}>
                  <div className="font-pixel" style={{
                    position: 'absolute',
                    left: p.x + CW / 2,
                    top: p.y - 24,
                    transform: 'translateX(-50%)',
                    fontSize: playerCount <= 4 ? '6px' : '5px',
                    color: '#b8860b',
                    letterSpacing: '1px',
                    whiteSpace: 'nowrap',
                  }}>
                    P{pi + 1}
                  </div>
                  <div className="font-pixel" style={{
                    position: 'absolute',
                    left: p.x + CW / 2,
                    top: p.y - 13,
                    transform: 'translateX(-50%)',
                    fontSize: '5px',
                    color: '#5c3d00',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                  }}>
                    {name.slice(0, playerCount <= 4 ? 12 : 8)}
                  </div>
                </div>
              )
            })}

            {/* Dealt card stacks per player */}
            {Array.from({ length: playerCount }, (_, pi) => {
              const count = cardsDealtTo(pi, dealStep)
              const p = pp(pi)
              return Array.from({ length: count }).map((_, slot) => (
                <motion.div
                  key={`dealt-${pi}-${slot}`}
                  style={{ position: 'absolute', x: p.x + slot * 2, y: p.y - slot * 2, zIndex: slot + 1 }}
                  initial={{ x: dk().x, y: dk().y, opacity: 0 }}
                  animate={{ x: p.x + slot * 2, y: p.y - slot * 2, opacity: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <GameCard card={playerHands[pi][slot]} faceUp={false} width={CW} height={CH} />
                </motion.div>
              ))
            })}

            {/* Flying card during deal */}
            {dealStep < TOTAL_DEAL_CARDS && (
              <motion.div
                key={`fly-${dealStep}`}
                style={{ position: 'absolute', zIndex: 50 }}
                initial={{ x: dk().x, y: dk().y, scale: 1.1, opacity: 1 }}
                animate={{ x: pp(dealStep % playerCount).x, y: pp(dealStep % playerCount).y, scale: 1, opacity: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <GameCard card={deck[dealStep]} faceUp={false} width={CW} height={CH} />
              </motion.div>
            )}

            {/* Completion message */}
            {phase === 'deal_complete' && (
              <motion.div
                className="absolute left-0 right-0 bottom-10 flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <div className="font-pixel" style={{ fontSize: 'clamp(7px,1.2vw,10px)', color: '#e8c060', letterSpacing: '3px', textShadow: '2px 2px 0 #3d2200' }}>
                  DEALING COMPLETE
                </div>
                <PressButton label="► SEE THE CARDS" onClick={handleDealComplete} />
                <div className="font-pixel" style={{ fontSize: '6px', color: '#2e1e00', letterSpacing: '1px' }}>
                  PRESS ENTER TO CONTINUE
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
