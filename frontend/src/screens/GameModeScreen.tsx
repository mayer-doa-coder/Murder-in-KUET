import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { GameMode } from '../types'

interface Props {
  onSelect: (mode: GameMode) => void
  onOnline?: () => void
}

const MODES: { id: GameMode; label: string; sub: string; icon: string; color: string }[] = [
  { id: 'human_vs_human', label: 'HUMAN VS HUMAN', sub: 'LOCAL MULTIPLAYER — ALL PLAYERS ARE HUMAN, PASS & PLAY',      icon: '◇◇', color: '#33cc55' },
  { id: 'human_vs_ai',    label: 'HUMAN VS AI',    sub: 'CHALLENGE THE MACHINE — HUMANS COMPETE AGAINST AI OPPONENTS',  icon: '◇⊛', color: '#ccaa00' },
  { id: 'ai_vs_ai',       label: 'AI VS AI',        sub: 'OBSERVE & ANALYZE — WATCH AI AGENTS SOLVE THE MYSTERY',      icon: '⊛⊛', color: '#cc4422' },
]

export default function GameModeScreen({ onSelect, onOnline }: Props) {
  const [cursor, setCursor] = useState(1)

  const handleConfirm = useCallback(() => {
    onSelect(MODES[cursor].id)
  }, [cursor, onSelect])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(0, c - 1)) }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(MODES.length - 1, c + 1)) }
      if (e.key === 'Enter')     handleConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleConfirm])

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#060400' }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(92,60,0,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(92,60,0,0.05) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)',
      }} />

      {/* Title */}
      <motion.div
        className="relative z-10 text-center mb-10"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        {/* Supertitle — matches HowToPlayScreen style */}
        <motion.div
          className="font-pixel"
          style={{ fontSize: '9px', color: '#5c3d00', letterSpacing: '4px', marginBottom: 12 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ─── MURDER IN KUET ───
        </motion.div>

        <div className="font-pixel" style={{
          fontSize: 'clamp(18px, 3vw, 26px)',
          color: '#e8c060',
          letterSpacing: '4px',
          textShadow: '3px 3px 0 #3d2200, 0 0 24px #b8860b55',
        }}>
          SELECT GAME MODE
        </div>

        {/* Decorative divider */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '0 8px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #5c3d00 0, #5c3d00 6px, transparent 6px, transparent 12px)' }} />
          <span className="font-pixel" style={{ color: '#8b0000', fontSize: '10px' }}>✦</span>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #5c3d00 0, #5c3d00 6px, transparent 6px, transparent 12px)' }} />
        </motion.div>
      </motion.div>

      {/* Mode list */}
      <div className="relative z-10 flex flex-col gap-5" style={{ width: '100%', maxWidth: 640, padding: '0 28px' }}>
        {MODES.map((m, i) => {
          const isSel = i === cursor
          return (
            <motion.div
              key={m.id}
              onClick={() => { setCursor(i); onSelect(m.id) }}
              onMouseEnter={() => setCursor(i)}
              style={{
                background: isSel ? 'rgba(40,25,0,0.90)' : 'rgba(20,12,0,0.65)',
                border: `2px solid ${isSel ? m.color : '#2a1800'}`,
                boxShadow: isSel ? `0 0 28px ${m.color}33, 4px 4px 0 #000` : '3px 3px 0 #000',
                padding: '22px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                cursor: 'pointer',
                transition: 'border-color 0.12s, box-shadow 0.12s',
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Cursor arrow — blinks only when row is selected/hovered */}
              <motion.span
                className="font-pixel"
                style={{ fontSize: '14px', color: '#ffdd00', width: 18, flexShrink: 0 }}
                animate={isSel ? { opacity: [1, 0.2, 1] } : { opacity: 0 }}
                transition={isSel
                  ? { duration: 0.55, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.15 }
                }
              >
                ▶
              </motion.span>

              {/* Icon */}
              <span style={{
                fontFamily: 'monospace', fontSize: 30,
                color: isSel ? m.color : '#554422',
                textShadow: isSel ? `0 0 14px ${m.color}88` : 'none',
                lineHeight: 1, flexShrink: 0,
              }}>
                {m.icon}
              </span>

              {/* Labels */}
              <div style={{ flex: 1 }}>
                <div className="font-pixel" style={{
                  fontSize: '11px',
                  color: isSel ? m.color : '#886633',
                  letterSpacing: '2px',
                  marginBottom: 8,
                }}>
                  {m.label}
                </div>
                <div className="font-pixel" style={{
                  fontSize: '7px',
                  color: isSel ? '#bb9944' : '#664433',
                  letterSpacing: '0.8px',
                  lineHeight: 1.8,
                }}>
                  {m.sub}
                </div>
              </div>

              {/* Select badge — always in DOM so layout never shifts */}
              <motion.div
                className="font-pixel"
                style={{ fontSize: '8px', color: m.color, letterSpacing: '1px', flexShrink: 0 }}
                animate={isSel ? { opacity: [1, 0.4, 1] } : { opacity: 0 }}
                transition={isSel
                  ? { duration: 1.2, repeat: Infinity }
                  : { duration: 0.15 }
                }
              >
                [ENTER]
              </motion.div>
            </motion.div>
          )
        })}
      </div>

      {/* Online multiplayer — separate flow from the local setup modes */}
      {onOnline && (
        <motion.button
          className="relative z-10 font-pixel"
          onClick={onOnline}
          style={{
            marginTop: 22,
            background: 'rgba(0,20,30,0.75)',
            border: '2px solid #1f5566',
            color: '#33cccc',
            padding: '14px 26px',
            fontSize: '10px',
            letterSpacing: '2px',
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #000',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.03, borderColor: '#33cccc', color: '#66ffff' }}
          whileTap={{ scale: 0.97 }}
        >
          🌐 ONLINE MULTIPLAYER — PLAY WITH FRIENDS BY ROOM CODE
        </motion.button>
      )}

      {/* Navigate hint */}
      <motion.div
        className="relative z-10 font-pixel text-center"
        style={{ marginTop: 20, fontSize: '9px', letterSpacing: '2px', color: '#cc8833', textShadow: '0 0 8px #cc883355' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.2, repeat: Infinity }}
      >
        ↑↓ NAVIGATE · ENTER OR CLICK TO SELECT
      </motion.div>
    </div>
  )
}
