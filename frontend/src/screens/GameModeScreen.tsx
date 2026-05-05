import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { GameMode } from '../types'

interface Props {
  onSelect: (mode: GameMode) => void
}

const MODES: { id: GameMode; label: string; sub: string; icon: string; color: string }[] = [
  { id: 'human_vs_human', label: 'HUMAN VS HUMAN', sub: 'local multiplayer',      icon: '◇◇', color: '#33cc55' },
  { id: 'human_vs_ai',    label: 'HUMAN VS AI',    sub: 'challenge the machine',  icon: '◇⊛', color: '#ccaa00' },
  { id: 'ai_vs_ai',       label: 'AI VS AI',        sub: 'observe & analyze',     icon: '⊛⊛', color: '#cc4422' },
]

export default function GameModeScreen({ onSelect }: Props) {
  const [cursor, setCursor] = useState(1) // default: Human vs AI

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

  const active = MODES[cursor]

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
        <div className="font-pixel" style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '3px', marginBottom: 10 }}>
          ─── MURDER IN KUET ───
        </div>
        <div className="font-pixel" style={{
          fontSize: 'clamp(11px,2vw,16px)',
          color: '#e8c060',
          letterSpacing: '4px',
          textShadow: '3px 3px 0 #3d2200',
        }}>
          SELECT GAME MODE
        </div>
      </motion.div>

      {/* Mode list */}
      <div className="relative z-10 flex flex-col gap-4" style={{ width: '100%', maxWidth: 480, padding: '0 24px' }}>
        {MODES.map((m, i) => {
          const isSel = i === cursor
          return (
            <motion.div
              key={m.id}
              onClick={() => { setCursor(i); onSelect(m.id) }}
              onMouseEnter={() => setCursor(i)}
              style={{
                background: isSel ? 'rgba(40,25,0,0.85)' : 'rgba(20,12,0,0.6)',
                border: `2px solid ${isSel ? m.color : '#2a1800'}`,
                boxShadow: isSel ? `0 0 22px ${m.color}33, 4px 4px 0 #000` : '3px 3px 0 #000',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                transition: 'border-color 0.12s, box-shadow 0.12s',
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Cursor arrow */}
              <motion.span
                className="font-pixel"
                style={{ fontSize: '10px', color: '#ffdd00', width: 14, flexShrink: 0 }}
                animate={isSel ? { opacity: [1, 0.3, 1] } : { opacity: 0 }}
                transition={{ duration: 0.55, repeat: Infinity, ease: 'linear' }}
              >
                ▶
              </motion.span>

              {/* Icon */}
              <span style={{
                fontFamily: 'monospace', fontSize: 20,
                color: isSel ? m.color : '#554422',
                textShadow: isSel ? `0 0 10px ${m.color}88` : 'none',
                lineHeight: 1, flexShrink: 0,
              }}>
                {m.icon}
              </span>

              {/* Labels */}
              <div style={{ flex: 1 }}>
                <div className="font-pixel" style={{
                  fontSize: '9px',
                  color: isSel ? m.color : '#886633',
                  letterSpacing: '1.5px',
                  marginBottom: 5,
                }}>
                  {m.label}
                </div>
                <div className="font-pixel" style={{
                  fontSize: '5px',
                  color: isSel ? '#997744' : '#554422',
                  letterSpacing: '0.8px',
                }}>
                  {m.sub}
                </div>
              </div>

              {/* Select badge */}
              {isSel && (
                <motion.div
                  className="font-pixel"
                  style={{ fontSize: '5px', color: m.color, letterSpacing: '1px', flexShrink: 0 }}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  [ENTER]
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Active mode description */}
      <motion.div
        key={active.id}
        className="relative z-10 font-pixel text-center"
        style={{ marginTop: 28, fontSize: '6px', letterSpacing: '1px' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div style={{ color: active.color, marginBottom: 6 }}>
          {active.id === 'human_vs_human' && 'ALL PLAYERS ARE HUMAN — PASS & PLAY'}
          {active.id === 'human_vs_ai'    && 'HUMANS COMPETE AGAINST AI OPPONENTS'}
          {active.id === 'ai_vs_ai'       && 'WATCH AI AGENTS SOLVE THE MYSTERY'}
        </div>
        <div style={{ color: '#2e1e00' }}>↑↓ NAVIGATE · ENTER OR CLICK TO SELECT</div>
      </motion.div>
    </div>
  )
}
