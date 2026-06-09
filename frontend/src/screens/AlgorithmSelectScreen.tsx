import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { AIAlgorithm } from '../types'
import { ALL_ALGORITHMS, AI_ALGORITHM_LABELS } from '../types'

interface Props {
  playerCount: number
  onConfirm: (algorithms: AIAlgorithm[]) => void
}

const ALGO_COLORS: Record<AIAlgorithm, string> = {
  random:         '#886633',
  rule_based:     '#b8860b',
  minimax:        '#cc9933',
  expectiminimax: '#e8c060',
  negamax:        '#aa7722',
  monte_carlo:    '#d4a030',
  mcts:           '#ffdd00',
}

export default function AlgorithmSelectScreen({ playerCount, onConfirm }: Props) {
  const [algorithms, setAlgorithms] = useState<AIAlgorithm[]>(
    () => Array.from({ length: playerCount }, () => 'rule_based' as AIAlgorithm)
  )
  const [selectedPlayer, setSelectedPlayer] = useState(0)

  const cycleAlgo = useCallback((pi: number, dir: 1 | -1) => {
    setAlgorithms(prev => prev.map((a, i) => {
      if (i !== pi) return a
      const idx = ALL_ALGORITHMS.indexOf(a)
      return ALL_ALGORITHMS[(idx + dir + ALL_ALGORITHMS.length) % ALL_ALGORITHMS.length]
    }))
  }, [])

  const handleConfirm = useCallback(() => onConfirm(algorithms), [algorithms, onConfirm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setSelectedPlayer(p => Math.max(0, p - 1)) }
      if (e.key === 'ArrowRight') { e.preventDefault(); setSelectedPlayer(p => Math.min(playerCount - 1, p + 1)) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); cycleAlgo(selectedPlayer, -1) }
      if (e.key === 'ArrowDown')  { e.preventDefault(); cycleAlgo(selectedPlayer,  1) }
      if (e.key === 'Enter')      handleConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPlayer, cycleAlgo, handleConfirm, playerCount])

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#060400' }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(60,40,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(60,40,0,0.06) 1px,transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)',
      }} />

      {/* Title */}
      <motion.div
        className="relative z-10 text-center mb-10"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="font-pixel"
          style={{ fontSize: '9px', color: '#aa6622', letterSpacing: '4px', marginBottom: 12, textShadow: '0 0 10px #aa662244' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ─── AI VS AI ───
        </motion.div>

        <div className="font-pixel" style={{
          fontSize: 'clamp(18px, 3vw, 26px)',
          color: '#e8c060',
          letterSpacing: '3px',
          textShadow: '3px 3px 0 #3d2200, 0 0 24px #b8860b55',
        }}>
          SELECT AI ALGORITHM
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 6px, transparent 6px, transparent 12px)' }} />
          <span className="font-pixel" style={{ color: '#8b0000', fontSize: '10px' }}>✦</span>
          <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #3d2200 0, #3d2200 6px, transparent 6px, transparent 12px)' }} />
        </div>
      </motion.div>

      {/* ── Player columns — left P1, right last player ── */}
      <div
        className="relative z-10"
        style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '660px', padding: '0 24px' }}
      >
        {Array.from({ length: playerCount }, (_, pi) => {
          const isActive  = pi === selectedPlayer
          const algo      = algorithms[pi]
          const algoColor = ALGO_COLORS[algo]
          const algoIdx   = ALL_ALGORITHMS.indexOf(algo)
          const prevAlgo  = ALL_ALGORITHMS[(algoIdx - 1 + ALL_ALGORITHMS.length) % ALL_ALGORITHMS.length]
          const nextAlgo  = ALL_ALGORITHMS[(algoIdx + 1) % ALL_ALGORITHMS.length]

          return (
            <motion.div
              key={pi}
              onClick={() => setSelectedPlayer(pi)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: isActive ? 'rgba(30,18,0,0.92)' : 'rgba(14,9,0,0.6)',
                border: `2px solid ${isActive ? '#b8860b' : '#2a1800'}`,
                padding: '14px 6px',
                cursor: 'pointer',
                boxShadow: isActive ? '0 0 22px #b8860b55, 3px 3px 0 #000' : '2px 2px 0 #000',
                transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s',
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.07, duration: 0.35 }}
            >
              {/* Player label */}
              <div style={{ textAlign: 'center' }}>
                <div className="font-pixel" style={{
                  fontSize: '11px',
                  color: isActive ? '#e8c060' : '#886633',
                  letterSpacing: '2px',
                }}>
                  P{pi + 1}
                </div>
                <div className="font-pixel" style={{
                  fontSize: '7px',
                  color: '#5c3d00',
                  letterSpacing: '1px',
                  marginTop: '3px',
                }}>
                  AI
                </div>
              </div>

              {/* Active blink */}
              <motion.span
                className="font-pixel"
                style={{ fontSize: '8px', color: '#ffdd00', height: '12px' }}
                animate={isActive ? { opacity: [1, 0.2, 1] } : { opacity: 0 }}
                transition={isActive ? { duration: 0.55, repeat: Infinity, ease: 'linear' } : { duration: 0.15 }}
              >●</motion.span>

              {/* Prev algorithm (ghost) */}
              <div className="font-pixel" style={{
                fontSize: '7px',
                color: isActive ? '#664422' : '#3d2200',
                letterSpacing: '0.5px',
                textAlign: 'center',
                minHeight: '12px',
              }}>
                {AI_ALGORITHM_LABELS[prevAlgo]}
              </div>

              {/* Up arrow */}
              <motion.button
                onClick={e => { e.stopPropagation(); setSelectedPlayer(pi); cycleAlgo(pi, -1) }}
                className="font-pixel"
                style={{
                  background: 'transparent', border: 'none',
                  color: '#886633', fontSize: '11px',
                  cursor: 'pointer', padding: 0, lineHeight: 1,
                }}
                whileHover={{ color: '#ffdd00' }}
                whileTap={{ scale: 0.9 }}
              >▲</motion.button>

              {/* Current algorithm box */}
              <motion.div
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.5)',
                  border: `2px solid ${algoColor}66`,
                  padding: '10px 4px',
                  textAlign: 'center',
                  boxShadow: isActive ? `0 0 12px ${algoColor}44` : 'none',
                  minHeight: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                animate={isActive ? { borderColor: [`${algoColor}44`, `${algoColor}99`, `${algoColor}44`] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <div className="font-pixel" style={{
                  fontSize: '8px',
                  color: algoColor,
                  letterSpacing: '1px',
                  textShadow: isActive ? `0 0 8px ${algoColor}88` : 'none',
                  lineHeight: 1.6,
                  wordBreak: 'break-word' as const,
                }}>
                  {AI_ALGORITHM_LABELS[algo]}
                </div>
              </motion.div>

              {/* Down arrow */}
              <motion.button
                onClick={e => { e.stopPropagation(); setSelectedPlayer(pi); cycleAlgo(pi, 1) }}
                className="font-pixel"
                style={{
                  background: 'transparent', border: 'none',
                  color: '#886633', fontSize: '11px',
                  cursor: 'pointer', padding: 0, lineHeight: 1,
                }}
                whileHover={{ color: '#ffdd00' }}
                whileTap={{ scale: 0.9 }}
              >▼</motion.button>

              {/* Next algorithm (ghost) */}
              <div className="font-pixel" style={{
                fontSize: '7px',
                color: isActive ? '#664422' : '#3d2200',
                letterSpacing: '0.5px',
                textAlign: 'center',
                minHeight: '12px',
              }}>
                {AI_ALGORITHM_LABELS[nextAlgo]}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Confirm + hint */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4"
        style={{ marginTop: 28 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          onClick={handleConfirm}
          className="font-pixel"
          style={{
            background: '#3d2200',
            border: '3px solid #7a4c00',
            color: '#e8c060',
            padding: '12px 36px',
            fontSize: '11px',
            letterSpacing: '2px',
            cursor: 'pointer',
            boxShadow: '4px 4px 0 #1a0f00',
          }}
          animate={{ boxShadow: ['4px 4px 0 #1a0f00, 0 0 8px #b8860b44', '4px 4px 0 #1a0f00, 0 0 22px #b8860b99', '4px 4px 0 #1a0f00, 0 0 8px #b8860b44'] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          whileHover={{ y: -2, borderColor: '#b8860b' }}
          whileTap={{ y: 4 }}
        >
          ► CONFIRM
        </motion.button>

        <motion.div
          className="font-pixel text-center"
          style={{ fontSize: '9px', color: '#cc8833', letterSpacing: '2px', textShadow: '0 0 8px #cc883344' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          ←→ PLAYER · ↑↓ ALGORITHM · ENTER CONFIRM
        </motion.div>
      </motion.div>
    </div>
  )
}
