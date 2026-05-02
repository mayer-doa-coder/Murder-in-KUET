import { motion } from 'framer-motion'

interface PixelCursorProps {
  visible: boolean
}

export default function PixelCursor({ visible }: PixelCursorProps) {
  if (!visible) return <span className="inline-block w-6" />

  return (
    <motion.span
      className="inline-block font-pixel dagger-cursor"
      style={{ color: '#ffdd00', fontSize: '14px', marginRight: '8px' }}
      animate={{ x: [0, 4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Pixel dagger rendered as text art */}
      ▶
    </motion.span>
  )
}
