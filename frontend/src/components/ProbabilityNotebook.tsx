import { motion } from 'framer-motion'
import type { ProbabilityData } from '../types'
import { SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS } from '../types'
import type { AIAlgorithm } from '../types'
import { AI_ALGORITHM_LABELS } from '../types'

interface Props {
  data:      ProbabilityData
  algorithm: AIAlgorithm
  compact?:  boolean          // true = sidebar mode (narrower)
  onClose?:  () => void
}

function ProbBar({ prob, color, isTop }: { prob: number; color: string; isTop: boolean }) {
  const pct = Math.round(prob * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <div style={{
        flex: 1, height: 4, background: '#111118', position: 'relative', overflow: 'hidden',
        border: `1px solid ${isTop ? color + '55' : '#1a1a2a'}`,
      }}>
        <motion.div
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: color, opacity: isTop ? 1 : 0.45 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="font-pixel" style={{
        fontSize: '5px',
        color: isTop ? color : '#555566',
        width: 22, textAlign: 'right', flexShrink: 0,
        fontWeight: isTop ? 'bold' : 'normal',
      }}>
        {pct}%
      </div>
    </div>
  )
}

interface CardRowProps {
  icon:       string
  name:       string
  accentColor: string
  prob:       number
  isTop:      boolean
  compact:    boolean
}

function CardRow({ icon, name, accentColor, prob, isTop, compact }: CardRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: `${compact ? 3 : 4}px 0`,
      borderBottom: '1px solid #0d0d1a',
      background: isTop ? `${accentColor}08` : 'transparent',
    }}>
      <span style={{
        fontFamily: 'monospace', fontSize: compact ? 10 : 12,
        color: isTop ? accentColor : '#444455',
        width: compact ? 14 : 16, flexShrink: 0, textAlign: 'center',
        lineHeight: 1,
        textShadow: isTop ? `0 0 5px ${accentColor}77` : 'none',
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-pixel" style={{
          fontSize: compact ? '4px' : '5px',
          color: isTop ? accentColor : '#445',
          letterSpacing: '0.3px',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          marginBottom: 2,
        }}>
          {name.toUpperCase().slice(0, compact ? 12 : 18)}
          {isTop && <span style={{ marginLeft: 3, color: '#ffdd00' }}>★</span>}
        </div>
        <ProbBar prob={prob} color={accentColor} isTop={isTop} />
      </div>
    </div>
  )
}

function Section({
  title, cards, states, compact,
}: {
  title: string
  cards: { id: string; name: string; icon: string; accentColor: string }[]
  states: Record<string, number>
  compact: boolean
}) {
  const sorted = [...cards].sort((a, b) => (states[b.id] ?? 0) - (states[a.id] ?? 0))
  const topId = sorted[0]?.id

  return (
    <div style={{ marginBottom: compact ? 8 : 12 }}>
      <div className="font-pixel" style={{
        fontSize: compact ? '5px' : '6px', color: '#44cc88', letterSpacing: '1.5px',
        marginBottom: 4, paddingBottom: 3, borderBottom: '1px solid #1a3322',
      }}>
        ── {title}
      </div>
      {(compact ? sorted.slice(0, 3) : sorted).map(card => (
        <CardRow
          key={card.id}
          icon={card.icon}
          name={card.name}
          accentColor={card.accentColor}
          prob={states[card.id] ?? 0}
          isTop={card.id === topId && (states[topId] ?? 0) > 0}
          compact={compact}
        />
      ))}
      {compact && sorted.length > 3 && (
        <div className="font-pixel" style={{ fontSize: '4px', color: '#333344', letterSpacing: '0.5px', paddingTop: 3 }}>
          +{sorted.length - 3} more
        </div>
      )}
    </div>
  )
}

export default function ProbabilityNotebook({ data, algorithm, compact = false, onClose }: Props) {
  const algoColor = {
    random: '#888', rule_based: '#44cc88', minimax: '#4488ff',
    expectiminimax: '#cc88ff', negamax: '#44aaff', monte_carlo: '#ffaa44', mcts: '#ff6644',
  }[algorithm] ?? '#44cc88'

  if (compact) {
    // Sidebar-embedded mode — no container chrome
    return (
      <div style={{ padding: '0 0 8px' }}>
        {/* Algorithm badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', background: `${algoColor}11`,
          border: `1px solid ${algoColor}33`, marginBottom: 8,
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: algoColor }}>⊛</span>
          <div>
            <div className="font-pixel" style={{ fontSize: '5px', color: algoColor, letterSpacing: '1px' }}>
              {AI_ALGORITHM_LABELS[algorithm]}
            </div>
            <div className="font-pixel" style={{ fontSize: '4px', color: '#886633', letterSpacing: '0.5px', marginTop: 2 }}>
              AI NOTEBOOK
            </div>
          </div>
        </div>

        <Section title="SUSPECTS"  cards={SUSPECTS_CARDS}  states={data.suspects}  compact />
        <Section title="WEAPONS"   cards={WEAPONS_CARDS}   states={data.weapons}   compact />
        <Section title="LOCATIONS" cards={LOCATIONS_CARDS} states={data.locations} compact />
      </div>
    )
  }

  // Full overlay mode
  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 46,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'linear' }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <motion.div
        style={{
          background: '#040a06',
          border: `2px solid ${algoColor}55`,
          boxShadow: `0 0 60px ${algoColor}22`,
          padding: '22px 26px',
          width: '90%', maxWidth: 480,
          maxHeight: '88vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'linear' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${algoColor}33`,
        }}>
          <div>
            <div className="font-pixel" style={{ fontSize: '9px', color: algoColor, letterSpacing: '3px' }}>
              AI PROBABILITY NOTEBOOK
            </div>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#336644', letterSpacing: '0.8px', marginTop: 5 }}>
              {AI_ALGORITHM_LABELS[algorithm]} · ★ = MOST LIKELY CASE FILE CARD
            </div>
          </div>
          {onClose && (
            <motion.button
              className="font-pixel"
              style={{
                background: 'transparent', border: `1px solid ${algoColor}55`,
                color: algoColor, fontSize: '7px', padding: '5px 10px',
                cursor: 'pointer', letterSpacing: '1px', flexShrink: 0,
              }}
              whileHover={{ background: `${algoColor}22` }}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.06 }}
              onClick={onClose}
            >
              ✕ CLOSE
            </motion.button>
          )}
        </div>

        <Section title="SUSPECTS"  cards={SUSPECTS_CARDS}  states={data.suspects}  compact={false} />
        <Section title="WEAPONS"   cards={WEAPONS_CARDS}   states={data.weapons}   compact={false} />
        <Section title="LOCATIONS" cards={LOCATIONS_CARDS} states={data.locations} compact={false} />
      </motion.div>
    </motion.div>
  )
}
