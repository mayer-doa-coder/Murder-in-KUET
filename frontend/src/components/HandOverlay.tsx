import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  onRelease: () => void
}

export default function HandOverlay({ onRelease }: Props) {
  const [holding, setHolding] = useState(false)

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat) setHolding(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        setHolding(false)
        onRelease()
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [onRelease])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        zIndex: 25,
        pointerEvents: 'none',
      }}
    >
      <div
        className="font-pixel"
        style={{
          marginTop: 22,
          fontSize: '7px',
          color: holding ? '#ffdd00' : '#666644',
          letterSpacing: '2px',
          textAlign: 'center',
          lineHeight: 2.2,
          textShadow: holding ? '0 0 8px #ffdd0088' : 'none',
        }}
      >
        {holding ? 'RELEASE  TO  THROW!' : 'HOLD  ENTER  TO  ROLL'}
      </div>

      {holding && (
        <motion.div
          className="font-pixel"
          style={{ fontSize: '5px', color: '#884400', letterSpacing: '3px', marginTop: 8 }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.35, repeat: Infinity, ease: 'linear' }}
        >
          ● ● ●
        </motion.div>
      )}
    </div>
  )
}
