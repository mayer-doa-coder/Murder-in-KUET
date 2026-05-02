import { motion } from 'framer-motion'
import type { BoardPlayer } from '../types'

interface PlayerTokenProps {
  player: BoardPlayer
  cellSize: number
  isSelected: boolean
  playerIndex: number
  onClick: () => void
}

export default function PlayerToken({ player, cellSize, isSelected, playerIndex, onClick }: PlayerTokenProps) {
  const [col, row] = player.position
  const size = Math.max(10, Math.floor(cellSize * 0.68))
  const offset = Math.floor((cellSize - size) / 2)

  return (
    <motion.div
      title={`P${playerIndex + 1} — ${player.name}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: size,
        height: size,
        zIndex: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isSelected ? `${player.accentColor}20` : '#00000055',
        border: `2px solid ${isSelected ? player.accentColor : player.accentColor + '55'}`,
      }}
      initial={false}
      animate={{
        x: col * cellSize + offset,
        y: row * cellSize + offset,
        opacity: isSelected ? [0.75, 1, 0.75] : 0.85,
      }}
      transition={{
        x: { type: 'tween', ease: 'linear', duration: 0.13 },
        y: { type: 'tween', ease: 'linear', duration: 0.13 },
        opacity: isSelected
          ? { duration: 1.1, repeat: Infinity, ease: 'linear' }
          : { duration: 0.2 },
      }}
      onClick={onClick}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: Math.max(8, Math.floor(size * 0.52)),
          color: player.accentColor,
          lineHeight: 1,
          textShadow: isSelected ? `0 0 6px ${player.accentColor}` : 'none',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {player.icon}
      </span>
    </motion.div>
  )
}
