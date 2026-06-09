import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import CharacterCard from '../components/CharacterCard'
import { CHARACTERS } from '../types'

interface PlayerCountScreenProps {
  onSelect: (count: 3 | 4 | 5 | 6) => void
}

const COUNT_OPTIONS: (3 | 4 | 5 | 6)[] = [3, 4, 5, 6]

export default function PlayerCountScreen({ onSelect }: PlayerCountScreenProps) {
  const [selectedCount, setSelectedCount] = useState<3 | 4 | 5 | 6>(3)

  const handleConfirm = useCallback(() => {
    onSelect(selectedCount)
  }, [onSelect, selectedCount])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirm()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCount(prev => {
          const idx = COUNT_OPTIONS.indexOf(prev)
          return COUNT_OPTIONS[Math.min(idx + 1, COUNT_OPTIONS.length - 1)]
        })
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCount(prev => {
          const idx = COUNT_OPTIONS.indexOf(prev)
          return COUNT_OPTIONS[Math.max(idx - 1, 0)]
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleConfirm])

  return (
    <div
      className="relative w-full h-full flex overflow-hidden"
      style={{ background: '#080600' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(92,60,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(92,60,0,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── LEFT PANEL: title + controls ── */}
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
            marginBottom: 18,
          }}
        >
          SELECT NUMBER OF PLAYERS
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24,
        }}>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #5c3d00 0, #5c3d00 6px, transparent 6px, transparent 12px)' }} />
          <span className="font-pixel" style={{ color: '#8b0000', fontSize: '10px' }}>✦</span>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #5c3d00 0, #5c3d00 6px, transparent 6px, transparent 12px)' }} />
        </div>

        {/* Number selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: 24 }}>
          {COUNT_OPTIONS.map((n) => {
            const isSelected = selectedCount === n
            return (
              <motion.div
                key={n}
                onClick={() => { setSelectedCount(n); onSelect(n) }}
                onMouseEnter={() => setSelectedCount(n)}
                style={{
                  width: '58px',
                  height: '58px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isSelected ? '#2a1a00' : '#1a1000',
                  border: isSelected ? '3px solid #b8860b' : '3px solid #3d2200',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 18px #b8860b88, 4px 4px 0 #000' : '3px 3px 0 #000',
                  transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
                  flexShrink: 0,
                }}
                animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
                transition={{ duration: 0.12 }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="font-pixel" style={{
                  fontSize: '18px',
                  color: isSelected ? '#ffdd00' : '#b8860b',
                  textShadow: isSelected ? '0 0 10px #ffdd00aa' : 'none',
                }}>
                  {n}
                </span>
                <span className="font-pixel" style={{
                  fontSize: '5px', color: isSelected ? '#cc9933' : '#3d2800',
                  marginTop: '2px', letterSpacing: '0.3px',
                }}>
                  PLAYERS
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* Info rows — each fills full panel width */}
        <div style={{ width: '100%', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="font-pixel" style={{ width: '100%', fontSize: '9px', color: '#886633', letterSpacing: '2px' }}>
            AVAILABLE SUSPECTS
          </div>
          <div className="font-pixel" style={{ width: '100%', fontSize: '11px', letterSpacing: '2px' }}>
            <span style={{ color: '#ffdd00', textShadow: '0 0 8px #ffdd0066' }}>{selectedCount}</span>
            <span style={{ color: '#b8860b' }}> OF 6 WILL PLAY</span>
          </div>
        </div>

        {/* Navigation hint */}
        <motion.div
          className="font-pixel"
          style={{ width: '100%', fontSize: '9px', color: '#cc8833', letterSpacing: '1.5px', lineHeight: 2, textShadow: '0 0 8px #cc883344' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <div style={{ width: '100%' }}>←→ CHOOSE</div>
          <div style={{ width: '100%' }}>ENTER TO CONFIRM</div>
        </motion.div>
      </motion.div>

      {/* Vertical separator */}
      <div
        className="relative z-10 shrink-0"
        style={{
          width: '2px',
          margin: '32px 0',
          background: 'repeating-linear-gradient(180deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
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
          {CHARACTERS.map((char, i) => (
            <motion.div
              key={char.id}
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: i < selectedCount ? 1 : 0.22, scale: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.07, duration: 0.35 }}
            >
              <CharacterCard character={char} cardState="normal" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
