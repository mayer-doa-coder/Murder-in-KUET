import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import CharacterCard from '../components/CharacterCard'
import { CHARACTERS } from '../types'

interface PlayerCountScreenProps {
  onConfirm: () => void
}

const COUNT_OPTIONS = [3, 4, 5, 6]

/* Panel corner accent */
function CornerPixels() {
  return (
    <>
      {['top-1.5 left-1.5', 'top-1.5 right-1.5', 'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5'].map(
        (pos, i) => (
          <div key={i} className={`absolute ${pos} w-2 h-2`} style={{ background: '#b8860b' }} />
        )
      )}
    </>
  )
}

export default function PlayerCountScreen({ onConfirm }: PlayerCountScreenProps) {
  const [hoveredCount, setHoveredCount] = useState(3)

  const handleConfirm = useCallback(() => {
    // Only 3 is valid
    onConfirm()
  }, [onConfirm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleConfirm])

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#080600' }}
    >
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(92,60,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(92,60,0,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── TITLE BAR ── */}
      <motion.div
        className="relative z-10 text-center pt-6 pb-4 flex-shrink-0"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="font-pixel" style={{ color: '#5c3d00', fontSize: '8px', letterSpacing: '3px', marginBottom: '8px' }}>
          ─── MURDER IN KUET ───
        </div>
        <h2
          className="font-pixel"
          style={{
            fontSize: 'clamp(10px, 2vw, 16px)',
            color: '#e8c060',
            letterSpacing: '4px',
            textShadow: '3px 3px 0 #3d2200',
          }}
        >
          SELECT NUMBER OF PLAYERS
        </h2>
      </motion.div>

      {/* ── NUMBER SELECTOR ROW ── */}
      <motion.div
        className="relative z-10 flex justify-center gap-6 px-8 py-4 flex-shrink-0"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {COUNT_OPTIONS.map((n) => {
          const isSelectable = n === 3
          const isHovered = hoveredCount === n && isSelectable

          return (
            <div key={n} className="flex flex-col items-center gap-1">
              {/* Dagger cursor above "3" */}
              <motion.div
                className="font-pixel"
                style={{
                  fontSize: '10px',
                  color: '#ffdd00',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                animate={
                  isSelectable
                    ? { opacity: [1, 0.4, 1], y: [0, -2, 0] }
                    : { opacity: 0 }
                }
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                ▲
              </motion.div>

              {/* Number box */}
              <motion.div
                onClick={isSelectable ? handleConfirm : undefined}
                onMouseEnter={() => isSelectable && setHoveredCount(n)}
                style={{
                  width: '72px',
                  height: '72px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isSelectable
                    ? isHovered ? '#2a1a00' : '#1a1000'
                    : '#0a0a0a',
                  border: isSelectable
                    ? isHovered
                      ? '3px solid #b8860b'
                      : '3px solid #5c3d00'
                    : '3px solid #1e1e1e',
                  cursor: isSelectable ? 'pointer' : 'not-allowed',
                  boxShadow: isHovered
                    ? '0 0 16px #b8860b88, 4px 4px 0 #000'
                    : '3px 3px 0 #000',
                  transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
                }}
                animate={isHovered ? { scale: 1.06 } : { scale: 1 }}
                transition={{ duration: 0.12 }}
              >
                <span
                  className="font-pixel"
                  style={{
                    fontSize: '24px',
                    color: isSelectable ? (isHovered ? '#ffdd00' : '#b8860b') : '#2a2a2a',
                    textShadow: isHovered ? '0 0 10px #ffdd00aa' : 'none',
                    letterSpacing: 0,
                  }}
                >
                  {n}
                </span>
                {/* Lock icon for disabled options */}
                {!isSelectable && (
                  <span
                    className="font-pixel"
                    style={{ fontSize: '6px', color: '#1e1e1e', marginTop: '3px' }}
                  >
                    LOCKED
                  </span>
                )}
              </motion.div>
            </div>
          )
        })}
      </motion.div>

      {/* ── DASHED DIVIDER ── */}
      <motion.div
        className="relative z-10 mx-8 flex-shrink-0"
        style={{
          height: '2px',
          background:
            'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
          marginBottom: '12px',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      />

      {/* ── CHARACTER PREVIEW GRID ── */}
      <motion.div
        className="relative z-10 flex-1 flex flex-col overflow-hidden px-8 pb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.6 }}
      >
        {/* Grid label */}
        <div
          className="font-pixel text-center mb-3 flex-shrink-0"
          style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '3px' }}
        >
          AVAILABLE SUSPECTS
        </div>

        {/* Pixel-bordered container */}
        <div
          className="relative flex-1"
          style={{
            border: '3px solid #3d2200',
            boxShadow: '4px 4px 0 #0d0800, inset 0 0 30px rgba(0,0,0,0.6)',
            padding: '10px',
            background: '#0a0800',
          }}
        >
          <CornerPixels />
          {/* 3-column × 2-row grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(2, 1fr)',
              gap: '8px',
              width: '100%',
              height: '100%',
            }}
          >
            {CHARACTERS.map((char, i) => (
              <motion.div
                key={char.id}
                style={{ minHeight: 0 }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.07, duration: 0.35 }}
              >
                <CharacterCard character={char} cardState="normal" compact />
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── BOTTOM HINTS ── */}
      <motion.div
        className="relative z-10 text-center pb-3 flex-shrink-0 font-pixel"
        style={{ fontSize: '6px', color: '#2e1e00', letterSpacing: '1px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        CLICK 3 OR PRESS ENTER TO CONTINUE
      </motion.div>
    </div>
  )
}
