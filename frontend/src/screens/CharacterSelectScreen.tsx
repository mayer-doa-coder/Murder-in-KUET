import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import CharacterCard from '../components/CharacterCard'
import type { Character } from '../types'
import { CHARACTERS } from '../types'

interface CharacterSelectScreenProps {
  playerIndex: number
  playerCount: number
  takenIds: string[]
  onSelect: (char: Character) => void
  onBack: () => void
}

const COLS = 3
const ROWS = 2

export default function CharacterSelectScreen({
  playerIndex,
  playerCount,
  takenIds,
  onSelect,
  onBack,
}: CharacterSelectScreenProps) {
  const [cursor, setCursor] = useState<[number, number]>([0, 0])

  const flatIndex = cursor[0] * COLS + cursor[1]
  const highlighted = CHARACTERS[flatIndex]

  const isAvailable = useCallback(
    (char: Character) => !takenIds.includes(char.id),
    [takenIds]
  )

  const moveCursor = useCallback(
    (dr: number, dc: number) => {
      setCursor(([r, c]) => {
        let nr = Math.max(0, Math.min(ROWS - 1, r + dr))
        let nc = Math.max(0, Math.min(COLS - 1, c + dc))
        let attempts = 0
        while (!isAvailable(CHARACTERS[nr * COLS + nc]) && attempts < 6) {
          nr = Math.max(0, Math.min(ROWS - 1, nr + dr || 0))
          nc = Math.max(0, Math.min(COLS - 1, nc + dc || 0))
          attempts++
        }
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

  return (
    <div
      className="relative w-full h-full flex overflow-hidden"
      style={{ background: '#060608' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(30,20,60,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(30,20,60,0.12) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── LEFT PANEL: title + info ── */}
      <motion.div
        className="relative z-10 flex flex-col justify-center shrink-0"
        style={{ width: '40%', padding: '40px 36px' }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Supertitle */}
        <motion.div
          className="font-pixel"
          style={{ fontSize: '9px', color: '#aa6622', letterSpacing: '4px', marginBottom: 14, textShadow: '0 0 10px #aa662244' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ─── MURDER IN KUET ───
        </motion.div>

        {/* Main title */}
        <div
          className="font-pixel"
          style={{
            fontSize: 'clamp(18px, 3vw, 26px)',
            color: '#e8c060',
            letterSpacing: '3px',
            textShadow: '3px 3px 0 #3d2200, 0 0 24px #b8860b55',
            lineHeight: 1.4,
            marginBottom: 14,
          }}
        >
          PLAYER {playerIndex + 1}:<br />SELECT A CHARACTER
        </div>

        {/* Player progress */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: 18 }}>
          {Array.from({ length: playerCount }, (_, i) => (
            <div
              key={i}
              className="font-pixel"
              style={{
                fontSize: '9px',
                color: i === playerIndex ? '#e8c060' : i < playerIndex ? '#5c5c5c' : '#1e1e1e',
                letterSpacing: '1px',
                textShadow: i === playerIndex ? '0 0 8px #e8c06077' : 'none',
              }}
            >
              P{i + 1}{i < playerIndex ? ' ✓' : i === playerIndex ? ' ◀' : ''}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #b8860b44 0, #b8860b44 6px, transparent 6px, transparent 12px)' }} />
          <span className="font-pixel" style={{ color: '#b8860b', fontSize: '10px' }}>✦</span>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #b8860b44 0, #b8860b44 6px, transparent 6px, transparent 12px)' }} />
        </div>

        {/* Selected character name */}
        <div
          className="font-pixel"
          style={{
            fontSize: '10px',
            letterSpacing: '1.5px',
            marginBottom: 24,
            minHeight: '20px',
            color: isAvailable(highlighted) ? '#e8c060' : '#333',
            textShadow: isAvailable(highlighted) ? '0 0 10px #e8c06066' : 'none',
            transition: 'color 0.2s, text-shadow 0.2s',
          }}
        >
          {isAvailable(highlighted)
            ? `▶  ${highlighted.name}  ◀`
            : '— ALREADY TAKEN —'}
        </div>

        {/* Navigation hint */}
        <motion.div
          className="font-pixel"
          style={{ width: '100%', fontSize: '9px', color: '#cc8833', letterSpacing: '1.5px', textShadow: '0 0 8px #cc883344', marginBottom: 20 }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          ↑↓←→ NAVIGATE · ENTER TO SELECT
        </motion.div>

      </motion.div>

      {/* Vertical separator */}
      <div
        className="relative z-10 shrink-0"
        style={{
          width: '2px',
          margin: '32px 0',
          background: 'repeating-linear-gradient(180deg, #b8860b44 0, #b8860b44 8px, transparent 8px, transparent 16px)',
        }}
      />

      {/* ── RIGHT PANEL: character cards ── */}
      <div
        className="relative z-10 flex-1 flex items-center justify-center"
        style={{ padding: '24px 32px 24px 24px', overflow: 'hidden' }}
      >
        <motion.div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridAutoRows: 'clamp(150px, 33vh, 260px)',
            gap: '12px',
            width: '100%',
            maxWidth: '520px',
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {CHARACTERS.map((char, i) => {
            const row = Math.floor(i / COLS)
            const col = i % COLS
            const isCursorHere = cursor[0] === row && cursor[1] === col
            const taken = takenIds.includes(char.id)

            return (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, scale: 0.85, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.35, ease: 'easeOut' }}
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
        </motion.div>
      </div>
    </div>
  )
}
