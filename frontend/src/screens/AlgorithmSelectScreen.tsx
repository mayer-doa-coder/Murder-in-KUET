import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { AIAlgorithm } from '../types'
import { ALL_ALGORITHMS, AI_ALGORITHM_LABELS } from '../types'

interface Props {
  playerCount: number
  onConfirm: (algorithms: AIAlgorithm[]) => void
}

const ALGO_DESCS: Record<AIAlgorithm, string> = {
  random:         'picks moves at random',
  rule_based:     'uses notebook heuristics',
  minimax:        'adversarial tree search',
  expectiminimax: 'chance-node minimax',
  negamax:        'alpha-beta negation',
  monte_carlo:    'random playout sampling',
  mcts:           'UCT bandit selection',
}

const ALGO_COLORS: Record<AIAlgorithm, string> = {
  random:         '#888888',
  rule_based:     '#44cc88',
  minimax:        '#4488ff',
  expectiminimax: '#cc88ff',
  negamax:        '#44aaff',
  monte_carlo:    '#ffaa44',
  mcts:           '#ff6644',
}

const PLAYER_COLORS = ['#4477ff', '#33aa33', '#cc2200', '#cc8800', '#cc00cc', '#00cccc']

export default function AlgorithmSelectScreen({ playerCount, onConfirm }: Props) {
  const [algorithms, setAlgorithms] = useState<AIAlgorithm[]>(
    () => Array.from({ length: playerCount }, () => 'rule_based' as AIAlgorithm)
  )
  const [selectedPlayer, setSelectedPlayer] = useState(0)

  const setAlgo = useCallback((pi: number, algo: AIAlgorithm) => {
    setAlgorithms(prev => prev.map((a, i) => i === pi ? algo : a))
  }, [])

  const handleConfirm = useCallback(() => {
    onConfirm(algorithms)
  }, [algorithms, onConfirm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedPlayer(p => Math.max(0, p - 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedPlayer(p => Math.min(playerCount - 1, p + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setAlgorithms(prev => prev.map((a, i) => {
          if (i !== selectedPlayer) return a
          const idx = ALL_ALGORITHMS.indexOf(a)
          return ALL_ALGORITHMS[Math.max(0, idx - 1)]
        }))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setAlgorithms(prev => prev.map((a, i) => {
          if (i !== selectedPlayer) return a
          const idx = ALL_ALGORITHMS.indexOf(a)
          return ALL_ALGORITHMS[Math.min(ALL_ALGORITHMS.length - 1, idx + 1)]
        }))
      } else if (e.key === 'Enter') {
        handleConfirm()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPlayer, handleConfirm])

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
        className="relative z-10 text-center mb-8"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="font-pixel" style={{ fontSize: '7px', color: '#5c3d00', letterSpacing: '3px', marginBottom: 8 }}>
          ─── AI VS AI ───
        </div>
        <div className="font-pixel" style={{
          fontSize: 'clamp(10px,1.8vw,14px)',
          color: '#e8c060',
          letterSpacing: '3px',
          textShadow: '3px 3px 0 #3d2200',
        }}>
          SELECT AI ALGORITHM
        </div>
      </motion.div>

      {/* Player rows */}
      <div
        className="relative z-10 flex flex-col gap-3"
        style={{ width: '100%', maxWidth: 600, padding: '0 24px' }}
      >
        {Array.from({ length: playerCount }, (_, pi) => {
          const isActive  = pi === selectedPlayer
          const algo      = algorithms[pi]
          const algoColor = ALGO_COLORS[algo]
          const pColor    = PLAYER_COLORS[pi] ?? '#b8860b'
          const algoIdx   = ALL_ALGORITHMS.indexOf(algo)

          return (
            <motion.div
              key={pi}
              onClick={() => setSelectedPlayer(pi)}
              style={{
                background: isActive ? 'rgba(30,18,0,0.9)' : 'rgba(14,9,0,0.6)',
                border: `2px solid ${isActive ? pColor : '#2a1800'}`,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                boxShadow: isActive ? `0 0 18px ${pColor}33` : 'none',
              }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: pi * 0.07, duration: 0.35 }}
            >
              {/* Player label */}
              <div style={{ minWidth: 44 }}>
                <div className="font-pixel" style={{ fontSize: '7px', color: pColor, letterSpacing: '1px', marginBottom: 3 }}>
                  P{pi + 1}
                </div>
                <div className="font-pixel" style={{ fontSize: '5px', color: '#886633', letterSpacing: '0.5px' }}>
                  AI
                </div>
              </div>

              {/* Algorithm selector */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Prev arrow */}
                <motion.button
                  onClick={e => { e.stopPropagation(); setSelectedPlayer(pi); setAlgo(pi, ALL_ALGORITHMS[Math.max(0, algoIdx - 1)]) }}
                  className="font-pixel"
                  style={{
                    background: 'transparent', border: 'none',
                    color: algoIdx > 0 ? '#886633' : '#2a1800',
                    fontSize: '9px', cursor: algoIdx > 0 ? 'pointer' : 'default',
                    padding: '0 4px', lineHeight: 1,
                  }}
                  whileHover={algoIdx > 0 ? { color: '#ffdd00' } : {}}
                >◄</motion.button>

                {/* Current algorithm */}
                <div style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${algoColor}44`,
                  padding: '6px 10px',
                  textAlign: 'center',
                }}>
                  <div className="font-pixel" style={{
                    fontSize: '7px',
                    color: algoColor,
                    letterSpacing: '1px',
                    textShadow: `0 0 6px ${algoColor}66`,
                    marginBottom: 3,
                  }}>
                    {AI_ALGORITHM_LABELS[algo]}
                  </div>
                  <div className="font-pixel" style={{ fontSize: '5px', color: '#886633', letterSpacing: '0.5px' }}>
                    {ALGO_DESCS[algo]}
                  </div>
                </div>

                {/* Next arrow */}
                <motion.button
                  onClick={e => { e.stopPropagation(); setSelectedPlayer(pi); setAlgo(pi, ALL_ALGORITHMS[Math.min(ALL_ALGORITHMS.length - 1, algoIdx + 1)]) }}
                  className="font-pixel"
                  style={{
                    background: 'transparent', border: 'none',
                    color: algoIdx < ALL_ALGORITHMS.length - 1 ? '#886633' : '#2a1800',
                    fontSize: '9px', cursor: algoIdx < ALL_ALGORITHMS.length - 1 ? 'pointer' : 'default',
                    padding: '0 4px', lineHeight: 1,
                  }}
                  whileHover={algoIdx < ALL_ALGORITHMS.length - 1 ? { color: '#ffdd00' } : {}}
                >►</motion.button>
              </div>

              {/* Active indicator */}
              {isActive && (
                <motion.span
                  className="font-pixel"
                  style={{ fontSize: '7px', color: '#ffdd00', flexShrink: 0 }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                >●</motion.span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Confirm */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-3"
        style={{ marginTop: 24 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          onClick={handleConfirm}
          className="font-pixel"
          style={{
            background: '#3d2200', border: '3px solid #7a4c00',
            color: '#e8c060', padding: '10px 28px',
            fontSize: '9px', letterSpacing: '2px',
            cursor: 'pointer', boxShadow: '4px 4px 0 #1a0f00',
          }}
          animate={{ boxShadow: ['4px 4px 0 #1a0f00, 0 0 8px #b8860b44', '4px 4px 0 #1a0f00, 0 0 18px #b8860b99', '4px 4px 0 #1a0f00, 0 0 8px #b8860b44'] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          whileHover={{ y: -2 }}
          whileTap={{ y: 4 }}
        >
          ► CONFIRM ALGORITHMS
        </motion.button>
        <div className="font-pixel" style={{ fontSize: '6px', color: '#2e1e00', letterSpacing: '1px' }}>
          ↑↓ PLAYER · ←→ ALGORITHM · ENTER CONFIRM
        </div>
      </motion.div>
    </div>
  )
}
