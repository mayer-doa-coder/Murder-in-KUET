import { motion } from 'framer-motion'
import type { Card } from '../types'

interface Props {
  caseFile:  { suspect: Card; weapon: Card; location: Card }
  onExit:    () => void
  onRestart: () => void
}

function RevealCard({ card }: { card: Card }) {
  return (
    <motion.div
      style={{
        background: card.bgColor,
        border: `2px solid ${card.accentColor}55`,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 9,
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span style={{
        fontFamily: 'monospace', fontSize: 20,
        color: card.accentColor,
        textShadow: `0 0 8px ${card.accentColor}55`,
        lineHeight: 1, flexShrink: 0,
      }}>
        {card.icon}
      </span>
      <div>
        <div className="font-pixel" style={{ fontSize: '5px', color: '#888', letterSpacing: '0.5px', marginBottom: 3 }}>
          {card.shortName}
        </div>
        <div className="font-pixel" style={{ fontSize: '6px', color: card.accentColor, letterSpacing: '0.5px' }}>
          {card.name.toUpperCase()}
        </div>
      </div>
    </motion.div>
  )
}

export default function GameOverPopup({ caseFile, onExit, onRestart }: Props) {
  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'linear' }}
    >
      <motion.div
        style={{
          background: '#040100',
          border: '2px solid #aa110033',
          boxShadow: '0 0 90px #880000' + '22',
          padding: '42px 52px',
          maxWidth: 560,
          width: '90%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          textAlign: 'center',
        }}
        initial={{ scale: 0.78, y: 36 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'linear' }}
      >
        {/* Skull */}
        <div style={{ fontFamily: 'monospace', fontSize: 36, color: '#440000', marginBottom: 14, lineHeight: 1 }}>
          ✕
        </div>

        {/* GAME OVER title */}
        <motion.div
          className="font-pixel"
          style={{
            fontSize: '20px', color: '#cc2200',
            letterSpacing: '8px', marginBottom: 10,
            textShadow: '0 0 20px #88000077',
          }}
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        >
          GAME OVER
        </motion.div>

        <div className="font-pixel" style={{
          fontSize: '6px', color: '#881100',
          letterSpacing: '2px', marginBottom: 30,
        }}>
          ALL SUSPECTS ELIMINATED
        </div>

        {/* Divider */}
        <div style={{
          height: 1,
          background: 'repeating-linear-gradient(90deg,#cc220033 0,#cc220033 4px,transparent 4px,transparent 8px)',
          width: '100%', marginBottom: 26,
        }} />

        <div className="font-pixel" style={{
          fontSize: '6px', color: '#aa4422',
          letterSpacing: '1px', marginBottom: 16,
        }}>
          THE MURDERER ESCAPES... THE TRUTH IS REVEALED:
        </div>

        {/* Case file cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
          <RevealCard card={caseFile.suspect}  />
          <RevealCard card={caseFile.weapon}   />
          <RevealCard card={caseFile.location} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <motion.button
            className="font-pixel"
            style={{
              background: 'transparent',
              border: '2px solid #44aa6666',
              color: '#44aa66', padding: '12px 24px', fontSize: '8px',
              letterSpacing: '2px', cursor: 'pointer',
            }}
            whileHover={{ background: '#44aa6622', borderColor: '#44aa66' }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.08 }}
            onClick={onRestart}
          >
            ↺ PLAY AGAIN
          </motion.button>

          <motion.button
            className="font-pixel"
            style={{
              background: 'transparent',
              border: '2px solid #cc220066',
              color: '#cc2200', padding: '12px 24px', fontSize: '8px',
              letterSpacing: '2px', cursor: 'pointer',
            }}
            whileHover={{ background: '#cc220022', borderColor: '#cc2200' }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.08 }}
            onClick={onExit}
          >
            EXIT GAME
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
