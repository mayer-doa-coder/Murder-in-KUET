import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import CharacterCard from '../components/CharacterCard'
import PixelMenu from '../components/PixelMenu'
import type { Character, PlayerType } from '../types'

interface ConfirmationScreenProps {
  playerIndex: number
  playerCount: number
  character: Character
  playerType: PlayerType
  isLastPlayer: boolean
  onNext: () => void
  onBack: () => void
}

const PLAYER_COLORS = [
  '#4477ff',
  '#33aa33',
  '#cc2200',
  '#cc8800',
  '#cc00cc',
  '#00cccc',
]

export default function ConfirmationScreen({
  playerIndex,
  playerCount,
  character,
  playerType,
  isLastPlayer,
  onNext,
  onBack,
}: ConfirmationScreenProps) {
  const [selected, setSelected] = useState(0)

  const nextLabel = isLastPlayer ? 'START GAME' : 'NEXT PLAYER'

  const MENU_ITEMS = [
    { label: nextLabel, desc: isLastPlayer ? 'begin!' : `setup P${playerIndex + 2}`, accentColor: '#ffdd00' },
    { label: 'BACKUP',  desc: 'change type',  accentColor: '#cc4400' },
  ]

  const handleConfirm = useCallback(() => {
    if (selected === 0) onNext()
    else onBack()
  }, [selected, onNext, onBack])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')   setSelected(s => Math.max(0, s - 1))
      if (e.key === 'ArrowDown') setSelected(s => Math.min(1, s + 1))
      if (e.key === 'Enter')     handleConfirm()
      if (e.key === 'Escape')    onBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleConfirm, onBack])

  const typeLabel   = playerType === 'human' ? 'HUMAN' : 'COMPUTER'
  const typeColor   = playerType === 'human' ? '#33cc33' : '#cc4400'
  const playerAccent = PLAYER_COLORS[playerIndex] ?? '#b8860b'

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#050400' }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      {/* Faint scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
        }}
      />

      {/* ── TOP LABEL ── */}
      <motion.div
        className="absolute top-5 left-0 right-0 text-center font-pixel z-10"
        style={{ fontSize: '8px', color: '#3d2800', letterSpacing: '3px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        MURDER IN KUET — CONFIRMATION
      </motion.div>

      {/* ── MAIN PANEL ── */}
      <motion.div
        className="relative z-10"
        style={{ maxWidth: '520px', width: '90%' }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          style={{
            background: '#080600',
            border: `4px solid #5c3d00`,
            boxShadow: `8px 8px 0 #1a0f00, 0 0 30px ${playerAccent}22, inset 0 0 40px rgba(0,0,0,0.8)`,
            padding: '32px 40px 36px',
            position: 'relative',
          }}
        >
          {/* Corner accents */}
          {['top-1.5 left-1.5', 'top-1.5 right-1.5', 'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-2 h-2`} style={{ background: '#b8860b' }} />
          ))}

          {/* Title */}
          <div className="text-center mb-5">
            <div className="font-pixel" style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '3px', marginBottom: '8px' }}>
              ─── PLAYER {playerIndex + 1} OF {playerCount} ───
            </div>
            <motion.h2
              className="font-pixel"
              style={{
                fontSize: 'clamp(12px, 2.2vw, 18px)',
                color: '#e8c060',
                letterSpacing: '4px',
                textShadow: '3px 3px 0 #3d2200',
              }}
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ALL DONE?
            </motion.h2>
          </div>

          {/* ── SUMMARY CARD ── */}
          <motion.div
            className="flex gap-5 items-center mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            {/* Character portrait */}
            <div style={{ width: '100px', height: '126px', flexShrink: 0 }}>
              <CharacterCard character={character} cardState="active" compact />
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div
                className="font-pixel"
                style={{
                  fontSize: '7px',
                  color: '#5c3d00',
                  letterSpacing: '2px',
                  marginBottom: '8px',
                }}
              >
                SELECTED:
              </div>
              <motion.div
                className="font-pixel"
                style={{
                  fontSize: 'clamp(8px, 1.4vw, 11px)',
                  color: character.accentColor,
                  letterSpacing: '1px',
                  textShadow: `0 0 8px ${character.accentColor}66`,
                  marginBottom: '10px',
                  lineHeight: 1.6,
                }}
                animate={{ textShadow: [`0 0 6px ${character.accentColor}44`, `0 0 12px ${character.accentColor}88`, `0 0 6px ${character.accentColor}44`] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {character.name}
              </motion.div>

              <div
                className="font-pixel"
                style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '2px', marginBottom: '6px' }}
              >
                PLAYER TYPE:
              </div>
              <div
                className="font-pixel"
                style={{
                  fontSize: 'clamp(8px, 1.4vw, 11px)',
                  color: typeColor,
                  letterSpacing: '2px',
                  textShadow: `0 0 8px ${typeColor}66`,
                }}
              >
                {typeLabel}
              </div>
            </div>
          </motion.div>

          {/* Dynamic progress dots */}
          <div className="flex justify-center gap-3 mb-5" style={{ flexWrap: 'wrap' }}>
            {Array.from({ length: playerCount }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i <= playerIndex ? '20px' : '8px',
                  height: '8px',
                  background: i <= playerIndex ? playerAccent : '#1a1a1a',
                  transition: 'all 0.3s',
                  boxShadow: i === playerIndex ? `0 0 8px ${playerAccent}` : 'none',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Dashed separator */}
          <motion.div
            style={{
              height: '2px',
              background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
              marginBottom: '18px',
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          />

          {/* ── MENU ── */}
          <PixelMenu
            items={MENU_ITEMS}
            selectedIndex={selected}
            onItemHover={setSelected}
            onItemClick={handleConfirm}
            entryDelay={0.55}
          />

          {/* Hints */}
          <motion.div
            className="font-pixel text-center mt-4"
            style={{ fontSize: '6px', color: '#2e1e00', letterSpacing: '1px' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            ↑ ↓  NAVIGATE  |  ENTER  CONFIRM
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
