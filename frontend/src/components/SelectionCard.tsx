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
  icon, imageSrc, name, shortName, bgColor, accentColor, isSelected, onClick,
}: Props) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        background: bgColor,
        border: isSelected ? '3px dashed #aaaaaa' : '2px solid #3d2200',
        outline: isSelected ? '1px solid #555' : 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '10px 6px 8px',
        position: 'relative',
        boxShadow: isSelected
          ? `0 0 10px ${accentColor}44, inset 0 0 20px rgba(0,0,0,0.35)`
          : 'inset 0 0 20px rgba(0,0,0,0.45)',
        minHeight: 90,
      }}
      whileHover={{ scale: 1.05, zIndex: 2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.08, ease: 'linear' }}
    >
      {/* Dot-grid background texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '7px 7px',
      }} />

      {/* Checkmark badge when selected */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.12, ease: 'linear' }}
          style={{
            position: 'absolute', top: 3, right: 4,
            fontFamily: 'monospace', fontSize: 10,
            color: '#ffdd00', lineHeight: 1,
          }}
        >✓</motion.div>
      )}

      {/* Icon */}
      {imageSrc ? (
        <img
          src={imageSrc}
          style={{
            width: 56,
            height: 56,
            imageRendering: 'pixelated',
            objectFit: 'cover',
            position: 'relative',
            filter: isSelected ? `drop-shadow(0 0 6px ${accentColor})` : 'none',
          }}
        />
      ) : (
        <span style={{
          fontFamily: 'monospace',
          fontSize: 22,
          color: accentColor,
          lineHeight: 1,
          textShadow: isSelected ? `0 0 8px ${accentColor}99` : 'none',
          position: 'relative',
        }}>
          {icon}
        </span>
      )}

      {/* Short name badge */}
      <div className="font-pixel" style={{
        fontSize: '4px',
        color: accentColor,
        background: 'rgba(0,0,0,0.5)',
        padding: '1px 4px',
        letterSpacing: '0.5px',
        position: 'relative',
      }}>
        {shortName}
      </div>

      {/* Full name */}
      <div className="font-pixel" style={{
        fontSize: '4px',
        color: isSelected ? '#ffdd00' : '#4a3010',
        letterSpacing: '0.3px',
        textAlign: 'center',
        lineHeight: 1.6,
        whiteSpace: 'pre-line',
        position: 'relative',
      }}>
        {name.replace(' ', '\n').toUpperCase()}
      </div>
    </motion.button>
  )
}
