import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

type ActionId = 'roll' | 'interrogation' | 'accusation' | 'endturn' | 'cards' | 'notes'

interface MenuEntry {
  id: ActionId
  label: string
  enabled: boolean
}

const ITEMS: MenuEntry[] = [
  { id: 'roll',          label: 'ROLL',          enabled: true },
  { id: 'interrogation', label: 'INTERROGATION', enabled: true },
  { id: 'accusation',    label: 'ACCUSATION',    enabled: true },
  { id: 'endturn',       label: 'END TURN',      enabled: true },
  { id: 'cards',         label: 'CARDS',         enabled: true },
  { id: 'notes',         label: 'CLUE NOTES',    enabled: true },
]

interface Props {
  playerName: string
  playerIcon: string
  playerImageSrc?: string
  playerColor: string
  playerIndex: number
  onAction: (id: ActionId) => void
  disabledActions?: ActionId[]
  hint?: string
}

export default function TurnOverlay({
  playerName, playerIcon, playerImageSrc, playerColor, playerIndex, onAction, disabledActions = [], hint,
}: Props) {
  const selectableIndices = ITEMS.map((item, i) =>
    item.enabled && !disabledActions.includes(item.id) ? i : -1
  ).filter(i => i >= 0)

  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    setCursor(0)
  }, [disabledActions.join(',')])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectableIndices.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor(c => (c + 1) % selectableIndices.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor(c => (c - 1 + selectableIndices.length) % selectableIndices.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const itemIndex = selectableIndices[Math.min(cursor, selectableIndices.length - 1)]
        if (itemIndex !== undefined) onAction(ITEMS[itemIndex].id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cursor, onAction, selectableIndices])

  const activeCursorItemIndex = selectableIndices[Math.min(cursor, selectableIndices.length - 1)]

  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 14,
        left: '50%',
        translateX: '-50%',
        zIndex: 20,
        background: '#0c0010',
        border: `2px solid ${playerColor}77`,
        padding: '14px 22px',
        minWidth: 230,
        boxShadow: `0 0 28px ${playerColor}33`,
        pointerEvents: 'none',
      }}
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.18, ease: 'linear' }}
    >
      {/* Player header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 10, marginBottom: 10,
        borderBottom: `1px solid ${playerColor}44`,
      }}>
        {playerImageSrc ? (
          <img
            src={playerImageSrc}
            style={{
              width: 28,
              height: 28,
              imageRendering: 'pixelated',
              objectFit: 'contain',
              flexShrink: 0,
              filter: `drop-shadow(0 0 4px ${playerColor}99)`,
            }}
          />
        ) : (
          <span style={{
            fontFamily: 'monospace', fontSize: 22,
            color: playerColor,
            textShadow: `0 0 8px ${playerColor}99`,
            lineHeight: 1, flexShrink: 0,
          }}>
            {playerIcon}
          </span>
        )}
        <div>
          <div className="font-pixel" style={{
            fontSize: '7px', color: '#cc8833', letterSpacing: '1.5px', marginBottom: 4,
          }}>P{playerIndex + 1}</div>
          <div className="font-pixel" style={{
            fontSize: '8px', color: playerColor, letterSpacing: '1px',
          }}>
            {playerName}
          </div>
        </div>
      </div>

      {/* YOUR TURN label */}
      <motion.div
        className="font-pixel"
        style={{ fontSize: '7px', color: '#ddaa33', letterSpacing: '3px', marginBottom: 13 }}
        animate={{ opacity: [1, 0.55, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
      >
        ─ YOUR TURN ─
      </motion.div>

      {/* Contextual hint (e.g. pick a suspect token before rolling) */}
      {hint && (
        <motion.div
          className="font-pixel"
          style={{ fontSize: '6px', color: '#88cc55', letterSpacing: '1px', marginBottom: 11, lineHeight: 1.6 }}
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        >
          {hint}
        </motion.div>
      )}

      {/* Menu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {ITEMS.map((item, i) => {
          const isCursorHere = i === activeCursorItemIndex
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {/* Cursor */}
              <motion.span
                className="font-pixel"
                style={{
                  fontSize: '8px',
                  width: 11,
                  flexShrink: 0,
                  color: isCursorHere ? '#ffdd00' : 'transparent',
                }}
                animate={isCursorHere ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
              >
                ▶
              </motion.span>

              {/* Label */}
              <span className="font-pixel" style={{
                fontSize: '7px',
                color: !item.enabled
                  ? '#443333'
                  : disabledActions.includes(item.id)
                    ? '#664422'
                    : isCursorHere
                      ? '#ffdd00'
                      : '#cc8855',
                letterSpacing: '0.8px',
              }}>
                {item.label}
              </span>

              {/* Runtime-disabled indicator */}
              {item.enabled && disabledActions.includes(item.id) && (
                <span className="font-pixel" style={{
                  fontSize: '5px', color: '#884422', marginLeft: 2,
                }}>
                  [N/A]
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <div className="font-pixel" style={{
        marginTop: 13, paddingTop: 9,
        borderTop: `1px solid ${playerColor}33`,
        fontSize: '6px', color: '#886633', letterSpacing: '1px', lineHeight: 2,
      }}>
        <div>↑↓ NAVIGATE</div>
        <div>[ENTER] SELECT</div>
      </div>
    </motion.div>
  )
}
