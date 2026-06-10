import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
}

const SIZE = 72
const DOT_HALF = 5

interface Props {
  value: number
  rolling: boolean
  onSettled?: () => void
}

export default function Dice({ value, rolling, onSettled }: Props) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (!rolling) {
      setDisplay(value)
      return
    }
    let count = 0
    const id = setInterval(() => {
      setDisplay(Math.ceil(Math.random() * 6))
      count++
      if (count >= 10) {
        clearInterval(id)
        setDisplay(value)
        onSettled?.()
      }
    }, 55)
    return () => clearInterval(id)
  }, [rolling, value, onSettled])

  const dots = DOT_POSITIONS[display] ?? DOT_POSITIONS[1]

  return (
    <motion.div
      style={{
        width: SIZE,
        height: SIZE,
        background: '#dcdcdc',
        border: '3px solid #111',
        boxShadow: '4px 4px 0 #222, inset 0 0 3px rgba(0,0,0,0.25)',
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
      animate={
        rolling
          ? { rotate: [-12, 12, -9, 9, 0], y: [0, -8, 0, -4, 0] }
          : { rotate: 0, y: 0 }
      }
      transition={{ duration: 0.45, ease: 'linear', repeat: rolling ? Infinity : 0 }}
    >
      <svg width={SIZE} height={SIZE} style={{ display: 'block' }}>
        {dots.map(([fx, fy], i) => (
          <rect
            key={i}
            x={fx * SIZE - DOT_HALF}
            y={fy * SIZE - DOT_HALF}
            width={DOT_HALF * 2}
            height={DOT_HALF * 2}
            fill="#111"
          />
        ))}
      </svg>
    </motion.div>
  )
}
