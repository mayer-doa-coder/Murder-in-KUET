import { motion } from 'framer-motion'
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

const CATEGORY_COLOR: Record<string, string> = {
  suspect:  '#ff7755',
  weapon:   '#aabbff',
  location: '#44ccaa',
}

function HandCardsPanel({ hand }: { hand: import('../types').Card[] }) {
  const grouped: Record<string, import('../types').Card[]> = { suspect: [], weapon: [], location: [] }
  hand.forEach(c => grouped[c.category]?.push(c))

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      padding: '0 2px',
    }}>
      <div className="font-pixel" style={{
        fontSize: '8px', color: '#88ccee', letterSpacing: '3px', marginBottom: 2,
      }}>
        MY CARDS
      </div>
      <div className="font-pixel" style={{
        fontSize: '5px', color: '#335566', letterSpacing: '0.8px', marginBottom: 8,
      }}>
        {hand.length} CARD{hand.length !== 1 ? 'S' : ''} IN HAND
      </div>

      {hand.length === 0 ? (
        <div className="font-pixel" style={{
          fontSize: '6px', color: '#334455', letterSpacing: '1px',
          textAlign: 'center', padding: '16px 0',
        }}>
          NO CARDS IN HAND
        </div>
      ) : (
        (['suspect', 'weapon', 'location'] as const).map(cat => {
          const cards = grouped[cat]
          if (cards.length === 0) return null
          const color = CATEGORY_COLOR[cat]
          return (
            <div key={cat}>
              <div className="font-pixel" style={{
                fontSize: '6px', color, letterSpacing: '1.5px',
                marginBottom: 6, paddingBottom: 4,
                borderBottom: `1px solid ${color}33`,
              }}>
                ── {cat.toUpperCase()}S
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6,
              }}>
                {cards.map(card => (
                  <div key={card.id} style={{
                    display: 'flex', flexDirection: 'column',
                    background: card.bgColor,
                    border: `2px solid ${card.accentColor}66`,
                    overflow: 'hidden',
                    boxShadow: `0 0 8px ${card.accentColor}18`,
                  }}>
                    <div style={{ height: 70, position: 'relative', overflow: 'hidden' }}>
                      {card.imageSrc ? (
                        <img
                          src={card.imageSrc}
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
                          background: card.bgColor,
                        }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 22,
                            color: card.accentColor, lineHeight: 1,
                          }}>
                            {card.icon}
                          </span>
                        </div>
                      )}
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
                      }} />
                    </div>
                    <div style={{
                      background: 'rgba(0,0,0,0.82)',
                      borderTop: `1px solid ${card.accentColor}33`,
                      padding: '3px 4px',
                    }}>
                      <span className="font-pixel" style={{
                        fontSize: '5px', color: card.accentColor,
                        letterSpacing: '0.3px', display: 'block',
                        textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.4,
                      }}>
                        {card.name.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      <div className="font-pixel" style={{
        marginTop: 8, paddingTop: 8,
        borderTop: '1px solid #1a2a33',
        fontSize: '5px', color: '#334455', letterSpacing: '0.8px',
      }}>
        PRIVATE — NOT IN CASE FILE
      </div>
    </div>
  )
}

export default function ClueNotebook({ data, hand, onChange, onClose }: Props) {
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
          width: '92%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'linear' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '18px 22px 14px',
          borderBottom: '1px solid #1a3322',
          flexShrink: 0,
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

          <motion.button
            className="font-pixel"
            style={{
              background: 'transparent', border: '1px solid #226633',
              color: '#44cc88', fontSize: '7px', padding: '5px 10px',
              cursor: 'pointer', letterSpacing: '1px', flexShrink: 0,
            }}
            whileHover={{ background: '#22663322', borderColor: '#44cc88' }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.06 }}
            onClick={onClose}
          >
            ✕ CLOSE
          </motion.button>
        </div>

        {/* Two-panel body */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          {/* LEFT — notes panel */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px',
            borderRight: '2px solid #0d2016',
          }}>
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
          </div>

          {/* RIGHT — hand cards panel */}
          <div style={{
            width: 280, flexShrink: 0,
            overflowY: 'auto',
            padding: '18px 16px',
            background: '#02080a',
          }}>
            <HandCardsPanel hand={hand} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
