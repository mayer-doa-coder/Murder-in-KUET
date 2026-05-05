import { useState, useEffect } from 'react'
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

  const suspect  = BY_ID[suspectId]
  const weapon   = BY_ID[weaponId]
  const location = BY_ID[locationId]

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(story.slice(0, i))
      if (i >= story.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, 38)
    return () => clearInterval(interval)
  }, [story])

  const skip = () => {
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

        {/* Card icons row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24 }}>
          {[suspect, weapon, location].map((card, i) =>
            card ? (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  background: card.bgColor,
                  border: `1px solid ${card.accentColor}44`,
                  padding: '9px 13px',
                }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 22,
                    color: card.accentColor,
                    textShadow: `0 0 8px ${card.accentColor}55`,
                    display: 'block', lineHeight: 1,
                  }}>
                    {card.icon}
                  </span>
                </div>
                <div className="font-pixel" style={{
                  fontSize: '5px', color: card.accentColor,
                  letterSpacing: '0.4px', textAlign: 'center',
                }}>
                  {card.shortName}
                </div>
              </div>
            ) : null
          )}

          {/* Category labels */}
          <div style={{ marginLeft: 10, display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#7a4422', letterSpacing: '1px' }}>SUSPECT</div>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#7a4422', letterSpacing: '1px', marginTop: 6 }}>WEAPON</div>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#7a4422', letterSpacing: '1px', marginTop: 6 }}>LOCATION</div>
          </div>
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
