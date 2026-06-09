import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import CharacterCard from '../components/CharacterCard'
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
  const nextDesc  = isLastPlayer ? 'BEGIN THE MYSTERY' : `SETUP PLAYER ${playerIndex + 2}`
  const typeLabel = playerType === 'human' ? 'HUMAN' : 'COMPUTER'

  const MENU = [
    { label: nextLabel, desc: nextDesc },
    { label: 'BACKUP',  desc: 'GO BACK & CHANGE' },
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

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#050400' }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)' }}
      />

      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)' }}
      />

      {/* ── MAIN PANEL ── */}
      <motion.div
        className="relative z-10"
        style={{ maxWidth: '580px', width: '90%' }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          style={{
            background: '#080600',
            border: '4px solid #5c3d00',
            boxShadow: '8px 8px 0 #1a0f00, 0 0 30px #b8860b22, inset 0 0 40px rgba(0,0,0,0.8)',
            position: 'relative',
          }}
        >
          {/* Corner accents */}
          {['top-1.5 left-1.5', 'top-1.5 right-1.5', 'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-2 h-2`} style={{ background: '#b8860b' }} />
          ))}

          {/* ── HEADER: player indicator + ALL DONE? ── */}
          <div
            style={{
              padding: '22px 32px 18px',
              textAlign: 'center',
            }}
          >
            <div
              className="font-pixel"
              style={{ fontSize: '8px', color: '#5c3d00', letterSpacing: '3px', marginBottom: '10px' }}
            >
              ─── PLAYER {playerIndex + 1} OF {playerCount} ───
            </div>
            <motion.h2
              className="font-pixel"
              style={{
                fontSize: 'clamp(18px, 3vw, 26px)',
                color: '#e8c060',
                letterSpacing: '4px',
                textShadow: '3px 3px 0 #3d2200, 0 0 20px #b8860b44',
              }}
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ALL DONE?
            </motion.h2>

            {/* Divider separator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '12px' }}>
              <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 6px, transparent 6px, transparent 12px)' }} />
              <span className="font-pixel" style={{ color: '#8b0000', fontSize: '10px' }}>✦</span>
              <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 6px, transparent 6px, transparent 12px)' }} />
            </div>
          </div>

          {/* ── BODY: left portrait | right menu+info ── */}
          <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '300px', padding: '0 0 0 20px' }}>

            {/* LEFT: character portrait filling full height */}
            <motion.div
              style={{ width: '175px', maxHeight: '250px', flexShrink: 0 }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <CharacterCard character={character} cardState="active" />
            </motion.div>

            {/* RIGHT: menu + divider + info */}
            <motion.div
              style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column' }}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
            >
              {/* Menu items */}
              <div style={{ marginBottom: '4px' }}>
                {MENU.map((item, i) => {
                  const isSel = selected === i
                  return (
                    <motion.div
                      key={item.label}
                      onClick={() => { setSelected(i); if (selected === i) handleConfirm() }}
                      onMouseEnter={() => setSelected(i)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 14px',
                        marginBottom: '8px',
                        background: isSel ? '#1e1200' : 'transparent',
                        border: `2px solid ${isSel ? '#b8860b' : '#2a1800'}`,
                        cursor: 'pointer',
                        boxShadow: isSel ? '0 0 14px #b8860b44, 3px 3px 0 #000' : '2px 2px 0 #000',
                        transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {/* Blinking cursor */}
                      <motion.span
                        className="font-pixel"
                        style={{ fontSize: '12px', color: '#ffdd00', width: '16px', flexShrink: 0 }}
                        animate={isSel ? { opacity: [1, 0.2, 1] } : { opacity: 0 }}
                        transition={isSel ? { duration: 0.55, repeat: Infinity, ease: 'linear' } : { duration: 0.15 }}
                      >▶</motion.span>

                      <div style={{ flex: 1 }}>
                        <div
                          className="font-pixel"
                          style={{
                            fontSize: '11px',
                            color: isSel ? '#e8c060' : '#886633',
                            letterSpacing: '2px',
                            marginBottom: '4px',
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          className="font-pixel"
                          style={{
                            fontSize: '7px',
                            color: isSel ? '#b8860b' : '#3d2200',
                            letterSpacing: '1px',
                          }}
                        >
                          {item.desc}
                        </div>
                      </div>

                      {/* [ENTER] badge */}
                      <motion.div
                        className="font-pixel"
                        style={{ fontSize: '8px', color: '#b8860b', letterSpacing: '1px', flexShrink: 0 }}
                        animate={isSel ? { opacity: [1, 0.4, 1] } : { opacity: 0 }}
                        transition={isSel ? { duration: 1.2, repeat: Infinity } : { duration: 0.15 }}
                      >
                        [ENTER]
                      </motion.div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Dashed divider */}
              <motion.div
                style={{
                  height: '2px',
                  background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 6px, transparent 6px, transparent 12px)',
                  margin: '10px 0 18px',
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.55, duration: 0.4 }}
              />

              {/* Info: SELECTED + PLAYER TYPE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div
                    className="font-pixel"
                    style={{ fontSize: '8px', color: '#5c3d00', letterSpacing: '2px', marginBottom: '6px' }}
                  >
                    SELECTED
                  </div>
                  <div
                    className="font-pixel"
                    style={{
                      fontSize: '11px',
                      color: '#e8c060',
                      letterSpacing: '1.5px',
                      textShadow: '0 0 8px #e8c06044',
                    }}
                  >
                    {character.name}
                  </div>
                </div>

                <div>
                  <div
                    className="font-pixel"
                    style={{ fontSize: '8px', color: '#5c3d00', letterSpacing: '2px', marginBottom: '6px' }}
                  >
                    PLAYER TYPE
                  </div>
                  <div
                    className="font-pixel"
                    style={{
                      fontSize: '11px',
                      color: '#b8860b',
                      letterSpacing: '2px',
                      textShadow: '0 0 8px #b8860b44',
                    }}
                  >
                    {typeLabel}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── FOOTER: nav hint ── */}
          <motion.div
            className="font-pixel text-center"
            style={{
              padding: '14px 32px',
              borderTop: '2px solid #1e1400',
              fontSize: '9px',
              color: '#cc8833',
              letterSpacing: '2px',
              textShadow: '0 0 8px #cc883344',
            }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            initial={{ opacity: 0 }}
          >
            ↑↓ NAVIGATE · ENTER TO CONFIRM
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
