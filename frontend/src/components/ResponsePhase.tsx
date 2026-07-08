import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CardPill from './CardPill'
import type { Card, PlayerSetup, PlayerStatus, PendingSuggestion, PlayerResponse, ResponseClaim } from '../types'
import {
  RESPONSE_CLAIMS, CLAIM_LABEL, CLAIM_ICON, CLAIM_COLOR,
  truthfulClaimFor, claimIsTruthful, heartsFor,
} from '../lib/bluffChallenge'

interface Props {
  suggestion:   PendingSuggestion
  players:      PlayerSetup[]
  playerStatus: PlayerStatus[]
  playerHands:  Card[][]
  onComplete:   (responses: PlayerResponse[]) => void
  ms:           (base: number) => number
  isPaused:     boolean
}

const AI_RESPONSE_DELAY = 850

export default function ResponsePhase({
  suggestion, players, playerStatus, playerHands, onComplete, ms, isPaused,
}: Props) {
  const { investigatorIndex, suspectId, weaponId, locationCardId } = suggestion

  // Responders = every non-eliminated player except the investigator, in turn
  // order starting from the player to the investigator's left.
  const responders = useMemo(() => {
    const n = players.length
    const out: number[] = []
    for (let offset = 1; offset < n; offset++) {
      const idx = (investigatorIndex + offset) % n
      if (idx !== investigatorIndex && !playerStatus[idx]?.eliminated) out.push(idx)
    }
    return out
  // playerStatus intentionally captured once at mount — eliminations don't change mid-phase.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length, investigatorIndex])

  const [stepIdx, setStepIdx]     = useState(0)
  const [humanReady, setHumanReady] = useState(false)
  const collectedRef = useRef<PlayerResponse[]>([])
  const doneRef = useRef(false)

  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const record = useCallback((idx: number, claim: ResponseClaim) => {
    collectedRef.current = [...collectedRef.current, { playerIndex: idx, claim }]
    setHumanReady(false)
    setStepIdx(s => s + 1)
  }, [])

  // Completion once every responder has answered.
  useEffect(() => {
    if (stepIdx >= responders.length && !doneRef.current) {
      doneRef.current = true
      onCompleteRef.current(collectedRef.current)
    }
  }, [stepIdx, responders.length])

  const currentIdx = stepIdx < responders.length ? responders[stepIdx] : -1
  const current    = currentIdx >= 0 ? players[currentIdx] : undefined
  const isAi       = current?.type === 'computer'
  const hand       = currentIdx >= 0 ? (playerHands[currentIdx] ?? []) : []
  const handIds    = hand.map(c => c.id)
  const lives      = currentIdx >= 0 ? (playerStatus[currentIdx]?.lives ?? 0) : 0

  // AI responders answer truthfully after a short delay.
  useEffect(() => {
    if (currentIdx < 0 || !isAi || isPaused) return
    const claim = truthfulClaimFor(handIds, suspectId, weaponId, locationCardId)
    const t = setTimeout(() => record(currentIdx, claim), ms(AI_RESPONSE_DELAY))
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, isAi, isPaused])

  if (currentIdx < 0 || !current) return null

  const accent = current.accentColor

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
          ♦ RESPONSE PHASE
        </div>
        <div className="font-pixel" style={{ fontSize: '7px', color: '#7a5566', letterSpacing: '1.5px' }}>
          RESPONDER {stepIdx + 1} / {responders.length}
        </div>
      </div>

      {/* Suggested cards banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 0 6px', flexShrink: 0,
      }}>
        <CardPill cardId={suspectId}      width={64} imageHeight={80} />
        <CardPill cardId={weaponId}       width={64} imageHeight={80} />
        <CardPill cardId={locationCardId} width={64} imageHeight={80} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {isAi ? (
            // ── AI responder — auto ──
            <motion.div
              key={`ai-${stepIdx}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ textAlign: 'center' }}
            >
              <div className="font-pixel" style={{ fontSize: '10px', color: accent, letterSpacing: '2px', marginBottom: 10 }}>
                {current.icon} {current.name} (AI)
              </div>
              <motion.div
                className="font-pixel"
                style={{ fontSize: '8px', color: '#886699', letterSpacing: '1.5px' }}
                animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
              >
                DECIDING RESPONSE…
              </motion.div>
            </motion.div>
          ) : !humanReady ? (
            // ── Human responder — pass-device cover ──
            <motion.div
              key={`cover-${stepIdx}`}
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{ textAlign: 'center', maxWidth: 420 }}
            >
              <div className="font-pixel" style={{ fontSize: '7px', color: '#7a3344', letterSpacing: '2px', marginBottom: 12 }}>
                PASS THE DEVICE TO
              </div>
              <div className="font-pixel" style={{ fontSize: '16px', color: accent, letterSpacing: '2px', marginBottom: 6 }}>
                {current.icon} {current.name}
              </div>
              <div className="font-pixel" style={{ fontSize: '14px', color: '#cc4466', letterSpacing: '2px', marginBottom: 18 }}>
                {heartsFor(lives)}
              </div>
              <div className="font-pixel" style={{ fontSize: '7px', color: '#886655', letterSpacing: '1px', lineHeight: 2, marginBottom: 22 }}>
                EVERYONE ELSE, LOOK AWAY.<br />ONLY {current.name} SHOULD SEE THE NEXT SCREEN.
              </div>
              <motion.button
                className="font-pixel"
                onClick={() => setHumanReady(true)}
                style={{
                  background: '#160010', border: `2px solid ${accent}`, color: accent,
                  padding: '12px 34px', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer',
                }}
                whileHover={{ background: `${accent}22` }} whileTap={{ scale: 0.96 }}
              >
                ► I'M {current.name} — REVEAL
              </motion.button>
            </motion.div>
          ) : (
            // ── Human responder — secret choice ──
            <motion.div
              key={`choose-${stepIdx}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div className="font-pixel" style={{ fontSize: '9px', color: accent, letterSpacing: '2px', marginBottom: 4 }}>
                {current.icon} {current.name} · {heartsFor(lives)}
              </div>
              <div className="font-pixel" style={{ fontSize: '6px', color: '#886655', letterSpacing: '1px', marginBottom: 12 }}>
                {lives > 0 ? 'YOU MAY BLUFF — OR TELL THE TRUTH' : 'NO LIVES LEFT — YOU MUST TELL THE TRUTH'}
              </div>

              {/* Your hand for reference */}
              <div className="font-pixel" style={{ fontSize: '5px', color: '#5a4433', letterSpacing: '1.5px', marginBottom: 6 }}>
                ── YOUR CARDS ──
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginBottom: 16, maxWidth: 560 }}>
                {hand.length === 0 && (
                  <div className="font-pixel" style={{ fontSize: '6px', color: '#665544', letterSpacing: '1px' }}>NO CARDS</div>
                )}
                {hand.map(c => {
                  const relevant = c.id === suspectId || c.id === weaponId || c.id === locationCardId
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: c.bgColor,
                      border: `1px solid ${relevant ? c.accentColor : c.accentColor + '33'}`,
                      boxShadow: relevant ? `0 0 8px ${c.accentColor}66` : 'none',
                      padding: '4px 7px',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: c.accentColor, lineHeight: 1 }}>{c.icon}</span>
                      <span className="font-pixel" style={{ fontSize: '5px', color: c.accentColor, letterSpacing: '0.4px' }}>
                        {c.name.toUpperCase()}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Response options */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(150px, 240px))', gap: 10, width: '100%', justifyContent: 'center' }}>
                {RESPONSE_CLAIMS.map(claim => {
                  const truthful = claimIsTruthful(claim, handIds, suspectId, weaponId, locationCardId)
                  const enabled = lives > 0 ? true : truthful
                  const color = CLAIM_COLOR[claim]
                  return (
                    <motion.button
                      key={claim}
                      className="font-pixel"
                      disabled={!enabled}
                      onClick={() => enabled && record(currentIdx, claim)}
                      style={{
                        background: '#0c0710',
                        border: `2px solid ${enabled ? color + '88' : '#241a24'}`,
                        color: enabled ? color : '#3a2f3a',
                        padding: '12px 10px', cursor: enabled ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', gap: 9,
                        letterSpacing: '1px', fontSize: '8px', opacity: enabled ? 1 : 0.5,
                      }}
                      whileHover={enabled ? { background: `${color}22`, borderColor: color } : {}}
                      whileTap={enabled ? { scale: 0.97 } : {}}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 15, lineHeight: 1 }}>{CLAIM_ICON[claim]}</span>
                      {CLAIM_LABEL[claim]}
                    </motion.button>
                  )
                })}
              </div>

              <div className="font-pixel" style={{ fontSize: '5px', color: '#4a3a2a', letterSpacing: '1px', marginTop: 14 }}>
                RESPONSES STAY HIDDEN UNTIL ALL PLAYERS HAVE ANSWERED
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
