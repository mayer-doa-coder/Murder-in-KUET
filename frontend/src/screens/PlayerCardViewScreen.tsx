import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameCard from '../components/GameCard'
import type { GameDeal, PlayerSetup } from '../types'

interface PlayerCardViewScreenProps {
  playerIndex: number
  players: PlayerSetup[]
  deal: GameDeal
  onBack: () => void
}

export default function PlayerCardViewScreen({ playerIndex, players, deal, onBack }: PlayerCardViewScreenProps) {
  const [vw, setVw] = useState(window.innerWidth)
  const [vh, setVh] = useState(window.innerHeight)
  // ALL cards hidden by default — only show on hold
  const [revealed, setRevealed] = useState(false)

  const player = players[playerIndex]
  const hand   = deal.playerHands[playerIndex] ?? []

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleBack = useCallback(() => { onBack() }, [onBack])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        setRevealed(true)
      }
      if (e.key === 'Escape') handleBack()
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter') setRevealed(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [handleBack])

  // Responsive card sizing: fill ~75% of viewport width across 3 columns
  const GAP = Math.max(8, Math.floor(vw * 0.012))
  const cardW = Math.min(Math.floor((vw * 0.74 - GAP * 2) / 3), 190)
  const cardH = Math.floor(cardW * 1.375)

  const BOTTOM_H = 80
  const groupTop = Math.max(72, Math.floor(vh * 0.14))
  const totalGridH = cardH * 2 + GAP
  const gridFits = groupTop + totalGridH + BOTTOM_H < vh

  const rows = [hand.slice(0, 3), hand.slice(3, 6)]

  return (
    <div
      className="relative w-full h-full flex flex-col items-center overflow-hidden"
      style={{ background: '#030200' }}
      onMouseDown={() => setRevealed(true)}
      onMouseUp={() => setRevealed(false)}
      onMouseLeave={() => setRevealed(false)}
      onTouchStart={() => setRevealed(true)}
      onTouchEnd={() => setRevealed(false)}
    >
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)',
      }} />

      {/* CRT scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)',
        zIndex: 40,
      }} />

      {/* Header — compact */}
      <motion.div
        className="relative z-10 text-center"
        style={{ marginTop: Math.floor(vh * 0.04), marginBottom: Math.floor(vh * 0.03) }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="font-pixel" style={{ fontSize: '9px', color: '#4a3010', letterSpacing: '3px', marginBottom: '8px' }}>
          ─── PRIVATE FILES ───
        </div>
        <div className="flex items-center justify-center gap-3">
          {player.character.imageSrc ? (
            <img
              src={player.character.imageSrc}
              style={{
                width: Math.min(26, Math.floor(vw * 0.022)) + 'px',
                height: Math.min(26, Math.floor(vw * 0.022)) + 'px',
                imageRendering: 'pixelated',
                objectFit: 'contain',
                filter: `drop-shadow(0 0 5px ${player.character.accentColor}77)`,
              }}
            />
          ) : (
            <span style={{
              fontFamily: 'monospace',
              fontSize: Math.min(26, Math.floor(vw * 0.022)) + 'px',
              color: player.character.accentColor,
              textShadow: `0 0 10px ${player.character.accentColor}77`,
            }}>
              {player.character.icon}
            </span>
          )}
          <h2 className="font-pixel" style={{
            fontSize: 'clamp(18px, 3vw, 26px)',
            color: '#e8c060',
            letterSpacing: '3px',
            textShadow: '3px 3px 0 #3d2200',
          }}>
            {player.character.name}&apos;S CARDS
          </h2>
        </div>
      </motion.div>

      {/* Card grid — 2 rows × 3 cols, fills screen */}
      <motion.div
        className="relative z-10 flex flex-col"
        style={{ gap: GAP }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', gap: GAP, justifyContent: 'center' }}>
            {row.map((card, colIdx) => {
              const cardIdx = rowIdx * 3 + colIdx
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + cardIdx * 0.06, duration: 0.35 }}
                >
                  {/* AnimatePresence handles face-up/face-down swap */}
                  <AnimatePresence mode="wait" initial={false}>
                    {revealed ? (
                      <motion.div
                        key="face-up"
                        initial={{ scaleX: 0, opacity: 0.6 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        exit={{ scaleX: 0, opacity: 0.6 }}
                        transition={{ duration: 0.12, ease: 'easeInOut' }}
                      >
                        <GameCard card={card} faceUp={true} width={cardW} height={cardH} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="face-down"
                        initial={{ scaleX: 0, opacity: 0.6 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        exit={{ scaleX: 0, opacity: 0.6 }}
                        transition={{ duration: 0.12, ease: 'easeInOut' }}
                      >
                        <GameCard card={card} faceUp={false} width={cardW} height={cardH} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        ))}
      </motion.div>

      {/* Instructions — tight to cards */}
      <motion.div
        className="relative z-10 text-center"
        style={{ marginTop: gridFits ? GAP * 2 : GAP }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="hint-hold"
              className="font-pixel"
              style={{ fontSize: 'clamp(9px, 1.2vw, 11px)', color: '#d4982a', letterSpacing: '2px' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              initial={{ opacity: 0 }}
              exit={{ opacity: 0 }}
            >
              HOLD  [ENTER]  TO  REVEAL  ALL  &nbsp;|&nbsp;  ESC  —  BACK
            </motion.div>
          ) : (
            <motion.div
              key="hint-revealed"
              className="font-pixel"
              style={{ fontSize: 'clamp(9px, 1.2vw, 11px)', color: '#cc8833', letterSpacing: '2px' }}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              ★  CARDS  REVEALED  ★  &nbsp;|&nbsp;  ESC  —  BACK
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Player badge — top right */}
      <motion.div
        className="absolute top-3 right-3 z-20 font-pixel"
        style={{
          background: '#1a0e00',
          border: `2px solid ${player.character.accentColor}bb`,
          padding: '5px 9px',
          fontSize: '8px',
          color: player.character.accentColor,
          letterSpacing: '1px',
          textShadow: `0 0 8px ${player.character.accentColor}99`,
        }}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        P{playerIndex + 1} · {player.type.toUpperCase()}
      </motion.div>

      {/* Back button — top left */}
      <motion.button
        className="absolute top-3 left-3 z-20 font-pixel"
        style={{
          background: '#1a0800',
          border: '2px solid #3d2000',
          color: '#6b4020',
          padding: '6px 10px',
          fontSize: '8px',
          letterSpacing: '1px',
          cursor: 'pointer',
        }}
        onClick={handleBack}
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        whileHover={{ backgroundColor: '#2a1000', color: '#aa6030' }}
        whileTap={{ scale: 0.95 }}
      >
        ◀ BACK
      </motion.button>
    </div>
  )
}
