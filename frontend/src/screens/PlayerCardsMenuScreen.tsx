import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import PixelCursor from '../components/PixelCursor'
import type { GameDeal, PlayerSetup } from '../types'

interface PlayerCardsMenuScreenProps {
  players: PlayerSetup[]
  deal: GameDeal
  onViewPlayer: (playerIndex: number) => void
  onStart?: () => void
}

const BG_POSITIONS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  top: `${(i * 41 + 7) % 93}%`,
  left: `${(i * 37 + 5) % 91}%`,
  rotate: (i % 2 === 0 ? 1 : -1) * ((i * 11) % 14 + 3),
}))

export default function PlayerCardsMenuScreen({ players, deal, onViewPlayer, onStart }: PlayerCardsMenuScreenProps) {
  const [selected, setSelected] = useState(0)

  const handleConfirm = useCallback(() => {
    onViewPlayer(selected)
  }, [selected, onViewPlayer])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')   setSelected(s => Math.max(0, s - 1))
      if (e.key === 'ArrowDown') setSelected(s => Math.min(players.length - 1, s + 1))
      if (e.key === 'Enter' || e.key === ' ') handleConfirm()
      if ((e.key === 's' || e.key === 'S') && onStart) onStart()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleConfirm, players.length, onStart])

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ background: '#030200' }}
    >
      {/* BG card grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {BG_POSITIONS.map(pos => (
          <motion.div
            key={pos.id}
            className="absolute"
            style={{
              top: pos.top,
              left: pos.left,
              rotate: pos.rotate,
              width: '52px',
              height: '72px',
              background: '#0a0600',
              border: '2px solid #1a1000',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: pos.id * 0.03 + 0.2, duration: 0.5 }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: '18px', color: '#2a1800' }}>?</div>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '3px',
              color: '#1e1000',
              letterSpacing: '0.5px',
              marginTop: '4px',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              MURDER<br />IN KUET
            </div>
          </motion.div>
        ))}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.85) 100%)' }}
      />

      {/* Main panel */}
      <motion.div
        className="relative z-10"
        style={{
          background: '#060400',
          border: '4px solid #5c3d00',
          boxShadow: '8px 8px 0 #1a0f00, 0 0 40px #b8860b22',
          padding: '40px 48px 44px',
          minWidth: '420px',
          maxWidth: '90vw',
        }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Corner pixels */}
        {['top-1.5 left-1.5', 'top-1.5 right-1.5', 'bottom-1.5 left-1.5', 'bottom-1.5 right-1.5'].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-2 h-2`} style={{ background: '#b8860b' }} />
        ))}

        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            className="font-pixel"
            style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '3px', marginBottom: '8px' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            ─── CASE FILES ───
          </motion.div>
          <motion.h2
            className="font-pixel"
            style={{
              fontSize: 'clamp(11px, 2vw, 16px)',
              color: '#e8c060',
              letterSpacing: '4px',
              textShadow: '3px 3px 0 #3d2200',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            PLAYER CARDS
          </motion.h2>
        </div>

        {/* Divider */}
        <div style={{
          height: '2px',
          background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
          marginBottom: '24px',
        }} />

        {/* Player menu items */}
        <div className="flex flex-col gap-2">
          {players.map((player, i) => {
            const isSelected = selected === i
            const handSize = deal.playerHands[i]?.length ?? 0
            return (
              <motion.div
                key={i}
                className="flex items-center gap-3 cursor-pointer px-3 py-3"
                style={{
                  background: isSelected ? 'rgba(92,60,0,0.35)' : 'transparent',
                  border: isSelected ? `2px solid ${player.character.accentColor}44` : '2px solid transparent',
                  transition: 'background 0.15s, border 0.15s',
                }}
                onMouseEnter={() => setSelected(i)}
                onClick={handleConfirm}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
              >
                {/* Dagger cursor */}
                <div style={{ width: '20px', flexShrink: 0 }}>
                  <PixelCursor visible={isSelected} />
                </div>

                {/* Character icon */}
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  color: player.character.accentColor,
                  textShadow: isSelected ? `0 0 8px ${player.character.accentColor}88` : 'none',
                  transition: 'text-shadow 0.2s',
                  flexShrink: 0,
                }}>
                  {player.character.icon}
                </span>

                {/* Label */}
                <div className="flex flex-col flex-1">
                  <motion.span
                    className="font-pixel"
                    style={{ fontSize: 'clamp(7px, 1.4vw, 10px)', letterSpacing: '1.5px' }}
                    animate={isSelected
                      ? { color: ['#ffdd00', '#ffaa00', '#ffdd00'] }
                      : { color: '#6b5030' }
                    }
                    transition={{ duration: 1.2, repeat: isSelected ? Infinity : 0 }}
                  >
                    SHOW {player.character.name}&apos;S CARDS
                  </motion.span>
                  <span className="font-pixel" style={{
                    fontSize: '5px',
                    color: isSelected ? '#8b6b3a' : '#3d2a00',
                    marginTop: '3px',
                    letterSpacing: '1px',
                  }}>
                    P{i + 1}  ·  {player.type.toUpperCase()}  ·  {handSize} CARDS
                  </span>
                </div>

                {/* Right indicator */}
                {isSelected && (
                  <motion.span
                    className="font-pixel"
                    style={{ color: '#ffdd00', fontSize: '10px', flexShrink: 0 }}
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

        {/* Divider */}
        <div style={{
          height: '2px',
          background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 8px, transparent 8px, transparent 16px)',
          margin: '24px 0 20px',
        }} />

        {/* START GAME button */}
        {onStart && (
          <motion.div
            className="flex items-center justify-center gap-3 cursor-pointer px-3 py-4 mt-2"
            style={{
              background: '#1a0000',
              border: '2px solid #660000',
              boxShadow: '4px 4px 0 #0d0000',
            }}
            onClick={onStart}
            whileHover={{ background: '#280000', borderColor: '#aa0000', boxShadow: '4px 4px 0 #1a0000, 0 0 16px #880000' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            <motion.span
              className="font-pixel"
              style={{ fontSize: '9px', color: '#cc2222', letterSpacing: '3px' }}
              animate={{ color: ['#cc2222', '#ff4444', '#cc2222'] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              ▶ START GAME
            </motion.span>
          </motion.div>
        )}

        {/* Key hints */}
        <div className="font-pixel text-center mt-3" style={{ fontSize: '5px', color: '#2a1a00', letterSpacing: '1px' }}>
          ↑ ↓  SELECT  &nbsp;|&nbsp;  ENTER  VIEW  &nbsp;|&nbsp;  [S]  START
        </div>
      </motion.div>

      {/* Top label */}
      <motion.div
        className="absolute top-6 left-0 right-0 text-center font-pixel"
        style={{ fontSize: '6px', color: '#2a1600', letterSpacing: '4px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        MURDER IN KUET  —  DEAL COMPLETE
      </motion.div>
    </div>
  )
}
