// OnlineGameBoardScreen — renders the authoritative server snapshot and turns the
// current player's clicks into action messages. It computes NO rules: reachable
// cells are derived only to draw highlights (the server re-validates every move),
// and every phase transition comes from the redacted GameView.

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { OnlineGame } from '../hooks/useOnlineGame'
import type { GameView } from '../shared/protocol'
import type { ResponseClaim } from '../shared/gameTypes'
import {
  initializeBoard, getReachableCells, getPassageDoors,
  ROOM_BOUNDS, VOID_BOUNDS, ROOM_DISPLAY_NAMES, ROOM_TO_LOCATION_CARD, COLS, ROWS,
} from '../shared/board'
import {
  RESPONSE_CLAIMS, CLAIM_LABEL, CLAIM_ICON, CLAIM_COLOR,
  claimIsTruthful, truthfulClaimFor, heartsFor,
} from '../shared/bluffChallenge'
import { ALL_CARDS, SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS } from '../types'

interface Props {
  online: OnlineGame
  onLeave: () => void
}

const board = initializeBoard()
const cardById = (id: string) => ALL_CARDS.find(c => c.id === id)
const pct = (n: number, total: number) => `${(n / total) * 100}%`

// ── Small pixel button ──────────────────────────────────────────────────────
function PB({ label, onClick, color = '#e8c060', disabled }: { label: string; onClick: () => void; color?: string; disabled?: boolean }) {
  return (
    <motion.button className="font-pixel" onClick={onClick} disabled={disabled}
      whileHover={disabled ? {} : { y: -2 }} whileTap={disabled ? {} : { y: 2 }}
      style={{
        background: disabled ? '#1a1000' : '#2a1800',
        border: `2px solid ${disabled ? '#3a2600' : color}`,
        color: disabled ? '#5a4420' : color,
        padding: '8px 12px', fontSize: '9px', letterSpacing: '1px',
        cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: '3px 3px 0 #000',
      }}>
      {label}
    </motion.button>
  )
}

export default function OnlineGameBoardScreen({ online, onLeave }: Props) {
  const view = online.view
  const [weaponPick, setWeaponPick] = useState(false)
  const [accuse, setAccuse] = useState<null | { s: string | null; w: string | null; l: string | null }>(null)
  const [challengePick, setChallengePick] = useState<number | null>(null)

  const me = view?.myIndex ?? -1
  const isMyTurn = !!view && view.currentTurnIndex === me && view.phase === 'turn'
  const token = view?.suspects.find(s => s.id === view.selectedSuspectId)

  // Reachable highlights (drawing only — server is authoritative).
  const highlights = useMemo(() => {
    const empty = { cells: [] as [number, number][], passage: [] as [number, number][] }
    if (!view || !isMyTurn || view.dice === null || view.hasMovedThisTurn || !token) return empty
    const cells = getReachableCells(board, token.position, view.dice)
    const passage = token.currentLocation ? getPassageDoors(token.currentLocation) : []
    return { cells, passage }
  }, [view, isMyTurn, token])

  if (!view) return null

  const send = online.send

  return (
    <div className="relative w-full h-full flex flex-col items-center" style={{ background: '#060400', overflow: 'hidden' }}>
      <TopBar view={view} onLeave={onLeave} />

      {/* Board */}
      <div style={{ position: 'relative', height: 'min(72vh, 94vw)', aspectRatio: `${COLS} / ${ROWS}`, margin: '6px auto',
        background: '#0a0700', border: '2px solid #2a1c00',
        backgroundImage: 'linear-gradient(rgba(80,55,0,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(80,55,0,0.08) 1px,transparent 1px)',
        backgroundSize: `${100 / COLS}% ${100 / ROWS}%` }}>

        {/* Void */}
        <Block bounds={VOID_BOUNDS} style={{ background: '#000' }} />

        {/* Rooms */}
        {Object.entries(ROOM_BOUNDS).map(([roomId, b]) => {
          const card = cardById(ROOM_TO_LOCATION_CARD[roomId] ?? '')
          const accent = card?.accentColor ?? '#664433'
          return (
            <Block key={roomId} bounds={b}
              style={{ background: `${accent}18`, border: `1px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="font-pixel" style={{ fontSize: 'clamp(4px,1vw,8px)', color: `${accent}cc`, letterSpacing: '1px', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3, padding: 2 }}>
                {ROOM_DISPLAY_NAMES[roomId] ?? roomId}
              </span>
            </Block>
          )
        })}

        {/* Reachable highlights */}
        {highlights.cells.map(([c, r]) => (
          <Cell key={`h${c}-${r}`} c={c} r={r} onClick={() => send({ type: 'move', col: c, row: r })}
            style={{ background: '#ffdd0033', border: '1px solid #ffdd0088', cursor: 'pointer' }} />
        ))}
        {highlights.passage.map(([c, r]) => (
          <Cell key={`p${c}-${r}`} c={c} r={r} onClick={() => send({ type: 'move', col: c, row: r })}
            style={{ background: '#aa44ff44', border: '1px solid #cc66ffaa', cursor: 'pointer' }} />
        ))}

        {/* Suspect tokens */}
        {view.suspects.map(s => {
          const card = SUSPECTS_CARDS.find(c => c.id === s.id)
          const [c, r] = s.position
          const selectable = isMyTurn && view.dice === null && !view.hasMovedThisTurn
          const isSel = s.id === view.selectedSuspectId
          return (
            <div key={s.id} onClick={selectable ? () => send({ type: 'pickSuspect', suspectId: s.id }) : undefined}
              style={{
                position: 'absolute', left: pct(c, COLS), top: pct(r, ROWS),
                width: pct(1, COLS), height: pct(1, ROWS),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: selectable ? 'pointer' : 'default', zIndex: 5,
              }}>
              <div style={{
                width: '86%', height: '86%', borderRadius: '50%',
                background: card?.bgColor ?? '#222',
                border: `2px solid ${isSel ? '#ffee55' : (card?.accentColor ?? '#888')}`,
                boxShadow: isSel ? `0 0 10px ${card?.accentColor ?? '#fff'}` : s.currentLocation ? '0 0 6px #000' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'clamp(6px,1.4vw,12px)', color: card?.accentColor ?? '#fff',
              }} className="font-pixel">
                {card?.icon ?? '?'}
              </div>
            </div>
          )
        })}
      </div>

      {/* My hand */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', padding: '2px 8px' }}>
        <span className="font-pixel" style={{ fontSize: '7px', color: '#886633', letterSpacing: '1px', alignSelf: 'center' }}>YOUR CARDS:</span>
        {view.myHand.map(id => {
          const card = cardById(id)
          return (
            <span key={id} className="font-pixel" style={{ fontSize: '7px', letterSpacing: '1px',
              background: '#140c00', border: `1px solid ${card?.accentColor ?? '#664433'}66`, color: card?.accentColor ?? '#cc8833', padding: '3px 5px' }}>
              {card?.icon} {card?.shortName ?? id}
            </span>
          )
        })}
      </div>

      {/* Action bar */}
      <ActionBar view={view} isMyTurn={isMyTurn} token={token} onRoll={() => send({ type: 'roll' })}
        onFinish={() => send({ type: 'finishMove' })}
        onInterrogate={() => setWeaponPick(true)} onAccuse={() => setAccuse({ s: null, w: null, l: null })}
        onEndTurn={() => send({ type: 'endTurn' })} />

      {/* ── Overlays ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {weaponPick && (
          <Picker key="weapon" title="CHOOSE THE WEAPON" cards={WEAPONS_CARDS}
            onPick={(id) => { setWeaponPick(false); send({ type: 'interrogate', weaponId: id }) }}
            onClose={() => setWeaponPick(false)} />
        )}

        {accuse && (
          <AccusePanel key="accuse" state={accuse} setState={setAccuse}
            onConfirm={(s, w, l) => { setAccuse(null); send({ type: 'accuse', suspectId: s, weaponId: w, locationId: l }) }}
            onClose={() => setAccuse(null)} />
        )}

        {view.phase === 'response' && (
          <ResponseOverlay key="resp" view={view}
            onRespond={(claim) => send({ type: 'respond', claim })} />
        )}

        {view.phase === 'challenge' && (
          <ChallengeOverlay key="chal" view={view} pick={challengePick} setPick={setChallengePick}
            onResolve={(ci, rt) => { setChallengePick(null); send({ type: 'challenge', challengedIndex: ci, revealTargetIndex: rt }) }} />
        )}

        {view.phase === 'reveal' && (
          <RevealOverlay key="reveal" view={view} onContinue={() => send({ type: 'continue' })} />
        )}

        {view.phase === 'game_over' && (
          <GameOverOverlay key="over" view={view} onLeave={onLeave} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ══ Board helpers ════════════════════════════════════════════════════════════
function Block({ bounds, style, children }: { bounds: [number, number, number, number]; style?: React.CSSProperties; children?: React.ReactNode }) {
  const [c0, c1, r0, r1] = bounds
  return (
    <div style={{ position: 'absolute', left: pct(c0, COLS), top: pct(r0, ROWS),
      width: pct(c1 - c0 + 1, COLS), height: pct(r1 - r0 + 1, ROWS), ...style }}>
      {children}
    </div>
  )
}
function Cell({ c, r, style, onClick }: { c: number; r: number; style?: React.CSSProperties; onClick?: () => void }) {
  return <div onClick={onClick} style={{ position: 'absolute', left: pct(c, COLS), top: pct(r, ROWS), width: pct(1, COLS), height: pct(1, ROWS), ...style }} />
}

// ══ Top bar (players + turn) ═════════════════════════════════════════════════
function TopBar({ view, onLeave }: { view: GameView; onLeave: () => void }) {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', flexWrap: 'wrap' }}>
      {view.players.map(p => {
        const active = p.index === view.currentTurnIndex
        return (
          <div key={p.index} className="font-pixel" style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '3px 7px',
            background: active ? 'rgba(40,25,0,0.9)' : 'rgba(15,10,0,0.6)',
            border: `1px solid ${active ? p.color : '#2a1800'}`,
            opacity: p.eliminated ? 0.4 : 1,
          }}>
            <span style={{ fontSize: '9px', color: p.color }}>{p.icon}</span>
            <span style={{ fontSize: '7px', color: active ? '#e8c060' : '#886633', letterSpacing: '1px' }}>
              {p.name.toUpperCase()}{p.index === view.myIndex ? '*' : ''}
            </span>
            <span style={{ fontSize: '8px', color: '#cc4466' }}>{heartsFor(p.lives)}</span>
            {p.eliminated && <span style={{ fontSize: '7px', color: '#cc4422' }}>✗</span>}
            {!p.connected && <span style={{ fontSize: '6px', color: '#775533' }}>○</span>}
          </div>
        )
      })}
      <button className="font-pixel" onClick={onLeave} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #3d2000', color: '#664433', fontSize: '7px', padding: '3px 7px', letterSpacing: '1px', cursor: 'pointer' }}>
        LEAVE
      </button>
    </div>
  )
}

// ══ Action bar ═══════════════════════════════════════════════════════════════
function ActionBar({ view, isMyTurn, token, onRoll, onFinish, onInterrogate, onAccuse, onEndTurn }: {
  view: GameView; isMyTurn: boolean; token: GameView['suspects'][number] | undefined
  onRoll: () => void; onFinish: () => void; onInterrogate: () => void; onAccuse: () => void; onEndTurn: () => void
}) {
  const cur = view.players[view.currentTurnIndex]
  if (view.phase !== 'turn') return null
  if (!isMyTurn) {
    return (
      <div className="font-pixel" style={{ fontSize: '9px', color: '#ccaa00', letterSpacing: '2px', padding: '10px', textAlign: 'center' }}>
        WAITING FOR {cur?.name.toUpperCase()}…
      </div>
    )
  }
  const inRoom = !!token?.currentLocation
  const canAccuse = !view.players[view.myIndex]?.hasAccused
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: '8px' }}>
      {!view.selectedSuspectId && <span className="font-pixel" style={{ fontSize: '8px', color: '#ccaa00', alignSelf: 'center', letterSpacing: '1px' }}>▶ CLICK A SUSPECT TOKEN TO MOVE IT</span>}
      {view.selectedSuspectId && view.dice === null && !view.hasMovedThisTurn && <PB label="🎲 ROLL DICE" onClick={onRoll} />}
      {view.dice !== null && !view.hasMovedThisTurn && <span className="font-pixel" style={{ fontSize: '9px', color: '#ffdd44', alignSelf: 'center', letterSpacing: '1px' }}>🎲 {view.dice} — CLICK A HIGHLIGHTED CELL</span>}
      {view.dice !== null && !view.hasMovedThisTurn && <PB label="STOP HERE" color="#aa8844" onClick={onFinish} />}
      {view.hasMovedThisTurn && inRoom && <PB label="🔍 INTERROGATE" color="#ff8844" onClick={onInterrogate} />}
      {view.hasMovedThisTurn && <PB label="⚖ ACCUSE" color="#cc4466" disabled={!canAccuse} onClick={onAccuse} />}
      {view.hasMovedThisTurn && <PB label="END TURN" color="#889099" onClick={onEndTurn} />}
    </div>
  )
}

// ══ Card picker (weapon / generic) ═══════════════════════════════════════════
function Picker({ title, cards, onPick, onClose }: { title: string; cards: typeof WEAPONS_CARDS; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="font-pixel" style={{ fontSize: '12px', color: '#e8c060', letterSpacing: '2px', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 420 }}>
        {cards.map(c => (
          <button key={c.id} className="font-pixel" onClick={() => onPick(c.id)}
            style={{ background: c.bgColor, border: `2px solid ${c.accentColor}`, color: c.accentColor, padding: '10px 8px', width: 92, cursor: 'pointer', fontSize: '8px', letterSpacing: '1px' }}>
            <div style={{ fontSize: '18px', marginBottom: 4 }}>{c.icon}</div>
            {c.name.toUpperCase()}
          </button>
        ))}
      </div>
      <button className="font-pixel" onClick={onClose} style={{ marginTop: 16, background: 'none', border: 'none', color: '#775533', fontSize: '8px', cursor: 'pointer', letterSpacing: '2px' }}>◄ CANCEL</button>
    </Modal>
  )
}

// ══ Accusation panel ═════════════════════════════════════════════════════════
function AccusePanel({ state, setState, onConfirm, onClose }: {
  state: { s: string | null; w: string | null; l: string | null }
  setState: (v: { s: string | null; w: string | null; l: string | null }) => void
  onConfirm: (s: string, w: string, l: string) => void; onClose: () => void
}) {
  const col = (title: string, cards: typeof SUSPECTS_CARDS, key: 's' | 'w' | 'l') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', letterSpacing: '1px', marginBottom: 4 }}>{title}</div>
      {cards.map(c => (
        <button key={c.id} className="font-pixel" onClick={() => setState({ ...state, [key]: c.id })}
          style={{ background: state[key] === c.id ? c.bgColor : '#140c00', border: `1px solid ${state[key] === c.id ? c.accentColor : '#33240c'}`,
            color: state[key] === c.id ? c.accentColor : '#775533', padding: '5px 7px', fontSize: '7px', letterSpacing: '1px', cursor: 'pointer', textAlign: 'left' }}>
          {c.icon} {c.name.toUpperCase()}
        </button>
      ))}
    </div>
  )
  const ready = state.s && state.w && state.l
  return (
    <Modal onClose={onClose}>
      <div className="font-pixel" style={{ fontSize: '12px', color: '#cc4466', letterSpacing: '2px', marginBottom: 6 }}>⚖ FINAL ACCUSATION</div>
      <div className="font-pixel" style={{ fontSize: '7px', color: '#886633', letterSpacing: '1px', marginBottom: 14 }}>WRONG ACCUSATION ELIMINATES YOU — CHOOSE CAREFULLY</div>
      <div style={{ display: 'flex', gap: 14 }}>
        {col('SUSPECT', SUSPECTS_CARDS, 's')}
        {col('WEAPON', WEAPONS_CARDS, 'w')}
        {col('LOCATION', LOCATIONS_CARDS, 'l')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <PB label="⚖ ACCUSE" color="#cc4466" disabled={!ready} onClick={() => ready && onConfirm(state.s!, state.w!, state.l!)} />
        <PB label="◄ CANCEL" color="#889099" onClick={onClose} />
      </div>
    </Modal>
  )
}

// ══ Response overlay ═════════════════════════════════════════════════════════
function ResponseOverlay({ view, onRespond }: { view: GameView; onRespond: (claim: ResponseClaim) => void }) {
  const s = view.pendingSuggestion!
  const mine = view.awaitingResponders.includes(view.myIndex)
  const myLives = view.players[view.myIndex]?.lives ?? 0
  const mustTellTruth = myLives <= 0
  const truthful = truthfulClaimFor(view.myHand, s.suspectId, s.weaponId, s.locationCardId)

  return (
    <Modal>
      <SuggestionHeader view={view} />
      {mine ? (
        <>
          <div className="font-pixel" style={{ fontSize: '9px', color: '#e8c060', letterSpacing: '1px', margin: '14px 0 6px' }}>
            DO YOU DISPROVE THIS? {mustTellTruth && <span style={{ color: '#ff6644' }}>(NO LIVES — MUST BE TRUTHFUL)</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {RESPONSE_CLAIMS.map(claim => {
              const isTruth = claimIsTruthful(claim, view.myHand, s.suspectId, s.weaponId, s.locationCardId)
              const locked = mustTellTruth && !isTruth
              return (
                <button key={claim} className="font-pixel" disabled={locked} onClick={() => onRespond(claim)}
                  style={{ background: '#140c00', border: `2px solid ${locked ? '#33240c' : CLAIM_COLOR[claim]}`,
                    color: locked ? '#443311' : CLAIM_COLOR[claim], padding: '9px 10px', fontSize: '8px', letterSpacing: '1px',
                    cursor: locked ? 'not-allowed' : 'pointer' }}>
                  {CLAIM_ICON[claim]} {CLAIM_LABEL[claim]}{claim === truthful ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
          <div className="font-pixel" style={{ fontSize: '7px', color: '#886633', marginTop: 10, letterSpacing: '1px' }}>✓ = YOUR TRUTHFUL ANSWER · LYING IS ALLOWED IF YOU HAVE LIVES</div>
        </>
      ) : (
        <WaitingList view={view} label="WAITING FOR RESPONSES" ids={view.awaitingResponders} />
      )}
    </Modal>
  )
}

// ══ Challenge overlay ════════════════════════════════════════════════════════
function ChallengeOverlay({ view, pick, setPick, onResolve }: {
  view: GameView; pick: number | null; setPick: (v: number | null) => void
  onResolve: (challengedIndex: number | null, revealTargetIndex: number | null) => void
}) {
  const s = view.pendingSuggestion!
  const amInvestigator = view.myIndex === s.investigatorIndex
  const claimants = view.responses.filter(r => r.claim !== 'cannot')

  if (!amInvestigator) {
    return <Modal><SuggestionHeader view={view} /><WaitingList view={view} label="INVESTIGATOR IS DECIDING…" ids={[s.investigatorIndex]} /></Modal>
  }

  return (
    <Modal>
      <SuggestionHeader view={view} />
      <div className="font-pixel" style={{ fontSize: '9px', color: '#e8c060', letterSpacing: '1px', margin: '14px 0 6px' }}>RESPONSES — CHALLENGE A BLUFF?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', maxWidth: 340 }}>
        {view.responses.map(r => {
          const p = view.players[r.playerIndex]
          return (
            <button key={r.playerIndex} className="font-pixel" onClick={() => setPick(pick === r.playerIndex ? null : r.playerIndex)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: pick === r.playerIndex ? 'rgba(120,20,40,0.4)' : '#140c00',
                border: `1px solid ${pick === r.playerIndex ? '#cc4466' : '#33240c'}`, color: '#cc9', padding: '7px 9px', fontSize: '8px', cursor: 'pointer', letterSpacing: '1px' }}>
              <span style={{ color: p.color }}>{p.icon} {p.name.toUpperCase()}</span>
              <span style={{ marginLeft: 'auto', color: CLAIM_COLOR[r.claim] }}>{CLAIM_ICON[r.claim]} {CLAIM_LABEL[r.claim]}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <PB label={pick === null ? 'CHALLENGE (SELECT ONE)' : '⚡ CHALLENGE'} color="#cc4466" disabled={pick === null}
          onClick={() => onResolve(pick, claimants[0]?.playerIndex ?? null)} />
        <PB label="SKIP — DEMAND A CARD" color="#889099"
          onClick={() => onResolve(null, claimants[0]?.playerIndex ?? null)} />
      </div>
      <div className="font-pixel" style={{ fontSize: '7px', color: '#886633', marginTop: 10, letterSpacing: '1px', maxWidth: 320, textAlign: 'center', lineHeight: 1.7 }}>
        CHALLENGE IF YOU THINK A CLAIM IS A LIE. IF RIGHT, THE BLUFFER LOSES A LIFE; IF WRONG, YOU DO. A TRUE CLAIMANT WILL PRIVATELY SHOW YOU THEIR CARD.
      </div>
    </Modal>
  )
}

// ══ Reveal overlay ═══════════════════════════════════════════════════════════
function RevealOverlay({ view, onContinue }: { view: GameView; onContinue: () => void }) {
  const rv = view.reveal
  if (!rv) return null
  const myTurn = view.currentTurnIndex === view.myIndex
  const revealed = rv.revealedCardId ? cardById(rv.revealedCardId) : null

  return (
    <Modal>
      {rv.type === 'accusation' ? (
        <>
          <div className="font-pixel" style={{ fontSize: '14px', letterSpacing: '2px', color: rv.correct ? '#33cc55' : '#cc4422' }}>
            {rv.correct ? '✓ CORRECT ACCUSATION' : '✗ WRONG ACCUSATION'}
          </div>
          <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', marginTop: 10, letterSpacing: '1px' }}>
            {rv.accusingPlayerName?.toUpperCase()} ACCUSED:
          </div>
          <TriCard s={rv.suspectId} w={rv.weaponId} l={rv.locationId} />
          {!rv.correct && <div className="font-pixel" style={{ fontSize: '8px', color: '#cc4422', marginTop: 10, letterSpacing: '1px' }}>{rv.accusingPlayerName?.toUpperCase()} IS ELIMINATED</div>}
        </>
      ) : (
        <>
          <div className="font-pixel" style={{ fontSize: '12px', color: '#e8c060', letterSpacing: '2px' }}>🔍 INTERROGATION</div>
          <div className="font-pixel" style={{ fontSize: '7px', color: '#886633', marginTop: 8, letterSpacing: '1px' }}>{rv.investigatorName?.toUpperCase()} SUGGESTED:</div>
          <TriCard s={rv.suspectId} w={rv.weaponId} l={rv.locationId} />
          {rv.challenge?.challengedIndex !== null && rv.challenge && (
            <div className="font-pixel" style={{ fontSize: '8px', marginTop: 12, letterSpacing: '1px', color: rv.challenge.wasBluff ? '#33cc55' : '#cc4422' }}>
              {rv.challenge.challengerName?.toUpperCase()} CHALLENGED {rv.challenge.challengedName?.toUpperCase()} — {rv.challenge.wasBluff ? 'BLUFF CAUGHT!' : 'HONEST!'} ({rv.challenge.penalizedName?.toUpperCase()} −1♥)
            </div>
          )}
          <div className="font-pixel" style={{ fontSize: '9px', marginTop: 12, letterSpacing: '1px', color: '#e8c060' }}>
            {revealed ? `${rv.revealedByName?.toUpperCase()} SHOWED YOU: ${revealed.icon} ${revealed.name.toUpperCase()}`
              : rv.revealedByName ? `${rv.revealedByName.toUpperCase()} DISPROVED IT (CARD SHOWN PRIVATELY)`
              : rv.bluffedReveal ? 'THE CLAIMANT HAD NOTHING — YOU WERE BLUFFED!'
              : rv.noOneCouldDisprove ? 'NO ONE COULD DISPROVE IT' : 'NO CARD REVEALED'}
          </div>
        </>
      )}
      {myTurn
        ? <div style={{ marginTop: 20 }}><PB label="► CONTINUE" onClick={onContinue} /></div>
        : <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', marginTop: 20, letterSpacing: '2px' }}>WAITING FOR {view.players[view.currentTurnIndex]?.name.toUpperCase()}…</div>}
    </Modal>
  )
}

// ══ Game over ════════════════════════════════════════════════════════════════
function GameOverOverlay({ view, onLeave }: { view: GameView; onLeave: () => void }) {
  const winner = view.winnerIndex !== null ? view.players[view.winnerIndex] : null
  return (
    <Modal>
      <div className="font-pixel" style={{ fontSize: '16px', letterSpacing: '3px', color: winner ? '#ffdd44' : '#cc4422' }}>
        {winner ? `${winner.name.toUpperCase()} WINS!` : 'NO WINNER'}
      </div>
      {view.caseFile && (
        <>
          <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', marginTop: 14, letterSpacing: '1px' }}>THE SOLUTION WAS:</div>
          <TriCard s={view.caseFile.suspect} w={view.caseFile.weapon} l={view.caseFile.location} />
        </>
      )}
      <div style={{ marginTop: 22 }}><PB label="► LEAVE GAME" onClick={onLeave} /></div>
    </Modal>
  )
}

// ══ Shared bits ══════════════════════════════════════════════════════════════
function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(4,2,0,0.9)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 520 }}>
        {children}
      </div>
    </motion.div>
  )
}
function SuggestionHeader({ view }: { view: GameView }) {
  const s = view.pendingSuggestion!
  return (
    <>
      <div className="font-pixel" style={{ fontSize: '10px', color: '#ff8844', letterSpacing: '2px' }}>🔍 {view.players[s.investigatorIndex]?.name.toUpperCase()} INTERROGATES</div>
      <TriCard s={s.suspectId} w={s.weaponId} l={s.locationCardId} />
    </>
  )
}
function TriCard({ s, w, l }: { s: string; w: string; l: string }) {
  const one = (id: string) => {
    const c = cardById(id)
    return (
      <div className="font-pixel" style={{ background: c?.bgColor ?? '#140c00', border: `2px solid ${c?.accentColor ?? '#664433'}`, color: c?.accentColor ?? '#cc8833', padding: '8px 6px', width: 90, textAlign: 'center', fontSize: '7px', letterSpacing: '1px' }}>
        <div style={{ fontSize: '20px', marginBottom: 4 }}>{c?.icon}</div>
        {c?.name.toUpperCase()}
      </div>
    )
  }
  return <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>{one(s)}{one(w)}{one(l)}</div>
}
function WaitingList({ view, label, ids }: { view: GameView; label: string; ids: number[] }) {
  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <motion.div className="font-pixel" style={{ fontSize: '9px', color: '#ccaa00', letterSpacing: '2px' }}
        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>{label}</motion.div>
      <div className="font-pixel" style={{ fontSize: '8px', color: '#886633', marginTop: 8, letterSpacing: '1px' }}>
        {ids.map(i => view.players[i]?.name.toUpperCase()).join(' · ')}
      </div>
    </div>
  )
}
