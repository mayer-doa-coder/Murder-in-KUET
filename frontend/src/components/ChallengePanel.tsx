import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CardPill from './CardPill'
import type { PlayerSetup, PlayerStatus, PendingSuggestion, PlayerResponse } from '../types'
import type { ChallengeChoice } from '../hooks/useTurnActions'
import { CLAIM_LABEL, CLAIM_ICON, CLAIM_COLOR, heartsFor } from '../lib/bluffChallenge'

interface Props {
  suggestion:   PendingSuggestion
  players:      PlayerSetup[]
  playerStatus: PlayerStatus[]
  responses:    PlayerResponse[]
  interactive:  boolean            // true when the investigator is human
  onResolve:    (choice: ChallengeChoice) => void
  ms:           (base: number) => number
  isPaused:     boolean
}

const AI_REVIEW_DELAY = 1300

export default function ChallengePanel({
  suggestion, players, playerStatus, responses, interactive, onResolve, ms, isPaused,
}: Props) {
  const { investigatorIndex, suspectId, weaponId, locationCardId } = suggestion
  const investigator = players[investigatorIndex]
  const claimants = responses.filter(r => r.claim !== 'cannot')

  const [step, setStep] = useState<'challenge' | 'reveal'>('challenge')
  const [challengedIndex, setChallengedIndex] = useState<number | null>(null)
  const doneRef = useRef(false)

  const onResolveRef = useRef(onResolve)
  useEffect(() => { onResolveRef.current = onResolve }, [onResolve])

  const finish = (choice: ChallengeChoice) => {
    if (doneRef.current) return
    doneRef.current = true
    onResolveRef.current(choice)
  }

  // Non-interactive (AI investigator): never challenges; auto-demands from the
  // first claimant after a brief review beat.
  useEffect(() => {
    if (interactive || isPaused) return
    const t = setTimeout(() => finish({ challengedIndex: null, revealTargetIndex: null }), ms(AI_REVIEW_DELAY))
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, isPaused])

  // Interactive: when the challenge step is done and nobody claimed to disprove,
  // there is no card to demand — resolve straight away.
  const goToReveal = (chIdx: number | null) => {
    setChallengedIndex(chIdx)
    if (claimants.length === 0) {
      finish({ challengedIndex: chIdx, revealTargetIndex: null })
    } else {
      setStep('reveal')
    }
  }

  const accent = interactive ? '#cc4466' : (investigator?.accentColor ?? '#cc4466')

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 44,
        background: '#040207',
        display: 'flex', flexDirection: 'column',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div style={{
        height: 46, flexShrink: 0, background: '#07030a',
        borderBottom: '2px solid #2a0025',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
      }}>
        <div className="font-pixel" style={{ fontSize: '8px', color: '#cc6699', letterSpacing: '3px' }}>
          ⚔ CHALLENGE PHASE
        </div>
        <div className="font-pixel" style={{ fontSize: '7px', color: '#7a5566', letterSpacing: '1.5px' }}>
          INVESTIGATOR: {investigator?.name ?? '—'}
        </div>
      </div>

      {/* Suggested cards */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 0 4px', flexShrink: 0,
      }}>
        <CardPill cardId={suspectId}      width={58} imageHeight={72} />
        <CardPill cardId={weaponId}       width={58} imageHeight={72} />
        <CardPill cardId={locationCardId} width={58} imageHeight={72} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Responses table */}
        <div className="font-pixel" style={{ fontSize: '6px', color: '#7a5566', letterSpacing: '2px', margin: '4px 0 8px' }}>
          ── RESPONSES ──
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 560 }}>
          {responses.map(r => {
            const p = players[r.playerIndex]
            const color = CLAIM_COLOR[r.claim]
            const isChallenged = challengedIndex === r.playerIndex
            return (
              <div key={r.playerIndex} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: isChallenged ? '#2a0012' : '#0b0710',
                border: `1px solid ${isChallenged ? '#cc4466' : (p?.accentColor ?? '#333') + '44'}`,
                padding: '7px 10px',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: p?.accentColor ?? '#ccc', flexShrink: 0 }}>{p?.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-pixel" style={{ fontSize: '7px', color: p?.accentColor ?? '#ccc', letterSpacing: '1px' }}>
                    {p?.name} <span style={{ color: '#cc4466' }}>{heartsFor(playerStatus[r.playerIndex]?.lives ?? 0)}</span>
                  </div>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 14, color, flexShrink: 0 }}>{CLAIM_ICON[r.claim]}</span>
                <span className="font-pixel" style={{ fontSize: '7px', color, letterSpacing: '0.5px', width: 150, textAlign: 'right', flexShrink: 0 }}>
                  {CLAIM_LABEL[r.claim]}
                </span>
                {interactive && step === 'challenge' && (
                  <motion.button
                    className="font-pixel"
                    onClick={() => goToReveal(r.playerIndex)}
                    style={{
                      flexShrink: 0, background: '#1a0010', border: '1px solid #cc446688',
                      color: '#cc6688', fontSize: '6px', letterSpacing: '1px',
                      padding: '5px 9px', cursor: 'pointer',
                    }}
                    whileHover={{ background: '#cc446622', borderColor: '#cc4466', color: '#ff88aa' }}
                    whileTap={{ scale: 0.95 }}
                  >
                    ⚔ CHALLENGE
                  </motion.button>
                )}
              </div>
            )
          })}
        </div>

        {/* Interactive controls */}
        {interactive && step === 'challenge' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 18, textAlign: 'center' }}
          >
            <div className="font-pixel" style={{ fontSize: '6px', color: '#886655', letterSpacing: '1px', lineHeight: 2, marginBottom: 12 }}>
              CATCH A LIAR: RIGHT → THEY LOSE A LIFE · WRONG → YOU DO.<br />YOU MAY CHALLENGE ONE PLAYER, OR SKIP.
            </div>
            <motion.button
              className="font-pixel"
              onClick={() => goToReveal(null)}
              style={{
                background: '#0c0710', border: '2px solid #5c3d0088', color: '#b8860b',
                padding: '10px 26px', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer',
              }}
              whileHover={{ background: '#b8860b22', borderColor: '#b8860b' }}
              whileTap={{ scale: 0.96 }}
            >
              ▶ SKIP CHALLENGE
            </motion.button>
          </motion.div>
        )}

        {/* Reveal-target selection */}
        <AnimatePresence>
          {interactive && step === 'reveal' && (
            <motion.div
              key="reveal-step"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 20, textAlign: 'center', width: '100%', maxWidth: 560 }}
            >
              <div className="font-pixel" style={{ fontSize: '7px', color: '#e8c060', letterSpacing: '2px', marginBottom: 4 }}>
                DEMAND A CARD
              </div>
              <div className="font-pixel" style={{ fontSize: '6px', color: '#886655', letterSpacing: '1px', marginBottom: 14 }}>
                CHOOSE A CLAIMANT TO PRIVATELY SHOW YOU A CARD
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {claimants.map(r => {
                  const p = players[r.playerIndex]
                  const color = CLAIM_COLOR[r.claim]
                  return (
                    <motion.button
                      key={r.playerIndex}
                      className="font-pixel"
                      onClick={() => finish({ challengedIndex, revealTargetIndex: r.playerIndex })}
                      style={{
                        background: '#0c0710', border: `2px solid ${color}88`, color,
                        padding: '10px 14px', fontSize: '7px', letterSpacing: '1px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      whileHover={{ background: `${color}22`, borderColor: color }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{p?.icon}</span>
                      {p?.name} · {CLAIM_ICON[r.claim]} {CLAIM_LABEL[r.claim].replace('DISPROVE ', '')}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Non-interactive AI investigator */}
        {!interactive && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ marginTop: 20, textAlign: 'center' }}
          >
            <motion.div
              className="font-pixel"
              style={{ fontSize: '8px', color: accent, letterSpacing: '2px' }}
              animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
            >
              {investigator?.name} (AI) IS REVIEWING THE RESPONSES…
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
