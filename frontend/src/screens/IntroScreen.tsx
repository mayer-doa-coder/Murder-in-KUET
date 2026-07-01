import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import PixelButton from '../components/PixelButton'

interface IntroScreenProps {
  onQuickPlay: () => void
  onFullGuide: () => void
}

const BLOOD_DRIPS = [
  { left: '8%', delay: 0, height: 60 },
  { left: '18%', delay: 0.4, height: 90 },
  { left: '27%', delay: 0.8, height: 50 },
  { left: '38%', delay: 0.2, height: 110 },
  { left: '51%', delay: 0.6, height: 70 },
  { left: '62%', delay: 1.0, height: 85 },
  { left: '73%', delay: 0.3, height: 55 },
  { left: '82%', delay: 0.7, height: 95 },
  { left: '91%', delay: 0.1, height: 65 },
]

const SPLATTER_DOTS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.floor(Math.random() * 6) + 2,
  opacity: Math.random() * 0.4 + 0.1,
}))

export default function IntroScreen({ onQuickPlay, onFullGuide }: IntroScreenProps) {
  const [showSubtitle, setShowSubtitle] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const [glitching, setGlitching] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setShowSubtitle(true), 1800)
    const t2 = setTimeout(() => setShowButton(true), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitching(true)
      setTimeout(() => setGlitching(false), 200)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, #1a0000 0%, #0a0000 50%, #000000 100%)' }}
    >
      {/* Static blood splatter dots */}
      {SPLATTER_DOTS.map((dot) => (
        <div
          key={dot.id}
          className="absolute rounded-none"
          style={{
            top: dot.top,
            left: dot.left,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            background: '#8b0000',
            opacity: dot.opacity,
            imageRendering: 'pixelated',
          }}
        />
      ))}

      {/* Blood drips from top */}
      <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none">
        {BLOOD_DRIPS.map((drip, i) => (
          <motion.div
            key={i}
            className="absolute top-0"
            style={{ left: drip.left, width: '6px', background: '#8b0000', originY: 0 }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 0.85 }}
            transition={{ delay: drip.delay + 0.5, duration: 1.2, ease: 'easeIn' }}
          >
            <div style={{ height: `${drip.height}px`, background: '#8b0000' }} />
            {/* drip tip */}
            <div style={{ width: '10px', height: '10px', background: '#6b0000', borderRadius: '0 0 5px 5px', marginLeft: '-2px' }} />
          </motion.div>
        ))}
      </div>

      {/* Flickering atmosphere particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              top: `${20 + i * 10}%`,
              left: `${5 + i * 12}%`,
              width: '2px',
              height: '2px',
              background: '#660000',
            }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </div>

      {/* Horizontal scanline flicker */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(transparent 50%, rgba(139,0,0,0.03) 50%)',
          backgroundSize: '100% 4px',
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8 max-w-3xl text-center">

        {/* Top label */}
        <motion.div
          className="font-pixel"
          style={{ color: '#660000', fontSize: '9px', letterSpacing: '4px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0.5, 0.9, 0.7] }}
          transition={{ duration: 2, delay: 0.2 }}
        >
          — KUET CAMPUS —
        </motion.div>

        {/* Main title */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        >
          <motion.h1
            className="font-pixel glitch-text"
            data-text="MURDER"
            style={{
              fontSize: 'clamp(28px, 6vw, 56px)',
              color: '#cc0000',
              letterSpacing: '8px',
              textShadow: '4px 4px 0 #3d0000, 0 0 20px #8b000088',
              lineHeight: 1.3,
            }}
            animate={glitching ? { x: [-3, 3, -1, 2, 0], skewX: [-2, 2, 0] } : {}}
            transition={{ duration: 0.2 }}
          >
            MURDER
          </motion.h1>
          <motion.div
            className="font-pixel"
            style={{
              fontSize: 'clamp(10px, 2vw, 14px)',
              color: '#8b3a3a',
              letterSpacing: '12px',
              marginTop: '4px',
              textShadow: '2px 2px 0 #1a0000',
            }}
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            IN KUET
          </motion.div>
        </motion.div>

        {/* Divider */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <div style={{ flex: 1, height: '2px', background: 'repeating-linear-gradient(90deg, #660000 0, #660000 6px, transparent 6px, transparent 12px)' }} />
          <span className="font-pixel" style={{ color: '#660000', fontSize: '8px' }}>✦</span>
          <div style={{ flex: 1, height: '2px', background: 'repeating-linear-gradient(90deg, #660000 0, #660000 6px, transparent 6px, transparent 12px)' }} />
        </motion.div>

        {/* Subtitle text */}
        <AnimatePresence>
          {showSubtitle && (
            <motion.div
              className="font-pixel"
              style={{ color: '#b8860b', fontSize: 'clamp(7px, 1.2vw, 10px)', lineHeight: 2.4, letterSpacing: '1px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5 }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0, duration: 0.8 }}
                style={{ display: 'block' }}
              >
                A MURDER HAS BEEN COMMITTED IN KUET
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                style={{ display: 'block', color: '#cc9900' }}
              >
                LET'S SEE WHO CATCHES THE MURDERER FIRST
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entry choices */}
        <AnimatePresence>
          {showButton && (
            <motion.div
              className="flex flex-col items-center"
              style={{ gap: '14px' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <PixelButton onClick={onQuickPlay} color="red">
                ► QUICK PLAY ◄
              </PixelButton>

              <button
                onClick={onFullGuide}
                className="font-pixel"
                style={{
                  marginTop: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: '#8b5c2a',
                  fontSize: '9px',
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '4px',
                }}
              >
                READ THE FULL RULES INSTEAD
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Corner decorations */}
      {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
        <div
          key={i}
          className={`absolute ${pos} font-pixel`}
          style={{ color: '#330000', fontSize: '10px' }}
        >
          ▪
        </div>
      ))}

      {/* Bottom flavor text */}
      <motion.div
        className="absolute bottom-6 font-pixel"
        style={{ color: '#330000', fontSize: '7px', letterSpacing: '3px' }}
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        © 2025 MURDER IN KUET — AI DETECTIVE CHALLENGE
      </motion.div>
    </div>
  )
}
