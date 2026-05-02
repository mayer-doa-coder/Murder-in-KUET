import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import CharacterCard from '../components/CharacterCard'
import type { Character } from '../types'
import { CHARACTERS } from '../types'

interface CharacterSelectScreenProps {
  playerIndex: number        // 0-based
  takenIds: string[]         // character ids already chosen
  onSelect: (char: Character) => void
  onBack: () => void
}

const COLS = 3
const ROWS = 2

export default function CharacterSelectScreen({
  playerIndex,
  takenIds,
  onSelect,
  onBack,
}: CharacterSelectScreenProps) {
  // Grid cursor: [row, col]
  const [cursor, setCursor] = useState<[number, number]>([0, 0])

  const flatIndex = cursor[0] * COLS + cursor[1]
  const highlighted = CHARACTERS[flatIndex]

  const isAvailable = useCallback(
    (char: Character) => !takenIds.includes(char.id),
    [takenIds]
  )

  // Move cursor, skipping taken characters
  const moveCursor = useCallback(
    (dr: number, dc: number) => {
      setCursor(([r, c]) => {
        let nr = Math.max(0, Math.min(ROWS - 1, r + dr))
        let nc = Math.max(0, Math.min(COLS - 1, c + dc))
        // If landed on a taken card, try to skip further
        let attempts = 0
        while (!isAvailable(CHARACTERS[nr * COLS + nc]) && attempts < 6) {
          nr = Math.max(0, Math.min(ROWS - 1, nr + dr || 0))
          nc = Math.max(0, Math.min(COLS - 1, nc + dc || 0))
          attempts++
        }
        // If still taken, revert
        if (!isAvailable(CHARACTERS[nr * COLS + nc])) return [r, c]
        return [nr, nc]
      })
    },
    [isAvailable]
  )

  const handleConfirm = useCallback(() => {
    if (isAvailable(highlighted)) onSelect(highlighted)
  }, [highlighted, isAvailable, onSelect])

  useEffect(() => {
    // Ensure initial cursor is on an available card
    const firstAvailable = CHARACTERS.findIndex(isAvailable)
    if (firstAvailable >= 0 && takenIds.includes(CHARACTERS[0].id)) {
      setCursor([Math.floor(firstAvailable / COLS), firstAvailable % COLS])
    }
  }, [takenIds, isAvailable])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')    moveCursor(-1, 0)
      if (e.key === 'ArrowDown')  moveCursor(1, 0)
      if (e.key === 'ArrowLeft')  moveCursor(0, -1)
      if (e.key === 'ArrowRight') moveCursor(0, 1)
      if (e.key === 'Enter')      handleConfirm()
      if (e.key === 'Escape')     onBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [moveCursor, handleConfirm, onBack])

  const playerColors = ['#4477ff', '#33aa33', '#cc2200']
  const accentColor = playerColors[playerIndex] ?? '#b8860b'

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#060608' }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(30,20,60,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(30,20,60,0.12) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── TITLE BAR ── */}
      <motion.div
        className="relative z-10 text-center pt-5 pb-3 flex-shrink-0"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="font-pixel" style={{ fontSize: '8px', color: '#3d2800', letterSpacing: '3px', marginBottom: '6px' }}>
          ─── SETUP ───
        </div>
        <motion.h2
          className="font-pixel"
          style={{
            fontSize: 'clamp(10px, 1.8vw, 14px)',
            letterSpacing: '3px',
            textShadow: `3px 3px 0 #000`,
          }}
          animate={{ color: [accentColor, '#e8c060', accentColor] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          PLAYER {playerIndex + 1}: SELECT A CHARACTER
        </motion.h2>

        {/* Player progress indicator */}
        <div className="flex justify-center gap-3 mt-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="font-pixel"
              style={{
                fontSize: '6px',
                color: i === playerIndex ? accentColor : i < playerIndex ? '#5c5c5c' : '#1e1e1e',
                letterSpacing: '1px',
                textShadow: i === playerIndex ? `0 0 6px ${accentColor}` : 'none',
              }}
            >
              P{i + 1}{i < playerIndex ? ' ✓' : i === playerIndex ? ' ◀' : ''}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── DASHED DIVIDER ── */}
      <motion.div
        className="relative z-10 mx-6 flex-shrink-0"
        style={{
          height: '2px',
          background: `repeating-linear-gradient(90deg, ${accentColor}44 0, ${accentColor}44 8px, transparent 8px, transparent 16px)`,
          marginBottom: '10px',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      />

      {/* ── CHARACTER GRID ── */}
      <div className="relative z-10 flex-1 px-6 overflow-hidden">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: '10px',
            width: '100%',
            height: '100%',
          }}
        >
          {CHARACTERS.map((char, i) => {
            const row = Math.floor(i / COLS)
            const col = i % COLS
            const isCursorHere = cursor[0] === row && cursor[1] === col
            const taken = takenIds.includes(char.id)

            return (
              <motion.div
                key={char.id}
                style={{ minHeight: 0 }}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.06, duration: 0.35, ease: 'easeOut' }}
              >
                <CharacterCard
                  character={char}
                  cardState={taken ? 'taken' : isCursorHere ? 'highlighted' : 'normal'}
                  onClick={() => !taken && onSelect(char)}
                  onHover={() => !taken && setCursor([row, col])}
                />
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* ── SELECTED CARD PREVIEW LABEL ── */}
      <motion.div
        className="relative z-10 text-center py-2 flex-shrink-0 font-pixel"
        style={{ fontSize: 'clamp(6px, 1vw, 8px)', letterSpacing: '2px' }}
        animate={{
          color: isAvailable(highlighted) ? accentColor : '#2a2a2a',
          textShadow: isAvailable(highlighted) ? `0 0 8px ${accentColor}66` : 'none',
        }}
        transition={{ duration: 0.2 }}
      >
        {isAvailable(highlighted) ? `▶  ${highlighted.name}  ◀` : 'ALREADY TAKEN'}
      </motion.div>

      {/* ── BOTTOM HINTS ── */}
      <motion.div
        className="relative z-10 flex justify-between items-center px-6 pb-3 flex-shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <button
          onClick={onBack}
          className="font-pixel"
          style={{
            fontSize: '6px',
            color: '#3d2800',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '1px',
          }}
        >
          ◄ BACK
        </button>
        <span className="font-pixel" style={{ fontSize: '6px', color: '#2e1e00', letterSpacing: '1px' }}>
          ↑↓←→ NAVIGATE  |  ENTER SELECT
        </span>
      </motion.div>
    </div>
  )
}
