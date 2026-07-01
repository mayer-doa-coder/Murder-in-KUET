import { motion } from 'framer-motion'
import type { RevealResult } from '../types'
import CardPill from './CardPill'

interface Props {
  result: RevealResult
  caseFile: { suspect: { id: string; icon: string; name: string }; weapon: { id: string; icon: string; name: string }; location: { id: string; icon: string; name: string } }
  onContinue: () => void
}

export default function RevealResultOverlay({ result, caseFile, onContinue }: Props) {
  const isInterrogation = result.type === 'interrogation'
  const isCorrect = result.correct === true

  const accentColor = isInterrogation
    ? '#cc8800'
    : isCorrect ? '#22cc44' : '#cc2200'

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'linear' }}
    >
      <motion.div
        style={{
          background: '#080204',
          border: `2px solid ${accentColor}77`,
          boxShadow: `0 0 50px ${accentColor}33`,
          padding: '32px 40px',
          maxWidth: 680,
          width: '92%',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'linear' }}
      >
        {/* ── INTERROGATION result ─────────────────────────────────── */}
        {isInterrogation && (
          <>
            <div className="font-pixel" style={{
              fontSize: '11px', color: '#ee9900',
              letterSpacing: '3px', marginBottom: 22,
            }}>
              ♦ INTERROGATION
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <CardPill cardId={result.suspectId} />
              <CardPill cardId={result.weaponId} />
            </div>

            <div className="font-pixel" style={{
              fontSize: '9px', color: '#aa6622', letterSpacing: '1px', marginBottom: 20,
            }}>
              AT: {result.roomName ?? result.locationId.toUpperCase()}
            </div>

            <div style={{
              height: 1,
              background: `repeating-linear-gradient(90deg,#cc880044 0,#cc880044 4px,transparent 4px,transparent 8px)`,
              marginBottom: 20,
            }} />

            {result.revealedCardId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="font-pixel" style={{
                  fontSize: '9px', color: '#cc9900', letterSpacing: '1px',
                }}>
                  DISPROVED BY: {result.revealedByName?.toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="font-pixel" style={{ fontSize: '8px', color: '#aa7733', letterSpacing: '1px' }}>
                    CARD SHOWN:
                  </span>
                  <CardPill cardId={result.revealedCardId} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <motion.div
                  className="font-pixel"
                  style={{ fontSize: '11px', color: '#ffdd00', letterSpacing: '2px' }}
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.2, repeat: 3, ease: 'linear' }}
                >
                  NO DISPROOF
                </motion.div>
                <div className="font-pixel" style={{
                  fontSize: '9px', color: '#cc9900', letterSpacing: '1px',
                }}>
                  YOUR SUGGESTION STANDS UNCHALLENGED
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ACCUSATION result ────────────────────────────────────── */}
        {!isInterrogation && (
          <>
            <div className="font-pixel" style={{
              fontSize: isCorrect ? '12px' : '18px',
              color: isCorrect ? '#44ee66' : '#ee3300',
              letterSpacing: '3px', marginBottom: 10,
            }}>
              {isCorrect ? '✓ ACCUSATION CORRECT!' : 'ACCUSATION WRONG'}
            </div>

            <div style={{ marginBottom: 22 }}>
              <div className="font-pixel" style={{
                fontSize: '14px',
                color: isCorrect ? '#44ee66' : '#ee3300',
                letterSpacing: '2px',
                lineHeight: 1.3,
              }}>
                {result.accusingPlayerName?.toUpperCase()}{isCorrect ? ' WINS!' : ' IS ELIMINATED'}
              </div>
            </div>

            <div style={{
              height: 1,
              background: `repeating-linear-gradient(90deg,${accentColor}44 0,${accentColor}44 4px,transparent 4px,transparent 8px)`,
              marginBottom: 20,
            }} />

            <div className="font-pixel" style={{
              fontSize: '9px', color: '#aa7733', letterSpacing: '1px', marginBottom: 10,
            }}>
              {isCorrect ? 'CASE FILE CONFIRMED:' : 'YOUR GUESS:'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: isCorrect ? 0 : 16 }}>
              <CardPill cardId={result.suspectId}  dimmed={!isCorrect} />
              <CardPill cardId={result.weaponId}   dimmed={!isCorrect} />
              <CardPill cardId={result.locationId} dimmed={!isCorrect} />
            </div>

            {isCorrect && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                <div className="font-pixel" style={{
                  fontSize: '9px', color: '#88cc22', letterSpacing: '1px',
                }}>
                  CASE FILE UNSEALED:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <CardPill cardId={caseFile.suspect.id}  />
                  <CardPill cardId={caseFile.weapon.id}   />
                  <CardPill cardId={caseFile.location.id} />
                </div>
              </div>
            )}

            {!isCorrect && (
              <div className="font-pixel" style={{
                fontSize: '9px', color: '#cc3322', letterSpacing: '1px', lineHeight: 2,
              }}>
                CASE FILE REMAINS SEALED.
                <br />YOU MAY NO LONGER MOVE OR SUGGEST.
              </div>
            )}
          </>
        )}

        <motion.button
          className="font-pixel"
          style={{
            marginTop: 28,
            background: 'transparent',
            border: `2px solid ${accentColor}88`,
            color: accentColor,
            padding: '12px 30px',
            fontSize: '10px',
            letterSpacing: '2px',
            cursor: 'pointer',
            alignSelf: 'center',
          }}
          whileHover={{
            background: `${accentColor}22`,
            borderColor: accentColor,
          }}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.08 }}
          onClick={onContinue}
        >
          {result.type === 'accusation' && result.correct ? '✓ FINISH' : '► CONTINUE'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
