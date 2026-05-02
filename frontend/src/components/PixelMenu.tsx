import { motion } from 'framer-motion'
import PixelCursor from './PixelCursor'

export interface MenuItem {
  label: string
  desc?: string
  accentColor?: string
}

interface PixelMenuProps {
  items: MenuItem[]
  selectedIndex: number
  onItemHover: (i: number) => void
  onItemClick: (i: number) => void
  entryDelay?: number
}

export default function PixelMenu({
  items,
  selectedIndex,
  onItemHover,
  onItemClick,
  entryDelay = 0.6,
}: PixelMenuProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map((item, i) => {
        const isSelected = selectedIndex === i
        const accent = item.accentColor ?? '#ffdd00'

        return (
          <motion.div
            key={i}
            onClick={() => onItemClick(i)}
            onMouseEnter={() => onItemHover(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              cursor: 'pointer',
              background: isSelected ? 'rgba(92,60,0,0.32)' : 'transparent',
              border: isSelected ? `2px solid ${accent}33` : '2px solid transparent',
              transition: 'background 0.12s, border-color 0.12s',
            }}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: entryDelay + i * 0.1, duration: 0.35 }}
          >
            {/* Cursor slot */}
            <div style={{ width: '22px', flexShrink: 0 }}>
              <PixelCursor visible={isSelected} />
            </div>

            {/* Label */}
            <motion.span
              className="font-pixel"
              style={{
                fontSize: 'clamp(9px, 1.6vw, 13px)',
                letterSpacing: '2px',
                minWidth: '100px',
              }}
              animate={
                isSelected
                  ? {
                      color: [accent, '#ffaa00', accent],
                      textShadow: [
                        `0 0 6px ${accent}88`,
                        `0 0 14px ${accent}`,
                        `0 0 6px ${accent}88`,
                      ],
                    }
                  : { color: '#6b5030', textShadow: 'none' }
              }
              transition={{ duration: 1.1, repeat: isSelected ? Infinity : 0 }}
            >
              {item.label}
            </motion.span>

            {/* Optional description */}
            {item.desc && (
              <span
                className="font-pixel"
                style={{
                  fontSize: '6px',
                  color: isSelected ? '#8b6b3a' : '#3a2800',
                  letterSpacing: '0.5px',
                  transition: 'color 0.15s',
                }}
              >
                {item.desc}
              </span>
            )}

            {/* Right blink indicator */}
            {isSelected && (
              <motion.span
                className="font-pixel ml-auto"
                style={{ color: accent, fontSize: '10px', marginLeft: 'auto' }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.75, repeat: Infinity }}
              >
                ◀
              </motion.span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
