import { motion } from 'framer-motion'

interface Props {
  cells: [number, number][]
  cellSize: number
}

export default function PathDots({ cells, cellSize }: Props) {
  const dotSize = Math.max(4, Math.round(cellSize * 0.28))
  return (
    <>
      {cells.map(([col, row]) => (
        <motion.div
          key={`dot-${col}-${row}`}
          style={{
            position: 'absolute',
            left: (col + 0.5) * cellSize - dotSize / 2,
            top: (row + 0.5) * cellSize - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: '#ff2020',
            pointerEvents: 'none',
            zIndex: 8,
            boxShadow: '0 0 5px #ff000099',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0.75, 1, 0.75], scale: 1 }}
          transition={{
            opacity: { duration: 0.7, repeat: Infinity, ease: 'linear' },
            scale: { duration: 0.12, ease: 'linear' },
          }}
        />
      ))}
    </>
  )
}
