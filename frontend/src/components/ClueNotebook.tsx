import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { NotebookBoxState, NotebookData } from '../types'
import { SUSPECTS_CARDS, WEAPONS_CARDS, LOCATIONS_CARDS } from '../types'

const CYCLE: NotebookBoxState[] = ['', 'X', '✓']
const nextState = (s: NotebookBoxState): NotebookBoxState =>
  CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length]

const boxColor = (s: NotebookBoxState) =>
  s === 'X' ? '#ff4444' : s === '✓' ? '#44ee88' : '#333355'

interface Props {
  data:     NotebookData
  hand:     import('../types').Card[]
  onChange: (category: 'suspects' | 'weapons' | 'locations', cardId: string, next: NotebookBoxState) => void
  onClose:  () => void
}

function Row({
  icon, imageSrc, name, accentColor, state, onClick,
}: {
  icon: string; imageSrc?: string; name: string; accentColor: string
  state: NotebookBoxState; onClick: () => void
}) {
  const bc = boxColor(state)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 6px',
      background: state === 'X' ? '#120404' : state === '✓' ? '#041208' : 'transparent',
      borderBottom: '1px solid #111118',
    }}>
      {imageSrc ? (
        <img
          src={imageSrc}
          style={{
            width: 18, height: 18,
            imageRendering: 'pixelated',
            objectFit: 'contain',
            flexShrink: 0,
            opacity: state === 'X' ? 0.4 : 1,
          }}
        />
      ) : (
        <span style={{
          fontFamily: 'monospace', fontSize: 13, color: accentColor,
          lineHeight: 1, width: 18, flexShrink: 0, textAlign: 'center',
        }}>
          {icon}
        </span>
      )}
      <span
        className="font-pixel"
        style={{
          flex: 1,
          fontSize: '6px',
          color: state === 'X' ? '#664444' : state === '✓' ? '#448844' : '#999',
          letterSpacing: '0.5px',
          textDecoration: state === 'X' ? 'line-through' : 'none',
        }}
      >
        {name.toUpperCase()}
      </span>
      <motion.button
        onClick={onClick}
        style={{
          width: 22, height: 22,
          background: state !== '' ? bc + '1a' : '#080810',
          border: `2px solid ${state !== '' ? bc : '#2a2a3a'}`,
          color: state !== '' ? bc : '#3a3a4a',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace',
          fontSize: state === '✓' ? 13 : 11,
          fontWeight: 'bold',
          flexShrink: 0,
          outline: 'none',
        }}
        whileHover={{ borderColor: '#44cc88', color: '#44cc88' }}
        whileTap={{ scale: 0.84 }}
        transition={{ duration: 0.06 }}
      >
        {state || '·'}
      </motion.button>
    </div>
  )
}

function Section({
  title, cards, states, category, onChange,
}: {
  title: string
  cards: { id: string; name: string; icon: string; imageSrc?: string; accentColor: string }[]
  states: Record<string, NotebookBoxState>
  category: 'suspects' | 'weapons' | 'locations'
  onChange: Props['onChange']
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        className="font-pixel"
        style={{
          fontSize: '7px', color: '#44cc88', letterSpacing: '2px',
          marginBottom: 6, paddingBottom: 5,
          borderBottom: '1px solid #1a3322',
        }}
      >
        ── {title}
      </div>
      {cards.map(card => (
        <Row
          key={card.id}
          icon={card.icon}
          imageSrc={card.imageSrc}
          name={card.name}
          accentColor={card.accentColor}
          state={states[card.id] ?? ''}
          onClick={() => onChange(category, card.id, nextState(states[card.id] ?? ''))}
        />
      ))}
    </div>
  )
}

// ── Card reference popup ──────────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, string> = {
  suspect:  '#ff7755',
  weapon:   '#aabbff',
  location: '#44ccaa',
}
const CATEGORY_LABEL: Record<string, string> = {
  suspect:  'SUSPECT',
  weapon:   'WEAPON',
  location: 'LOCATION',
}

function CardReferencePopup({ hand, onClose }: { hand: import('../types').Card[]; onClose: () => void }) {
  const grouped: Record<string, import('../types').Card[]> = { suspect: [], weapon: [], location: [] }
  hand.forEach(c => grouped[c.category]?.push(c))

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease: 'linear' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        style={{
          background: '#06080a',
          border: '2px solid #224455',
          boxShadow: '0 0 40px #22445544',
          padding: '18px 22px',
          width: '92%',
          maxHeight: '82vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
        initial={{ scale: 0.9, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 14 }}
        transition={{ duration: 0.16, ease: 'linear' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14, paddingBottom: 10,
          borderBottom: '1px solid #1a2a33',
        }}>
          <div>
            <div className="font-pixel" style={{ fontSize: '8px', color: '#88ccee', letterSpacing: '3px' }}>
              MY CARDS
            </div>
            <div className="font-pixel" style={{ fontSize: '5px', color: '#335566', letterSpacing: '0.8px', marginTop: 4 }}>
              {hand.length} CARD{hand.length !== 1 ? 'S' : ''} IN YOUR HAND
            </div>
          </div>
          <motion.button
            className="font-pixel"
            style={{
              background: 'transparent', border: '1px solid #224455',
              color: '#88ccee', fontSize: '7px', padding: '5px 10px',
              cursor: 'pointer', letterSpacing: '1px', flexShrink: 0,
            }}
            whileHover={{ background: '#22445522', borderColor: '#88ccee' }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.06 }}
            onClick={onClose}
          >
            ✕ CLOSE
          </motion.button>
        </div>

        {/* Cards grouped by category */}
        {hand.length === 0 ? (
          <div className="font-pixel" style={{ fontSize: '6px', color: '#334455', letterSpacing: '1px', textAlign: 'center', padding: '16px 0' }}>
            NO CARDS IN HAND
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(['suspect', 'weapon', 'location'] as const).map(cat => {
              const cards = grouped[cat]
              if (cards.length === 0) return null
              const color = CATEGORY_COLOR[cat]
              return (
                <div key={cat}>
                  <div className="font-pixel" style={{
                    fontSize: '6px', color, letterSpacing: '1.5px',
                    marginBottom: 6, paddingBottom: 5,
                    borderBottom: `1px solid ${color}33`,
                  }}>
                    ── {CATEGORY_LABEL[cat]}S
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {cards.map((card, i) => (
                      <div key={card.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 8px',
                        background: '#0a0d10',
                        border: `1px solid ${color}22`,
                      }}>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 7,
                          color: `${color}77`, lineHeight: 1, flexShrink: 0,
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="font-pixel" style={{
                          flex: 1,
                          fontSize: '6px', color: '#ccdde8',
                          letterSpacing: '0.5px', lineHeight: 1.4,
                        }}>
                          {card.name.toUpperCase()}
                        </span>
                        <span className="font-pixel" style={{
                          fontSize: '4px', color: `${color}99`,
                          letterSpacing: '0.5px', flexShrink: 0,
                        }}>
                          {card.shortName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer hint */}
        <div className="font-pixel" style={{
          marginTop: 14, paddingTop: 10,
          borderTop: '1px solid #1a2a33',
          fontSize: '5px', color: '#334455', letterSpacing: '0.8px', textAlign: 'center',
        }}>
          THESE ARE YOUR PRIVATE CARDS — THEY ARE NOT IN THE CASE FILE
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function ClueNotebook({ data, hand, onChange, onClose }: Props) {
  const [showCardList, setShowCardList] = useState(false)

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 46,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'linear' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        style={{
          background: '#040a06',
          border: '2px solid #226633',
          boxShadow: '0 0 60px #22663333',
          padding: '22px 26px',
          width: '90%',
          maxWidth: 460,
          maxHeight: '88vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'linear' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 14, paddingBottom: 12,
          borderBottom: '1px solid #1a3322',
        }}>
          <div>
            <div className="font-pixel" style={{ fontSize: '9px', color: '#44cc88', letterSpacing: '3px' }}>
              CLUE NOTES
            </div>
            <div className="font-pixel" style={{
              fontSize: '5px', color: '#336644', letterSpacing: '0.8px', marginTop: 5,
            }}>
              CLICK BOX TO CYCLE: · → X → ✓ → ·
            </div>
          </div>

          {/* Header buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <motion.button
              className="font-pixel"
              style={{
                background: showCardList ? '#1a2a3322' : 'transparent',
                border: `1px solid ${showCardList ? '#88ccee' : '#1a3344'}`,
                color: showCardList ? '#88ccee' : '#336655',
                fontSize: '6px', padding: '5px 8px',
                cursor: 'pointer', letterSpacing: '0.8px',
              }}
              whileHover={{ background: '#1a2a3322', borderColor: '#88ccee', color: '#88ccee' }}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.06 }}
              onClick={() => setShowCardList(v => !v)}
            >
              ◈ CARD LIST
            </motion.button>

            <motion.button
              className="font-pixel"
              style={{
                background: 'transparent', border: '1px solid #226633',
                color: '#44cc88', fontSize: '7px', padding: '5px 10px',
                cursor: 'pointer', letterSpacing: '1px',
              }}
              whileHover={{ background: '#22663322', borderColor: '#44cc88' }}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.06 }}
              onClick={onClose}
            >
              ✕ CLOSE
            </motion.button>
          </div>
        </div>

        {/* Legend */}
        <div
          className="font-pixel"
          style={{
            display: 'flex', gap: 14, marginBottom: 14,
            fontSize: '5px', letterSpacing: '0.5px',
          }}
        >
          <span style={{ color: '#444455' }}>· UNKNOWN</span>
          <span style={{ color: '#ff4444' }}>X ELIMINATED</span>
          <span style={{ color: '#44ee88' }}>✓ CONFIRMED</span>
        </div>

        <Section
          title="SUSPECTS"
          cards={SUSPECTS_CARDS}
          states={data.suspects}
          category="suspects"
          onChange={onChange}
        />
        <Section
          title="WEAPONS"
          cards={WEAPONS_CARDS}
          states={data.weapons}
          category="weapons"
          onChange={onChange}
        />
        <Section
          title="LOCATIONS"
          cards={LOCATIONS_CARDS}
          states={data.locations}
          category="locations"
          onChange={onChange}
        />

        {/* Card reference popup — sits inside the notebook panel */}
        <AnimatePresence>
          {showCardList && (
            <CardReferencePopup hand={hand} onClose={() => setShowCardList(false)} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
