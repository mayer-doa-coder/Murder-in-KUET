import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  playerCol: number
  playerRow: number
  cellSize: number
  boardW: number
  boardH: number
  isZoomed: boolean
  children: ReactNode
}

const ZOOM = 2.1

export default function CameraController({
  playerCol, playerRow, cellSize, boardW, boardH, isZoomed, children,
}: Props) {
  let scale = 1, x = 0, y = 0

  if (isZoomed) {
    const px = (playerCol + 0.5) * cellSize
    const py = (playerRow + 0.5) * cellSize
    scale = ZOOM
    x = (boardW / 2 - px) * ZOOM
    y = (boardH / 2 - py) * ZOOM
  }

  return (
    <motion.div
      style={{ width: boardW, height: boardH }}
      animate={{ scale, x, y }}
      transition={{ duration: 0.38, ease: 'linear' }}
    >
      {children}
    </motion.div>
  )
}
