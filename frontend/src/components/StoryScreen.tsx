import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ALL_CARDS } from '../types'

const BY_ID = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]))

interface Props {
  story: string
  suspectId: string
  weaponId: string
  locationId: string
  onContinue: () => void
}

export default function StoryScreen({ story, suspectId, weaponId, locationId, onContinue }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const suspect  = BY_ID[suspectId]
  const weapon   = BY_ID[weaponId]
  const location = BY_ID[locationId]

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      setDisplayed(story.slice(0, i))
      if (i >= story.length) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setDone(true)
      }
    }, 38)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [story])

  const skip = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setDisplayed(story)
    setDone(true)
  }

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(2,1,4,0.97)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 45,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'linear' }}
    >
      <motion.div
        style={{
          background: '#050106',
          border: '2px solid #cc880055',
          boxShadow: '0 0 70px #cc880018, inset 0 0 40px #00000066',
          padding: '36px 44px',
          maxWidth: 600,
          width: '90%',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}
        initial={{ scale: 0.85, y: 28 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'linear' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div className="font-pixel" style={{
            fontSize: '7px', color: '#cc8800',
            letterSpacing: '3px',
          }}>
            ✦ CRIME THEORY
          </div>
          <motion.div
            className="font-pixel"
            style={{ fontSize: '5px', color: '#664400', letterSpacing: '1px' }}
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          >
            ● RECORDING
          </motion.div>
        </div>

        {/* Card row — portrait cards with real images */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24 }}>
          {([
            { card: suspect,  label: 'SUSPECT'  },
            { card: weapon,   label: 'WEAPON'   },
            { card: location, label: 'LOCATION' },
          ] as const).map(({ card, label }, i) =>
            card ? (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                {/* Mini portrait card */}
                <div style={{
                  width: 72, height: 104,
                  background: card.bgColor,
                  border: `2px solid ${card.accentColor}66`,
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  position: 'relative',
                  boxShadow: `0 0 10px ${card.accentColor}33`,
                }}>
                  {/* Scan-line overlay */}
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                    background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
                  }} />
                  {/* Image */}
                  <div style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 0 }}>
                    {card.imageSrc ? (
                      <img src={card.imageSrc} style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', imageRendering: 'pixelated', display: 'block',
                      }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 26, color: card.accentColor, lineHeight: 1 }}>
                          {card.icon}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Name strip */}
                  <div style={{
                    background: 'rgba(0,0,0,0.82)',
                    borderTop: `1px solid ${card.accentColor}33`,
                    padding: '3px 4px',
                    flexShrink: 0, zIndex: 2, position: 'relative',
                  }}>
                    <div className="font-pixel" style={{
                      fontSize: '4px', color: card.accentColor,
                      textAlign: 'center', letterSpacing: '0.3px',
                      whiteSpace: 'pre-line', lineHeight: 1.4,
                    }}>
                      {card.name.toUpperCase()}
                    </div>
                  </div>
                </div>
                {/* Category label */}
                <div className="font-pixel" style={{ fontSize: '4px', color: '#6a4422', letterSpacing: '0.8px' }}>
                  {label}
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* Divider */}
        <div style={{
          height: 1,
          background: 'repeating-linear-gradient(90deg,#cc880044 0,#cc880044 4px,transparent 4px,transparent 8px)',
          marginBottom: 24,
        }} />

        {/* Story text with typewriter */}
        <div style={{ minHeight: 72, marginBottom: 28 }}>
          <div className="font-pixel" style={{
            fontSize: '8px',
            color: '#e8d890',
            lineHeight: 2.5,
            letterSpacing: '0.6px',
          }}>
            {displayed}
            {!done && (
              <motion.span
                style={{ color: '#cc8800', marginLeft: 1 }}
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.45, repeat: Infinity, ease: 'linear' }}
              >
                ▌
              </motion.span>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          <AnimatePresence>
            {!done && (
              <motion.button
                key="skip"
                className="font-pixel"
                style={{
                  background: 'transparent', border: '1px solid #3a2200',
                  color: '#664400', padding: '8px 18px', fontSize: '6px',
                  letterSpacing: '1px', cursor: 'pointer',
                }}
                whileHover={{ color: '#997722', borderColor: '#775500' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={skip}
              >
                SKIP ▷
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {done && (
              <motion.button
                key="proceed"
                className="font-pixel"
                style={{
                  background: 'transparent', border: '2px solid #cc880077',
                  color: '#cc8800', padding: '11px 26px', fontSize: '8px',
                  letterSpacing: '2px', cursor: 'pointer',
                }}
                whileHover={{ background: '#cc880022', borderColor: '#cc8800' }}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                onClick={onContinue}
              >
                ► PROCEED
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
