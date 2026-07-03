import { motion } from 'framer-motion'
import type { BoardPlayer } from '../types'

interface PlayerTokenProps {
  player: BoardPlayer
  cellSize: number
  isSelected: boolean
  isEliminated?: boolean
  playerIndex: number
  stackCount?: number
  onClick: () => void
}

export default function PlayerToken({
  player, cellSize, isSelected, isEliminated, playerIndex, stackCount = 1, onClick,
}: PlayerTokenProps) {
  const [col, row] = player.position
  const size = Math.max(10, Math.floor(cellSize * 0.68))
  const offset = Math.floor((cellSize - size) / 2)

  const borderColor = isEliminated
    ? '#44000055'
    : isSelected ? player.accentColor : player.accentColor + '55'

  const bgColor = isEliminated
    ? '#08000055'
    : isSelected ? `${player.accentColor}20` : '#00000055'

  return (
    <motion.div
      title={`P${playerIndex + 1} — ${player.name}${isEliminated ? ' (ELIMINATED)' : ''}`}
      style={{
        position: 'absolute',
        left: 0, top: 0,
        width: size, height: size,
        zIndex: 10,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bgColor,
        border: `2px solid ${borderColor}`,
        overflow: 'visible',
      }}
      initial={false}
      animate={{
        x: col * cellSize + offset,
        y: row * cellSize + offset,
        opacity: isEliminated ? 0.35 : isSelected ? [0.75, 1, 0.75] : 0.85,
      }}
      transition={{
        x: { type: 'tween', ease: 'linear', duration: 0.13 },
        y: { type: 'tween', ease: 'linear', duration: 0.13 },
        opacity: isEliminated
          ? { duration: 0.2 }
          : isSelected
            ? { duration: 1.1, repeat: Infinity, ease: 'linear' }
            : { duration: 0.2 },
      }}
      onClick={onClick}
    >
      {player.imageSrc ? (
        <img
          src={player.imageSrc}
          style={{
            width: Math.max(8, Math.floor(size * 0.72)),
            height: Math.max(8, Math.floor(size * 0.72)),
            imageRendering: 'pixelated',
            objectFit: 'contain',
            pointerEvents: 'none',
            userSelect: 'none',
            filter: isEliminated
              ? 'grayscale(1) brightness(0.3)'
              : isSelected
                ? `drop-shadow(0 0 3px ${player.accentColor})`
                : 'none',
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: Math.max(8, Math.floor(size * 0.52)),
            color: isEliminated ? '#441111' : player.accentColor,
            lineHeight: 1,
            textShadow: isSelected && !isEliminated ? `0 0 6px ${player.accentColor}` : 'none',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {player.icon}
        </span>
      )}

      {/* Active-player glow ring */}
      {isSelected && !isEliminated && (
        <motion.div
          style={{
            position: 'absolute', inset: -5,
            pointerEvents: 'none', zIndex: 9,
            background: `radial-gradient(circle, ${player.accentColor}44 0%, ${player.accentColor}00 70%)`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Stack badge — multiple suspects share this block */}
      {stackCount > 1 && !isEliminated && (
        <div style={{
          position: 'absolute', top: -5, right: -5,
          minWidth: 12, height: 12, padding: '0 2px',
          background: '#ffcc00',
          border: '1px solid #000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: '#000',
          lineHeight: 1, zIndex: 12,
          pointerEvents: 'none',
        }}>
          {stackCount}
        </div>
      )}

      {/* ✕ elimination badge */}
      {isEliminated && (
        <div style={{
          position: 'absolute', top: -4, right: -4,
          width: 10, height: 10,
          background: '#880000',
          border: '1px solid #cc000066',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace', fontSize: 7, color: '#ff4444',
          lineHeight: 1, zIndex: 11,
          pointerEvents: 'none',
        }}>
          ✕
        </div>
      )}
    </motion.div>
  )
}
