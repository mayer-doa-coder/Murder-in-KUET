import { motion } from 'framer-motion'
import type { Card } from '../types'
import CardPill from './CardPill'

interface Props {
  winnerName:     string
  winnerIcon:     string
  winnerImageSrc?: string
  winnerColor:    string
  caseFile:       { suspect: Card; weapon: Card; location: Card }
  onRestart:      () => void
  onExit:         () => void
}

export default function VictoryScreen({
  winnerName, winnerIcon, winnerImageSrc, winnerColor, caseFile, onRestart, onExit,
}: Props) {
  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'linear' }}
    >
      <motion.div
        style={{
          background: '#020a04',
          border: `2px solid ${winnerColor}55`,
          boxShadow: `0 0 100px ${winnerColor}22, 0 0 40px #00cc4422`,
          padding: '44px 56px',
          maxWidth: 640,
          width: '92%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
          gap: 0,
        }}
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'linear' }}
      >
        {/* "CASE SOLVED" header */}
        <motion.div
          className="font-pixel"
          style={{
            fontSize: '22px',
            color: '#22ee66',
            letterSpacing: '8px',
            marginBottom: 6,
            textShadow: '0 0 28px #22ee6688',
          }}
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        >
          CASE SOLVED
        </motion.div>

        <div className="font-pixel" style={{
          fontSize: '7px', color: '#228844',
          letterSpacing: '3px', marginBottom: 30,
        }}>
          THE TRUTH IS REVEALED
        </div>

        {/* Winner portrait */}
        <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 110, height: 150,
            background: '#0a0a0a',
            border: `3px solid ${winnerColor}`,
            boxShadow: `0 0 24px ${winnerColor}55`,
            overflow: 'hidden',
            position: 'relative',
          }}>
            {winnerImageSrc ? (
              <img
                src={winnerImageSrc}
                style={{
                  width: '100%', height: '100%',
                  imageRendering: 'pixelated',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 40,
                  color: winnerColor, lineHeight: 1,
                }}>
                  {winnerIcon}
                </span>
              </div>
            )}
            {/* Scan-line */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
            }} />
          </div>

          <div>
            <div className="font-pixel" style={{
              fontSize: '11px', color: winnerColor,
              letterSpacing: '3px',
              textShadow: `0 0 12px ${winnerColor}77`,
            }}>
              {winnerName.toUpperCase()}
            </div>
            <div className="font-pixel" style={{
              fontSize: '7px', color: '#228844',
              letterSpacing: '2px', marginTop: 5,
            }}>
              ✓ SOLVED THE MYSTERY
            </div>
          </div>
        </div>

        <div style={{
          height: 1,
          background: 'repeating-linear-gradient(90deg,#22ee6633 0,#22ee6633 4px,transparent 4px,transparent 8px)',
          width: '100%', marginBottom: 24,
        }} />

        {/* Case file reveal */}
        <div className="font-pixel" style={{
          fontSize: '6px', color: '#336644',
          letterSpacing: '2px', marginBottom: 14,
        }}>
          THE CASE FILE:
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 36 }}>
          <CardPill cardId={caseFile.suspect.id}  />
          <CardPill cardId={caseFile.weapon.id}   />
          <CardPill cardId={caseFile.location.id} />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 14 }}>
          <motion.button
            className="font-pixel"
            style={{
              background: 'transparent',
              border: `2px solid ${winnerColor}88`,
              color: winnerColor, padding: '12px 28px', fontSize: '8px',
              letterSpacing: '2px', cursor: 'pointer',
            }}
            whileHover={{ background: `${winnerColor}22`, borderColor: winnerColor }}
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
              color: '#cc2200', padding: '12px 28px', fontSize: '8px',
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
