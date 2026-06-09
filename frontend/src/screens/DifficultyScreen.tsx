import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import PixelCursor from '../components/PixelCursor'
import PixelButton from '../components/PixelButton'

import type { Difficulty } from '../types'

interface DifficultyScreenProps {
  onSelect: (difficulty: Difficulty) => void
}

const LEVELS: { key: Difficulty; label: string; color: string }[] = [
  { key: 'easy',   label: 'EASY',   color: '#5c8a2a' },
  { key: 'medium', label: 'MEDIUM', color: '#b8860b' },
  { key: 'hard',   label: 'HARD',   color: '#8b0000' },
]

/* Background card grid data */
const CARD_LABELS = [
  'PROF. KAMAL', 'DR. RAHMAN', 'LIBRARIAN', 'JANITOR', 'GUARD',
  'WRENCH',      'KNIFE',      'ROPE',      'PISTOL',  'POISON',
  'AUDITORIUM',  'IT PARK',    'CAFETERIA', 'LOTUS\nPOND', 'POCKET\nGATE',
]

const BG_CARDS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  label: CARD_LABELS[i % CARD_LABELS.length],
  top: `${(i * 37 + 5) % 95}%`,
  left: `${(i * 31 + 3) % 93}%`,
  rotate: (i % 2 === 0 ? 1 : -1) * ((i * 7) % 15 + 2),
}))

export default function DifficultyScreen({ onSelect }: DifficultyScreenProps) {
  const [selected, setSelected] = useState(0)
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = useCallback(() => {
    if (confirmed) return
    setConfirmed(true)
    setTimeout(() => onSelect(LEVELS[selected].key), 600)
  }, [confirmed, selected, onSelect])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')    setSelected(s => Math.max(0, s - 1))
      if (e.key === 'ArrowDown')  setSelected(s => Math.min(LEVELS.length - 1, s + 1))
      if (e.key === 'Enter')      handleConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleConfirm])

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ background: '#0d0800' }}
    >
      {/* Background card grid — blurred/muted */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {BG_CARDS.map((card) => (
          <motion.div
            key={card.id}
            className="absolute font-pixel"
            style={{
              top: card.top,
              left: card.left,
              rotate: card.rotate,
              width: '72px',
              minHeight: '96px',
              background: '#1a1000',
              border: '2px solid #2a1c00',
              padding: '8px 4px',
              fontSize: '5px',
              color: '#3d2a00',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              lineHeight: 1.6,
              letterSpacing: '0.5px',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: card.id * 0.04 + 0.5, duration: 0.6 }}
          >
            <div style={{ fontSize: '14px', marginBottom: '6px', color: '#2e1e00' }}>?</div>
            {card.label}
          </motion.div>
        ))}
      </div>

      {/* Dark overlay on bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.65)' }}
      />

      {/* Main menu panel */}
      <motion.div
        className="relative z-10"
        style={{
          background: '#080500',
          border: '4px solid #5c3d00',
          boxShadow: '8px 8px 0 #1a0f00, 0 0 30px #5c3d0044, inset 0 0 40px rgba(0,0,0,0.8)',
          padding: '40px 48px 48px',
          minWidth: '440px',
          maxWidth: '90vw',
        }}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Panel corner pixels */}
        {[
          'top-1.5 left-1.5', 'top-1.5 right-1.5',
          'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5',
        ].map((pos, i) => (
          <div
            key={i}
            className={`absolute ${pos} w-2 h-2`}
            style={{ background: '#b8860b' }}
          />
        ))}

        {/* Panel header */}
        <div className="text-center mb-10">
          <motion.div
            className="font-pixel"
            style={{ color: '#b8860b', fontSize: '8px', letterSpacing: '3px', marginBottom: '10px' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            ─── SELECT ───
          </motion.div>
          <motion.h2
            className="font-pixel"
            style={{
              color: '#e8c060',
              fontSize: 'clamp(18px, 3vw, 26px)',
              letterSpacing: '4px',
              textShadow: '3px 3px 0 #3d2200',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            GAME LEVEL
          </motion.h2>
        </div>

        {/* Dashed separator */}
        <motion.div
          style={{
            height: '2px',
            background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
            marginBottom: '28px',
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        />

        {/* Menu options */}
        <div className="flex flex-col gap-2">
          {LEVELS.map((level, i) => {
            const isSelected = selected === i
            return (
              <motion.div
                key={level.key}
                className="flex items-center gap-3 cursor-pointer px-3 py-3"
                style={{
                  background: isSelected ? 'rgba(92,60,0,0.35)' : 'transparent',
                  border: isSelected ? `2px solid ${level.color}44` : '2px solid transparent',
                  transition: 'background 0.15s, border 0.15s',
                }}
                onMouseEnter={() => setSelected(i)}
                onClick={handleConfirm}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.12, duration: 0.4 }}
              >
                {/* Pixel cursor */}
                <div style={{ width: '24px', flexShrink: 0 }}>
                  <PixelCursor visible={isSelected} />
                </div>

                {/* Level label */}
                <motion.span
                  className="font-pixel"
                  style={{
                    fontSize: 'clamp(9px, 1.8vw, 13px)',
                    letterSpacing: '2px',
                    minWidth: '90px',
                  }}
                  animate={
                    isSelected
                      ? {
                          color: ['#ffdd00', '#ffaa00', '#ffdd00'],
                          textShadow: [
                            `0 0 6px ${level.color}`,
                            `0 0 14px ${level.color}`,
                            `0 0 6px ${level.color}`,
                          ],
                        }
                      : { color: '#6b5030', textShadow: 'none' }
                  }
                  transition={{ duration: 1.2, repeat: isSelected ? Infinity : 0 }}
                >
                  {level.label}
                </motion.span>

                {/* Right indicator for selected */}
                {isSelected && (
                  <motion.span
                    className="font-pixel ml-auto"
                    style={{ color: '#ffdd00', fontSize: '10px' }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    ◀
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Dashed separator */}
        <motion.div
          style={{
            height: '2px',
            background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
            margin: '28px 0 24px',
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.1, duration: 0.4 }}
        />

        {/* Confirm button */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <PixelButton onClick={handleConfirm} color="yellow">
            CONFIRM  ►
          </PixelButton>
        </motion.div>

        {/* Key hints */}
        <motion.div
          className="font-pixel text-center mt-5"
          style={{ color: '#2e1e00', fontSize: '6px', letterSpacing: '1px', lineHeight: 2 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          ↑ ↓  NAVIGATE  &nbsp;|&nbsp;  ENTER  CONFIRM
        </motion.div>
      </motion.div>

      {/* Top label */}
      <motion.div
        className="absolute top-6 left-0 right-0 text-center font-pixel"
        style={{ color: '#2e1e00', fontSize: '7px', letterSpacing: '4px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        MURDER IN KUET  —  DETECTIVE MODE
      </motion.div>
    </div>
  )
}
