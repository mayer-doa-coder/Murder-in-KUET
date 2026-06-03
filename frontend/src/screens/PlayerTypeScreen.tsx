import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import CharacterCard from '../components/CharacterCard'
import PixelMenu from '../components/PixelMenu'
import type { Character, GameMode, PlayerType } from '../types'

interface PlayerTypeScreenProps {
  playerIndex: number
  character: Character
  gameMode: GameMode
  onSelect: (type: PlayerType) => void
  onBack: () => void
}

const ALL_MENU_ITEMS = [
  { label: 'HUMAN',    desc: 'you play',      accentColor: '#33cc33', type: 'human'    as PlayerType },
  { label: 'COMPUTER', desc: 'AI controls',   accentColor: '#cc4400', type: 'computer' as PlayerType },
]

export default function PlayerTypeScreen({
  playerIndex,
  character,
  onSelect,
  onBack,
}: PlayerTypeScreenProps) {
  // In human_vs_ai, both options are available. HvH/AIvAI bypass this screen entirely.
  const menuItems = ALL_MENU_ITEMS
  const [selected, setSelected] = useState(0)

  const handleConfirm = useCallback(() => {
    onSelect(menuItems[selected].type)
  }, [selected, onSelect, menuItems])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')   setSelected(s => Math.max(0, s - 1))
      if (e.key === 'ArrowDown') setSelected(s => Math.min(menuItems.length - 1, s + 1))
      if (e.key === 'Enter')     handleConfirm()
      if (e.key === 'Escape')    onBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleConfirm, onBack, menuItems])

  const playerColors = ['#4477ff', '#33aa33', '#cc2200', '#cc8800', '#cc00cc', '#00cccc']
  const playerAccent = playerColors[playerIndex] ?? '#b8860b'

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#060500' }}
    >
      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
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
        MURDER IN KUET — PLAYER {playerIndex + 1} SETUP
      </motion.div>

      {/* ── MAIN PANEL ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        style={{ gap: '0px', maxWidth: '520px', width: '90%' }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Panel box */}
        <div
          style={{
            background: '#080600',
            border: `4px solid #5c3d00`,
            boxShadow: `8px 8px 0 #1a0f00, 0 0 30px ${playerAccent}22, inset 0 0 40px rgba(0,0,0,0.8)`,
            padding: '32px 40px 36px',
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Corner accents */}
          {['top-1.5 left-1.5', 'top-1.5 right-1.5', 'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-2 h-2`} style={{ background: '#b8860b' }} />
          ))}

          {/* Title */}
          <div className="text-center mb-6">
            <div className="font-pixel" style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '3px', marginBottom: '8px' }}>
              ─── PLAYER {playerIndex + 1} ───
            </div>
            <h2
              className="font-pixel"
              style={{
                fontSize: 'clamp(10px, 1.8vw, 14px)',
                color: '#e8c060',
                letterSpacing: '3px',
                textShadow: '3px 3px 0 #3d2200',
              }}
            >
              SELECT HUMAN OR COMPUTER
            </h2>
          </div>

          {/* ── CHARACTER PORTRAIT ── */}
          <motion.div
            className="flex justify-center mb-7"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.45, ease: 'easeOut' }}
          >
            <div style={{ width: '150px', height: '190px' }}>
              <CharacterCard character={character} cardState="active" />
            </div>
          </motion.div>

          {/* Dashed separator */}
          <motion.div
            style={{
              height: '2px',
              background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
              marginBottom: '18px',
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          />

          {/* ── MENU ── */}
          <PixelMenu
            items={menuItems}
            selectedIndex={selected}
            onItemHover={setSelected}
            onItemClick={handleConfirm}
            entryDelay={0.45}
          />

          {/* Dashed separator */}
          <motion.div
            style={{
              height: '2px',
              background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
              margin: '18px 0 14px',
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          />

          {/* Key hints + back */}
          <div className="flex justify-between items-center">
            <button
              onClick={onBack}
              className="font-pixel"
              style={{ fontSize: '6px', color: '#3d2800', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '1px' }}
            >
              ◄ BACK
            </button>
            <span className="font-pixel" style={{ fontSize: '6px', color: '#2e1e00', letterSpacing: '1px' }}>
              ↑ ↓  |  ENTER
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
