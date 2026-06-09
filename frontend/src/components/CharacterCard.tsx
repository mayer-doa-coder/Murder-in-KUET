import { motion } from 'framer-motion'
import type { Character } from '../types'

export type CardState = 'normal' | 'highlighted' | 'taken' | 'active'

interface CharacterCardProps {
  character: Character
  cardState?: CardState
  onClick?: () => void
  onHover?: () => void
  compact?: boolean
}

export default function CharacterCard({
  character,
  cardState = 'normal',
  onClick,
  onHover,
  compact = false,
}: CharacterCardProps) {
  const isTaken      = cardState === 'taken'
  const isHighlighted = cardState === 'highlighted'
  const isActive     = cardState === 'active'

  const borderColor = isHighlighted
    ? character.accentColor
    : isActive
    ? '#b8860b'
    : isTaken
    ? '#1e1e1e'
    : `${character.borderColor}88`

  const borderWidth = isHighlighted || isActive ? '4px' : '3px'

  const shadow = isHighlighted
    ? `0 0 18px ${character.accentColor}99, 4px 4px 0 #000`
    : isActive
    ? `0 0 14px #b8860baa, 4px 4px 0 #000`
    : `3px 3px 0 #000`

  return (
    <motion.div
      onClick={isTaken ? undefined : onClick}
      onHoverStart={isTaken ? undefined : onHover}
      style={{
        width: '100%',
        height: '100%',
        border: `${borderWidth} solid ${borderColor}`,
        boxShadow: shadow,
        cursor: isTaken ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        imageRendering: 'pixelated',
      }}
      animate={{ scale: isHighlighted ? 1.04 : 1 }}
      transition={{ duration: 0.12 }}
      whileHover={!isTaken ? { scale: isHighlighted ? 1.04 : 1.03 } : {}}
    >
      {/* Portrait area */}
      <div
        style={{
          flex: 1,
          background: isTaken ? '#0a0a0a' : character.bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle dot-grid texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(${character.accentColor}18 1px, transparent 1px)`,
            backgroundSize: '6px 6px',
          }}
        />

        {/* Scanline pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
          }}
        />

        {/* Character portrait */}
        {character.imageSrc && !isTaken ? (
          <img
            src={character.imageSrc}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              imageRendering: 'pixelated',
              objectFit: 'cover',
              zIndex: 0,
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: compact ? 'clamp(20px, 3vw, 36px)' : 'clamp(28px, 4.5vw, 52px)',
              color: isTaken ? '#2a2a2a' : character.accentColor,
              textShadow: isTaken ? 'none' : `0 0 12px ${character.accentColor}99`,
              zIndex: 1,
              lineHeight: 1,
            }}
          >
            {character.icon}
          </span>
        )}

        {/* Taken overlay */}
        {isTaken && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <span
              className="font-pixel"
              style={{ fontSize: compact ? '8px' : '11px', color: '#333', letterSpacing: '1px' }}
            >
              TAKEN
            </span>
          </div>
        )}

        {/* Active badge */}
        {isActive && (
          <motion.div
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: compact ? '12px' : '16px',
              height: compact ? '12px' : '16px',
              background: '#b8860b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: compact ? '6px' : '8px',
              color: '#000',
              fontFamily: 'monospace',
              zIndex: 3,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            ✓
          </motion.div>
        )}

        {/* Animated border pulse for highlighted */}
        {isHighlighted && (
          <motion.div
            style={{
              position: 'absolute',
              inset: -1,
              border: `2px solid ${character.accentColor}`,
              pointerEvents: 'none',
              zIndex: 4,
            }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        )}
      </div>

      {/* Name strip */}
      <div
        style={{
          background: isTaken ? '#080808' : '#0a0700',
          borderTop: `2px solid ${isTaken ? '#1a1a1a' : character.borderColor + '88'}`,
          padding: compact ? '5px 4px' : '8px 6px',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <span
          className="font-pixel"
          style={{
            fontSize: compact ? 'clamp(7px, 0.9vw, 10px)' : 'clamp(8px, 1vw, 11px)',
            color: isTaken ? '#2a2a2a' : '#b8860b',
            letterSpacing: '0.5px',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {character.name}
        </span>
      </div>
    </motion.div>
  )
}
