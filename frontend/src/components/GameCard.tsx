import { motion } from 'framer-motion'
import type { Card } from '../types'

interface GameCardProps {
  card: Card
  faceUp: boolean
  selected?: boolean   // golden case-file glow
  dimmed?: boolean     // other cards during crime selection
  compact?: boolean    // smaller font
  width?: number
  height?: number
  style?: React.CSSProperties
}

export default function GameCard({
  card,
  faceUp,
  selected = false,
  dimmed = false,
  compact = false,
  width = 50,
  height = 68,
  style,
}: GameCardProps) {
  const nameSize  = compact ? 'clamp(3px, 0.5vw, 5px)'  : 'clamp(6px, 0.85vw, 9px)'
  const iconSize  = compact ? 'clamp(12px, 2vw, 22px)'   : 'clamp(16px, 2.5vw, 28px)'
  const catSize   = compact ? 'clamp(2px, 0.35vw, 4px)'  : 'clamp(4px, 0.55vw, 6px)'

  const borderColor = selected
    ? '#b8860b'
    : faceUp
    ? `${card.accentColor}77`
    : '#2a1e00'

  const borderWidth = selected ? '3px' : '2px'

  const glow = selected
    ? `0 0 12px #b8860baa, 3px 3px 0 #000`
    : faceUp
    ? `2px 2px 0 #000`
    : `2px 2px 0 #000`

  return (
    <motion.div
      style={{
        width,
        height,
        border: `${borderWidth} solid ${borderColor}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: dimmed ? 0.28 : 1,
        position: 'relative',
        imageRendering: 'pixelated',
        flexShrink: 0,
        ...style,
      }}
      animate={{ boxShadow: selected
        ? [
            `0 0 18px #b8860bcc, 0 0 6px #ffdd0066, 3px 3px 0 #000`,
            `0 0 44px #ffdd00ee, 0 0 70px #b8860bbb, 3px 3px 0 #000`,
            `0 0 18px #b8860bcc, 0 0 6px #ffdd0066, 3px 3px 0 #000`,
          ]
        : glow
      }}
      transition={selected
        ? { duration: 0.75, repeat: Infinity, ease: 'easeInOut' }
        : { duration: 0.2 }
      }
    >
      {faceUp ? (
        <>
          {/* Face-up: portrait area */}
          <div
            style={{
              flex: 1,
              background: card.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Dot-grid texture */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `radial-gradient(${card.accentColor}1a 1px, transparent 1px)`,
              backgroundSize: '5px 5px',
            }} />
            {/* Horizontal scan */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
            }} />

            {/* Category badge — top-left */}
            <div style={{
              position: 'absolute', top: 2, left: 2,
              fontSize: catSize, fontFamily: "'Press Start 2P', monospace",
              color: card.imageSrc ? '#ffffffcc' : `${card.accentColor}88`,
              lineHeight: 1, letterSpacing: 0, zIndex: 2,
              textShadow: card.imageSrc ? '1px 1px 0 #000' : 'none',
            }}>
              {card.shortName}
            </div>

            {/* Icon / portrait image */}
            {card.imageSrc ? (
              <img
                src={card.imageSrc}
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
              <span style={{
                fontFamily: 'monospace',
                fontSize: iconSize,
                color: card.accentColor,
                textShadow: `0 0 8px ${card.accentColor}88`,
                zIndex: 1,
                lineHeight: 1,
              }}>
                {card.icon}
              </span>
            )}

            {/* Selected sparkle */}
            {selected && (
              <motion.div
                style={{ position: 'absolute', inset: 0, background: 'transparent', border: `1px solid ${card.accentColor}44` }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </div>

          {/* Name strip */}
          <div style={{
            background: '#080500',
            borderTop: `1px solid ${card.accentColor}44`,
            padding: '2px 2px',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: nameSize,
              color: selected ? '#ffdd00' : '#b8860b',
              letterSpacing: '0.3px',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.4,
            }}>
              {card.name.length > 12 ? card.name.slice(0, 11) + '…' : card.name}
            </span>
          </div>
        </>
      ) : (
        /* Face-down back */
        <div style={{
          width: '100%',
          height: '100%',
          background: '#0a0600',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Cross-hatch pattern */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage:
              'repeating-linear-gradient(45deg, #1a1000 0, #1a1000 1px, transparent 0, transparent 50%),' +
              'repeating-linear-gradient(-45deg, #1a1000 0, #1a1000 1px, transparent 0, transparent 50%)',
            backgroundSize: '6px 6px',
          }} />
          {/* Inner border */}
          <div style={{
            position: 'absolute',
            inset: '4px',
            border: '1px solid #2a1c00',
          }} />
          {/* Center symbol */}
          <span style={{
            fontFamily: 'monospace',
            fontSize: compact ? '14px' : '18px',
            color: '#3d2800',
            zIndex: 1,
            lineHeight: 1,
          }}>
            ?
          </span>
          {/* Bottom label */}
          <div style={{
            position: 'absolute',
            bottom: '4px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: compact ? '2px' : '3px',
            color: '#2a1c00',
            letterSpacing: '0.5px',
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            MURDER
            <br />
            IN KUET
          </div>
        </div>
      )}
    </motion.div>
  )
}
