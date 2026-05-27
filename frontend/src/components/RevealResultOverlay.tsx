import { motion } from 'framer-motion'
import { ALL_CARDS } from '../types'
import type { RevealResult } from '../types'

const BY_ID = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]))

interface Props {
  result: RevealResult
  caseFile: { suspect: { id: string; icon: string; name: string }; weapon: { id: string; icon: string; name: string }; location: { id: string; icon: string; name: string } }
  onContinue: () => void
}

function CardPill({ cardId, dimmed }: { cardId: string; dimmed?: boolean }) {
  const card = BY_ID[cardId]
  if (!card) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: dimmed ? '#0a0a0a' : card.bgColor,
      border: `2px solid ${dimmed ? '#222' : card.accentColor}44`,
      padding: '6px 10px',
      opacity: dimmed ? 0.4 : 1,
    }}>
      {card.imageSrc ? (
        <img
          src={card.imageSrc}
          style={{
            width: 22,
            height: 22,
            imageRendering: 'pixelated',
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
      ) : (
        <span style={{ fontFamily: 'monospace', fontSize: 16, color: card.accentColor, lineHeight: 1 }}>
          {card.icon}
        </span>
      )}
      <span className="font-pixel" style={{
        fontSize: '7px', color: card.accentColor, letterSpacing: '0.5px',
      }}>
        {card.name.toUpperCase()}
      </span>
    </div>
  )
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
          maxWidth: 600,
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
              fontSize: '8px', color: '#ee9900',
              letterSpacing: '3px', marginBottom: 22,
            }}>
              ♦ INTERROGATION
            </div>

            {/* Suggestion summary */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
            }}>
              <CardPill cardId={result.suspectId} />
              <CardPill cardId={result.weaponId} />
            </div>

            <div className="font-pixel" style={{
              fontSize: '6px', color: '#aa6622', letterSpacing: '1px', marginBottom: 20,
            }}>
              AT: {result.roomName ?? result.locationId.toUpperCase()}
            </div>

            <div style={{
              height: 1,
              background: `repeating-linear-gradient(90deg,#cc880044 0,#cc880044 4px,transparent 4px,transparent 8px)`,
              marginBottom: 20,
            }} />

            {/* Reveal outcome */}
            {result.revealedCardId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="font-pixel" style={{
                  fontSize: '7px', color: '#cc9900', letterSpacing: '1px',
                }}>
                  DISPROVED BY: {result.revealedByName?.toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="font-pixel" style={{ fontSize: '6px', color: '#aa7733', letterSpacing: '1px' }}>
                    CARD SHOWN:
                  </span>
                  <CardPill cardId={result.revealedCardId} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <motion.div
                  className="font-pixel"
                  style={{ fontSize: '8px', color: '#ffdd00', letterSpacing: '2px' }}
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.2, repeat: 3, ease: 'linear' }}
                >
                  NO DISPROOF
                </motion.div>
                <div className="font-pixel" style={{
                  fontSize: '7px', color: '#cc9900', letterSpacing: '1px',
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
              fontSize: '9px',
              color: isCorrect ? '#44ee66' : '#ee3300',
              letterSpacing: '3px', marginBottom: 10,
            }}>
              {isCorrect ? '✓ ACCUSATION CORRECT!' : '✗ ACCUSATION WRONG!'}
            </div>

            {/* Accusing player */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22,
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 24 }}>
                {result.accusingPlayerIcon}
              </span>
              <div className="font-pixel" style={{
                fontSize: '8px',
                color: isCorrect ? '#44ee66' : '#ee3300',
                letterSpacing: '1px',
              }}>
                {result.accusingPlayerName?.toUpperCase()}{isCorrect ? ' WINS!' : ' IS ELIMINATED'}
              </div>
            </div>

            <div style={{
              height: 1,
              background: `repeating-linear-gradient(90deg,${accentColor}44 0,${accentColor}44 4px,transparent 4px,transparent 8px)`,
              marginBottom: 20,
            }} />

            {/* Selected cards */}
            <div className="font-pixel" style={{
              fontSize: '6px', color: '#aa7733', letterSpacing: '1px', marginBottom: 10,
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
                  fontSize: '6px', color: '#88cc22', letterSpacing: '1px',
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
                fontSize: '7px', color: '#cc3322', letterSpacing: '1px', lineHeight: 2,
              }}>
                CASE FILE REMAINS SEALED.
                <br />YOU MAY NO LONGER MOVE OR SUGGEST.
              </div>
            )}
          </>
        )}

        {/* Continue button */}
        <motion.button
          className="font-pixel"
          style={{
            marginTop: 28,
            background: 'transparent',
            border: `2px solid ${accentColor}88`,
            color: accentColor,
            padding: '10px 26px',
            fontSize: '8px',
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
