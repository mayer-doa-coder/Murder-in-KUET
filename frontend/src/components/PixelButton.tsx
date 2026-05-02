import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface PixelButtonProps {
  onClick: () => void
  children: ReactNode
  color?: 'red' | 'yellow' | 'brown'
  className?: string
}

const colorMap = {
  red: {
    bg: '#8b0000',
    border: '#cc0000',
    shadow: '#3d0000',
    text: '#ffcccc',
    hoverBg: '#a30000',
  },
  yellow: {
    bg: '#5c4400',
    border: '#b8860b',
    shadow: '#2a1f00',
    text: '#ffd700',
    hoverBg: '#7a5c00',
  },
  brown: {
    bg: '#3d2200',
    border: '#8b5c2a',
    shadow: '#1a0f00',
    text: '#d4a96a',
    hoverBg: '#5c3300',
  },
}

export default function PixelButton({
  onClick,
  children,
  color = 'red',
  className = '',
}: PixelButtonProps) {
  const c = colorMap[color]

  return (
    <motion.button
      onClick={onClick}
      className={`font-pixel relative cursor-pointer select-none ${className}`}
      style={{
        backgroundColor: c.bg,
        color: c.text,
        border: `4px solid ${c.border}`,
        padding: '12px 28px',
        fontSize: '11px',
        letterSpacing: '2px',
        boxShadow: `4px 4px 0 ${c.shadow}, inset 2px 2px 0 rgba(255,255,255,0.1)`,
        imageRendering: 'pixelated',
        outline: 'none',
      }}
      animate={{
        boxShadow: [
          `4px 4px 0 ${c.shadow}, 0 0 8px ${c.border}44`,
          `4px 4px 0 ${c.shadow}, 0 0 16px ${c.border}88`,
          `4px 4px 0 ${c.shadow}, 0 0 8px ${c.border}44`,
        ],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      whileHover={{
        backgroundColor: c.hoverBg,
        y: -2,
        boxShadow: `6px 6px 0 ${c.shadow}, 0 0 20px ${c.border}`,
      }}
      whileTap={{
        y: 4,
        boxShadow: `0px 0px 0 ${c.shadow}`,
      }}
    >
      {children}
    </motion.button>
  )
}
