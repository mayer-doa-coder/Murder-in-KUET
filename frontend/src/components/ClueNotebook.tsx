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
  onChange: (category: 'suspects' | 'weapons' | 'locations', cardId: string, next: NotebookBoxState) => void
  onClose:  () => void
}

function Row({
  icon, name, accentColor, state, onClick,
}: {
  icon: string; name: string; accentColor: string
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
      <span style={{
        fontFamily: 'monospace', fontSize: 13, color: accentColor,
        lineHeight: 1, width: 18, flexShrink: 0, textAlign: 'center',
      }}>
        {icon}
      </span>
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
  cards: { id: string; name: string; icon: string; accentColor: string }[]
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
          name={card.name}
          accentColor={card.accentColor}
          state={states[card.id] ?? ''}
          onClick={() => onChange(category, card.id, nextState(states[card.id] ?? ''))}
        />
      ))}
    </div>
  )
}

export default function ClueNotebook({ data, onChange, onClose }: Props) {
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
      </motion.div>
    </motion.div>
  )
}
