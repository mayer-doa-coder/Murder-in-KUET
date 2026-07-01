import { useState, useEffect, useCallback } from 'react'
import type { ReactElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PixelButton from '../components/PixelButton'
import GameCard from '../components/GameCard'
import CharacterCard from '../components/CharacterCard'
import Dice from '../components/Dice'
import { CHARACTERS, SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS } from '../types'

interface Props {
  onDone: () => void
}

// ── Single unified theme colour — used for every border on this screen ──────
const GOLD = '#b8860b'
const GOLD_BRIGHT = '#ffdd44'

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// ── Scene 1 — pick your detective ────────────────────────────────────────────
function PickDetectiveScene() {
  const roster = CHARACTERS.slice(0, 4)
  const [active, setActive] = useState(0)
  const [confirmed, setConfirmed] = useState(-1)

  useEffect(() => {
    let cancelled = false
    async function loop() {
      let i = 0
      while (!cancelled) {
        setActive(i)
        setConfirmed(-1)
        await wait(750)
        if (cancelled) return
        setConfirmed(i)
        await wait(650)
        i = (i + 1) % roster.length
      }
    }
    loop()
    return () => { cancelled = true }
  }, [roster.length])

  return (
    <div className="flex items-center justify-center gap-4" style={{ height: '100%' }}>
      {roster.map((c, i) => (
        <div key={c.id} className="relative" style={{ width: 82, height: 106 }}>
          <CharacterCard
            character={c}
            cardState={confirmed === i ? 'active' : active === i ? 'highlighted' : 'normal'}
          />
          {active === i && confirmed !== i && (
            <motion.div
              className="absolute font-pixel"
              style={{ top: -18, left: '50%', fontSize: 14, color: GOLD_BRIGHT }}
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              ▼
            </motion.div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Scene 2 — roll the dice & move ───────────────────────────────────────────
function RollMoveScene() {
  const CELLS = 7 // start box + 6 steps, so a roll of 6 lands exactly on the 7th (room) box
  const [value, setValue] = useState(3)
  const [rolling, setRolling] = useState(false)
  const [tokenCell, setTokenCell] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loop() {
      while (!cancelled) {
        await wait(500)
        if (cancelled) return
        const v = 1 + Math.floor(Math.random() * 6) // full 1–6 die range
        setValue(v)
        setRolling(true)
        await wait(560)
        if (cancelled) return
        setRolling(false)
        for (let s = 1; s <= v; s++) {
          await wait(240)
          if (cancelled) return
          setTokenCell(c => Math.min(c + 1, CELLS - 1))
        }
        await wait(800)
        if (cancelled) return
        setTokenCell(0)
      }
    }
    loop()
    return () => { cancelled = true }
  }, [])

  const cellSize = 38

  return (
    <div className="flex flex-col items-center justify-center gap-6" style={{ height: '100%' }}>
      <Dice value={value} rolling={rolling} />
      <div
        className="relative"
        style={{ width: cellSize * CELLS, height: cellSize, background: '#0a0700' }}
      >
        {Array.from({ length: CELLS }, (_, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center"
            style={{
              left: i * cellSize, top: 0, width: cellSize, height: cellSize,
              border: `1px solid ${GOLD}55`,
              background: i === CELLS - 1 ? `${GOLD}22` : 'transparent',
            }}
          >
            {i === CELLS - 1 && (
              <span style={{ fontFamily: 'monospace', fontSize: 15, color: GOLD_BRIGHT }}>⌂</span>
            )}
          </div>
        ))}
        <motion.div
          className="absolute flex items-center justify-center font-pixel"
          style={{ top: 4, width: cellSize - 8, height: cellSize - 8, background: GOLD_BRIGHT, color: '#1a1400', fontSize: 12 }}
          animate={{ x: tokenCell * cellSize + 4 }}
          transition={{ type: 'tween', duration: 0.22, ease: 'linear' }}
        >
          ♦
        </motion.div>
      </div>
      <span className="font-pixel" style={{ fontSize: 6, color: '#bb9955', letterSpacing: 1 }}>
        HALLWAY  →  ⌂ ROOM
      </span>
    </div>
  )
}

// ── Scene 3 — make a suggestion ──────────────────────────────────────────────
function SuggestionScene() {
  const trio = [SUSPECTS_CARDS[0], WEAPONS_CARDS[0], LOCATIONS_CARDS[0]]
  const labels = ['SUSPECT', 'WEAPON', 'ROOM']
  const [active, setActive] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loop() {
      let i = 0
      while (!cancelled) {
        setActive(i)
        await wait(750)
        i = (i + 1) % trio.length
      }
    }
    loop()
    return () => { cancelled = true }
  }, [trio.length])

  return (
    <div className="flex items-center justify-center gap-7" style={{ height: '100%' }}>
      {trio.map((card, i) => (
        <div key={card.id} className="flex flex-col items-center gap-2">
          <span
            className="font-pixel"
            style={{ fontSize: 7, letterSpacing: 1, color: active === i ? GOLD_BRIGHT : '#665533' }}
          >
            {labels[i]}
          </span>
          <GameCard card={card} faceUp width={70} height={94} selected={active === i} />
        </div>
      ))}
    </div>
  )
}

// ── Scene 4 — interrogate & deduce ───────────────────────────────────────────
const PHASE_CAPTIONS = [
  'YOUR TURN: MAKE A SUGGESTION',
  'YOU ASK — DOES ANYONE HOLD THESE CARDS?',
  'AN OPPONENT HAS A MATCH...',
  'SHOWN ONLY TO YOU — MARK YOUR NOTEBOOK!',
]

function InterrogateScene() {
  const suspectCard = SUSPECTS_CARDS[1]
  const [phase, setPhase] = useState(0) // 0 idle, 1 asking, 2 opponent has match, 3 shown privately + marked

  useEffect(() => {
    let cancelled = false
    async function loop() {
      while (!cancelled) {
        setPhase(0)
        await wait(1700)
        if (cancelled) return
        setPhase(1)
        await wait(1900)
        if (cancelled) return
        setPhase(2)
        await wait(2100)
        if (cancelled) return
        setPhase(3)
        await wait(3000)
      }
    }
    loop()
    return () => { cancelled = true }
  }, [])

  const cardVisible = phase >= 2
  const cardNearOpponent = phase === 2

  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height: '100%' }}>
      {/* Dynamic step caption — spells out exactly what's happening right now */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          className="font-pixel text-center"
          style={{ fontSize: 7, letterSpacing: 0.5, color: GOLD_BRIGHT, minHeight: 10 }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
        >
          {PHASE_CAPTIONS[phase]}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-center" style={{ width: '100%' }}>
        {/* You */}
        <div className="flex flex-col items-center gap-2" style={{ width: 84 }}>
          <div
            className="flex items-center justify-center font-pixel"
            style={{ width: 50, height: 50, background: '#1a1400', border: `2px solid ${GOLD}`, color: GOLD_BRIGHT, fontSize: 22 }}
          >
            ☺
          </div>
          <span className="font-pixel" style={{ fontSize: 6, color: '#bb9955' }}>YOU</span>
          {/* your notebook — you mark it, not the opponent */}
          <motion.div
            className="flex items-center justify-center font-pixel"
            style={{
              width: 24, height: 24,
              background: phase === 3 ? '#04180c' : '#0a0805',
              border: `2px solid ${phase === 3 ? '#44ee88' : `${GOLD}55`}`,
              color: phase === 3 ? '#44ee88' : `${GOLD}55`,
              fontSize: 14,
            }}
            animate={phase === 3 ? { scale: [0.5, 1.25, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {phase === 3 ? '✓' : '□'}
          </motion.div>
        </div>

        {/* Middle — the card travels from the opponent's side to yours */}
        <div className="relative" style={{ width: 130, height: 96 }}>
          {phase === 1 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center font-pixel"
              style={{ color: GOLD_BRIGHT, fontSize: 11 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              ◄─ ??? ─►
            </motion.div>
          )}
          <AnimatePresence>
            {cardVisible && (
              <motion.div
                className="absolute"
                style={{ top: 10 }}
                initial={{ opacity: 0, x: 90, scale: 0.6 }}
                animate={{ opacity: 1, x: cardNearOpponent ? 90 : 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{
                  opacity: { duration: 0.5 },
                  scale: { duration: 0.5 },
                  x: { duration: cardNearOpponent ? 0.5 : 1.3, ease: 'easeInOut' },
                }}
              >
                <GameCard card={suspectCard} faceUp width={56} height={74} selected={phase === 3} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Opponent */}
        <div className="flex flex-col items-center gap-2" style={{ width: 84 }}>
          <div
            className="flex items-center justify-center font-pixel"
            style={{ width: 50, height: 50, background: '#141414', border: `2px solid ${GOLD}66`, color: '#998855', fontSize: 22 }}
          >
            ☻
          </div>
          <span className="font-pixel" style={{ fontSize: 6, color: '#bb9955' }}>OPPONENT</span>
        </div>
      </div>
    </div>
  )
}

// ── Scene 5 — accuse & win ───────────────────────────────────────────────────
function AccuseScene() {
  const trio = [SUSPECTS_CARDS[2], WEAPONS_CARDS[2], LOCATIONS_CARDS[2]]
  return (
    <div className="flex flex-col items-center justify-center gap-5" style={{ height: '100%' }}>
      <div className="flex items-center justify-center gap-5">
        {trio.map(card => (
          <GameCard key={card.id} card={card} faceUp width={70} height={94} selected />
        ))}
      </div>
      <motion.div
        className="font-pixel"
        style={{ fontSize: 12, color: GOLD_BRIGHT, letterSpacing: 2, textShadow: `0 0 12px ${GOLD_BRIGHT}88` }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.06, 1] }}
        transition={{ duration: 1.1, repeat: Infinity }}
      >
        ✓ CASE SOLVED
      </motion.div>
    </div>
  )
}

// ── Step registry ─────────────────────────────────────────────────────────────
const STEPS: { id: string; label: string; caption: string; Scene: () => ReactElement }[] = [
  {
    id: 'pick',
    label: 'PICK YOUR DETECTIVE',
    caption: 'CHOOSE YOUR DETECTIVE. EVERYONE GETS DEALT A SECRET HAND OF CLUE CARDS.',
    Scene: PickDetectiveScene,
  },
  {
    id: 'move',
    label: 'ROLL & MOVE',
    caption: 'ON YOUR TURN, ROLL THE DICE AND MOVE YOUR TOKEN THROUGH THE HALLS TOWARD A ROOM.',
    Scene: RollMoveScene,
  },
  {
    id: 'suggest',
    label: 'MAKE A SUGGESTION',
    caption: 'INSIDE A ROOM, NAME A SUSPECT, A WEAPON, AND THIS ROOM AS THE CRIME SCENE.',
    Scene: SuggestionScene,
  },
  {
    id: 'interrogate',
    label: 'INTERROGATE & DEDUCE',
    caption: 'IF AN OPPONENT HOLDS ONE OF THOSE CARDS, THEY MUST SECRETLY SHOW YOU ONE. MARK YOUR NOTEBOOK!',
    Scene: InterrogateScene,
  },
  {
    id: 'accuse',
    label: 'ACCUSE & WIN',
    caption: "WHEN YOU'RE SURE, MAKE YOUR FINAL ACCUSATION. GET ALL THREE RIGHT AND YOU WIN THE CASE!",
    Scene: AccuseScene,
  },
]

export default function QuickPlayScreen({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [prevStep, setPrevStep] = useState(0)
  const total = STEPS.length

  const goTo = useCallback((i: number) => {
    setPrevStep(step)
    setStep(Math.max(0, Math.min(total - 1, i)))
  }, [step, total])

  const next = useCallback(() => {
    if (step >= total - 1) onDone()
    else goTo(step + 1)
  }, [step, total, onDone, goTo])

  const prev = useCallback(() => goTo(step - 1), [step, goTo])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, onDone])

  const s = STEPS[step]
  const slideDir = step >= prevStep ? 1 : -1
  const isLast = step === total - 1

  return (
    <div
      className="relative w-full h-full flex flex-col items-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #120800 0%, #060400 60%, #000000 100%)' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(92,60,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(92,60,0,0.06) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)' }}
      />

      {/* Header */}
      <motion.div
        className="relative z-10 text-center"
        style={{ paddingTop: 22, paddingBottom: 10 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="font-pixel" style={{ fontSize: '9px', color: '#5c3d00', letterSpacing: '4px', marginBottom: 10 }}>
          ─── QUICK PLAY ───
        </div>
        <div
          className="font-pixel"
          style={{
            fontSize: 'clamp(14px, 2.4vw, 20px)',
            color: GOLD_BRIGHT,
            letterSpacing: '3px',
            textShadow: `3px 3px 0 #000, 0 0 18px ${GOLD}66`,
          }}
        >
          {s.label}
        </div>
        <div className="font-pixel" style={{ fontSize: '7px', color: '#665544', letterSpacing: '1px', marginTop: 8 }}>
          STEP {step + 1} / {total}
        </div>
      </motion.div>

      {/* Comic panel */}
      <div className="relative z-10 flex flex-col items-center" style={{ width: '100%', maxWidth: 600, padding: '0 20px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={s.id}
            style={{
              width: '100%',
              height: 250,
              background: 'rgba(14,9,0,0.9)',
              border: `3px solid ${GOLD}`,
              boxShadow: `6px 6px 0 #000, 0 0 24px ${GOLD}33`,
              position: 'relative',
              overflow: 'hidden',
            }}
            initial={{ opacity: 0, x: slideDir * 60, rotate: slideDir * 2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: slideDir * -60, rotate: slideDir * -2 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* corner accents — comic panel feel */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, background: GOLD, opacity: 0.7 }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: GOLD, opacity: 0.7 }} />
            <s.Scene />
          </motion.div>
        </AnimatePresence>

        {/* Speech-bubble caption */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`caption-${s.id}`}
            className="relative"
            style={{
              marginTop: 22,
              width: '100%',
              background: '#0d0800',
              border: `2px solid ${GOLD}88`,
              padding: '14px 18px',
              boxShadow: '4px 4px 0 #000',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {/* speech-bubble pointer */}
            <div
              style={{
                position: 'absolute', top: -10, left: 28,
                width: 0, height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: `10px solid ${GOLD}88`,
              }}
            />
            <p className="font-pixel" style={{ fontSize: '9px', color: '#ddbb88', letterSpacing: '0.5px', lineHeight: 2 }}>
              {s.caption}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4"
        style={{ paddingTop: 24, paddingBottom: 18, flexShrink: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          {STEPS.map((st, i) => (
            <motion.button
              key={st.id}
              onClick={() => goTo(i)}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                background: i === step ? GOLD : '#2a1800',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: i === step ? `0 0 8px ${GOLD}88` : 'none',
              }}
              animate={{ width: i === step ? 20 : 8 }}
              transition={{ duration: 0.25 }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-4">
          {step > 0 && (
            <PixelButton onClick={prev} color="brown">
              ◄ BACK
            </PixelButton>
          )}
          <PixelButton onClick={next} color={isLast ? 'red' : 'yellow'}>
            {isLast ? "LET'S PLAY ►" : 'NEXT ►'}
          </PixelButton>
        </div>

        <button
          onClick={onDone}
          className="font-pixel"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#665544',
            fontSize: '8px',
            letterSpacing: '2px',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          SKIP QUICK PLAY
        </button>
      </motion.div>
    </div>
  )
}
