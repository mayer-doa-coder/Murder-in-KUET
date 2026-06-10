import { motion } from 'framer-motion'

interface Props {
  icon: string
  imageSrc?: string
  name: string
  shortName: string
  bgColor: string
  accentColor: string
  isSelected: boolean
  onClick: () => void
}

export default function SelectionCard({
  icon, imageSrc, name, bgColor, accentColor, isSelected, onClick,
}: Props) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        background: bgColor,
        border: isSelected ? `3px solid ${accentColor}` : '2px solid #3d2200',
        outline: isSelected ? `1px solid ${accentColor}55` : 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 0,
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isSelected
          ? `0 0 18px ${accentColor}55, inset 0 0 20px rgba(0,0,0,0.3)`
          : 'inset 0 0 24px rgba(0,0,0,0.55)',
        aspectRatio: '0.62',
      }}
      whileHover={{ scale: 1.04, zIndex: 2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.08, ease: 'linear' }}
    >
      {/* Dot-grid background texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '7px 7px',
      }} />

      {/* Scan-line overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
      }} />

      {/* Checkmark badge when selected */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.12, ease: 'linear' }}
          style={{
            position: 'absolute', top: 4, right: 5,
            fontFamily: 'monospace', fontSize: 12,
            color: '#ffdd00', lineHeight: 1, zIndex: 4,
          }}
        >✓</motion.div>
      )}

      {/* Portrait image area — fills most of the card */}
      <div style={{
        width: '100%', flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', zIndex: 2,
      }}>
        {imageSrc ? (
          <img
            src={imageSrc}
            style={{
              width: '100%',
              height: '100%',
              imageRendering: 'pixelated',
              objectFit: 'cover',
              display: 'block',
              filter: isSelected ? `drop-shadow(0 0 8px ${accentColor})` : 'none',
            }}
          />
        ) : (
          <span style={{
            fontFamily: 'monospace',
            fontSize: 34,
            color: accentColor,
            lineHeight: 1,
            textShadow: isSelected ? `0 0 12px ${accentColor}99` : 'none',
          }}>
            {icon}
          </span>
        )}
      </div>

      {/* Name strip */}
      <div style={{
        width: '100%',
        background: 'rgba(0,0,0,0.72)',
        borderTop: `1px solid ${accentColor}33`,
        padding: '4px 5px',
        zIndex: 3, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="font-pixel" style={{
          fontSize: '5px',
          color: isSelected ? '#ffdd00' : accentColor,
          letterSpacing: '0.4px',
          textAlign: 'center',
          lineHeight: 1.5,
          whiteSpace: 'pre-line',
        }}>
          {name.toUpperCase()}
        </div>
      </div>
    </motion.button>
  )
}
